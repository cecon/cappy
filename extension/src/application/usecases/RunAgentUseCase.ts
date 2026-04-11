/**
 * Use case: orchestrates one complete agent run.
 * Replaces the monolithic AgentLoop (loop.ts). Depends only on domain ports.
 */

import type { Message, ToolCall } from "../../domain/entities/Message";
import type { CappyConfig, HitlPolicy } from "../../domain/entities/AgentConfig";
import type { SessionContext } from "../../domain/entities/SessionContext";
import type { ILlmProvider, LlmStreamChunk } from "../../domain/ports/ILlmProvider";
import type { IConfigRepository } from "../../domain/ports/IConfigRepository";
import type { ILogger } from "../../domain/ports/ILogger";
import { ContextBudgetService } from "../../domain/services/ContextBudgetService";
import { HitlPolicyService } from "../../domain/services/HitlPolicyService";
import { DEFAULT_CONTEXT_WINDOW_TOKENS, DEFAULT_RESERVED_OUTPUT_TOKENS } from "../../domain/entities/ContextBudget";
import { CompressContextUseCase } from "./CompressContextUseCase";
import { ExecuteToolUseCase } from "./ExecuteToolUseCase";
import { RecoverToolArgsUseCase } from "./RecoverToolArgsUseCase";
import { SystemMessageBuilder } from "../services/SystemMessageBuilder";
import type { AgentEventHandler, RunAgentInput } from "../dto/AgentDtos";

const MAX_STREAM_RETRIES = 2;

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface RunAgentDeps {
  llm: ILlmProvider;
  configRepo: IConfigRepository;
  session: SessionContext;
  logger: ILogger;
  workspaceSkillsPrompt?: string;
  workspaceRoot?: string;
}

export class RunAgentUseCase {
  private readonly budget = new ContextBudgetService();
  private readonly hitlPolicy = new HitlPolicyService();
  private readonly sysBuilder = new SystemMessageBuilder();
  private readonly compress: CompressContextUseCase;
  private readonly executeTool: ExecuteToolUseCase;
  private readonly recoverArgs: RecoverToolArgsUseCase;
  private readonly pending = new Map<string, (ok: boolean) => void>();
  private abort: AbortController | null = null;

  constructor(private readonly deps: RunAgentDeps) {
    this.compress = new CompressContextUseCase(this.budget, deps.llm, deps.session, deps.logger);
    this.executeTool = new ExecuteToolUseCase(deps.logger, this.hitlPolicy);
    this.recoverArgs = new RecoverToolArgsUseCase(deps.llm);
  }

  approve(id: string): boolean { return this.resolveConfirm(id, true); }
  reject(id: string): boolean { return this.resolveConfirm(id, false); }

  abortRun(): void {
    this.abort?.abort();
    for (const [id, fn] of this.pending) { fn(false); this.pending.delete(id); }
  }

  async run(
    messages: Message[],
    tools: AgentTool[],
    input: RunAgentInput,
    onEvent: AgentEventHandler,
  ): Promise<Message[]> {
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const config = await this.deps.configRepo.loadConfig();
    const prefs = await this.deps.configRepo.loadPreferences(this.deps.workspaceRoot ?? process.cwd());
    const policy: HitlPolicy = prefs?.hitl.destructiveTools ?? "confirm_each";
    const toolMap = buildToolMap(tools);
    const history = [...messages];
    const model = config.openrouter.model;
    const ctxWin = config.openrouter.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
    const resOut = config.openrouter.reservedOutputTokens ?? DEFAULT_RESERVED_OUTPUT_TOKENS;
    const effectiveBudget = this.budget.getEffectiveInputBudget(ctxWin, resOut);
    const maxRounds = input.maxLlmRounds ?? config.agent.maxIterations;
    let completedRounds = 0;
    this.deps.logger.info(`Agent run started | messages=${messages.length} tools=${tools.length}`);

    try {
      while (true) {
        if (signal.aborted) { onEvent({ type: "stream:done" }); break; }
        if (completedRounds >= maxRounds) {
          history.push({ role: "assistant", content: "[Cappy] Limite de rodadas atingido." });
          onEvent({ type: "stream:done" });
          break;
        }

        const { messages: compressed, droppedCount, didTrim } = await this.compress.execute(
          history, effectiveBudget, model, input.silent ?? false,
        );
        if (!input.silent) {
          onEvent({ type: "context:usage", payload: this.budget.buildUsagePayload(history, ctxWin, resOut, droppedCount, didTrim) });
        }

        const sysMessages = this.sysBuilder.build(input, this.deps.session, prefs, this.deps.workspaceSkillsPrompt ?? "");
        const { textParts, pendingCalls } = await this.streamRound(compressed, tools, config, sysMessages, signal, onEvent, input.silent ?? false);
        completedRounds++;

        if (pendingCalls.length === 0) {
          if (textParts.length > 0) history.push({ role: "assistant", content: textParts.join("") });
          this.deps.logger.info("Agent run complete (no tool calls)");
          onEvent({ type: "stream:done" });
          break;
        }

        const toolCalls = await this.resolveToolCalls(pendingCalls, toolMap, model, config);
        history.push({ role: "assistant", content: textParts.join(""), tool_calls: toolCalls });

        let rejected = false;
        for (const toolCall of toolCalls) {
          const tool = toolMap.get(toolCall.name);
          if (!tool) throw new Error(`Tool "${toolCall.name}" não registrada.`);
          toolCall.name = tool.name;

          const result = await this.executeTool.execute(
            toolCall,
            (_name, params) => tool.execute(params),
            policy, false, false,
            (tc) => this.awaitConfirm(tc, onEvent),
            (tc) => onEvent({ type: "tool:executing", toolCall: tc }),
          );

          if (result.wasRejected) { onEvent({ type: "tool:rejected", toolCall }); rejected = true; break; }
          onEvent({ type: "tool:result", toolCall, result: result.serialized, fileDiff: result.fileDiff });
          history.push({ role: "tool", content: result.serialized, tool_call_id: toolCall.id });
        }
        if (rejected) { onEvent({ type: "stream:done" }); break; }
      }
      return history;
    } catch (err) {
      const error = toError(err);
      this.deps.logger.error("Agent loop error", error);
      onEvent({ type: "error", error });
      throw error;
    } finally {
      this.abort = null;
    }
  }

  private async streamRound(
    messages: Message[],
    tools: AgentTool[],
    config: CappyConfig,
    sysMessages: string[],
    signal: AbortSignal,
    onEvent: AgentEventHandler,
    silent: boolean,
  ): Promise<{ textParts: string[]; pendingCalls: PendingCall[] }> {
    const textParts: string[] = [];
    const callMap = new Map<number, PendingCall>();
    let attempt = 0;
    while (true) {
      try {
        const stream = this.deps.llm.stream(
          { model: config.openrouter.model, visionModel: config.openrouter.visionModel, systemMessages: sysMessages, messages, tools: tools.map(toSchema), signal },
          (notice) => onEvent({ type: "stream:system", message: notice }),
        );
        for await (const chunk of stream) {
          if (signal.aborted) break;
          if (chunk.textDelta) { textParts.push(chunk.textDelta); if (!silent) onEvent({ type: "stream:token", token: chunk.textDelta }); }
          if (chunk.toolCallIndex !== undefined) accumulateCall(callMap, chunk);
        }
        break;
      } catch (err) {
        if (attempt < MAX_STREAM_RETRIES && isTransient(err)) { attempt++; textParts.length = 0; callMap.clear(); continue; }
        throw err;
      }
    }
    return { textParts, pendingCalls: [...callMap.values()] };
  }

  private async resolveToolCalls(
    pending: PendingCall[], toolMap: Map<string, AgentTool>, model: string, config: CappyConfig,
  ): Promise<ToolCall[]> {
    const result: ToolCall[] = [];
    for (const p of pending.sort((a, b) => a.index - b.index)) {
      let args: Record<string, unknown>; let parseError: string | undefined;
      try { args = JSON.parse(p.argsText || "{}") as Record<string, unknown>; }
      catch (e) {
        const errMsg = toError(e).message;
        if (config.agent.recoverToolArgumentsWithLlm) {
          const tool = toolMap.get(p.name) ?? toolMap.get(p.name.toLowerCase());
          const recovered = await this.recoverArgs.execute(model, p.name, p.argsText, errMsg, tool?.parameters);
          if (recovered) { try { args = JSON.parse(recovered) as Record<string, unknown>; } catch { args = {}; parseError = errMsg; } }
          else { args = {}; parseError = errMsg; }
        } else { args = {}; parseError = errMsg; }
      }
      result.push({ id: p.id, name: p.name, arguments: args, argumentsParseError: parseError, rawArgumentsText: p.argsText });
    }
    return result;
  }

  private awaitConfirm(toolCall: ToolCall, onEvent: AgentEventHandler): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pending.set(toolCall.id, resolve);
      onEvent({ type: "tool:confirm", toolCall });
    });
  }

  private resolveConfirm(id: string, approved: boolean): boolean {
    const fn = this.pending.get(id);
    if (!fn) return false;
    this.pending.delete(id);
    fn(approved);
    return true;
  }
}

// ── Pure helpers ───────────────────────────────────────────────────────────

interface PendingCall { index: number; id: string; name: string; argsText: string }

function buildToolMap(tools: AgentTool[]): Map<string, AgentTool> {
  const m = new Map<string, AgentTool>();
  for (const t of tools) { m.set(t.name, t); m.set(t.name.toLowerCase(), t); }
  return m;
}

function accumulateCall(map: Map<number, PendingCall>, chunk: LlmStreamChunk): void {
  const idx = chunk.toolCallIndex ?? 0;
  const c = map.get(idx) ?? { index: idx, id: "", name: "", argsText: "" };
  if (chunk.toolCallId) c.id = chunk.toolCallId;
  if (chunk.toolCallName) c.name += chunk.toolCallName;
  if (chunk.toolCallArgsDelta) c.argsText += chunk.toolCallArgsDelta;
  map.set(idx, c);
}

function toSchema(t: AgentTool) { return { name: t.name, description: t.description, parameters: t.parameters }; }

function isTransient(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : "").toLowerCase();
  return ["terminated","econnreset","socket hang up","network","fetch failed","aborted"].some((k) => msg.includes(k));
}

function toError(err: unknown): Error { return err instanceof Error ? err : new Error(String(err)); }
