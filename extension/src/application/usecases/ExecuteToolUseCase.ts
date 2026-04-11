/**
 * Use case: execute one tool call with HITL confirmation gating.
 * Extracted from the tool-execution loop in loop.ts.
 */

import type { ToolCall, FileDiffPayload } from "../../domain/entities/Message";
import type { HitlPolicy } from "../../domain/entities/AgentConfig";
import type { ILogger } from "../../domain/ports/ILogger";
import { HitlPolicyService } from "../../domain/services/HitlPolicyService";
import type { HitlResolver } from "../dto/AgentDtos";

const TOOL_TIMEOUT_MS = 300_000; // 5 minutes

export interface ToolExecuteFn {
  (name: string, params: Record<string, unknown>): Promise<unknown>;
}

export interface ToolResult {
  serialized: string;
  fileDiff?: FileDiffPayload;
  wasRejected?: boolean;
}

export class ExecuteToolUseCase {
  private readonly hitl: HitlPolicyService;

  constructor(
    private readonly logger: ILogger,
    hitl?: HitlPolicyService,
  ) {
    this.hitl = hitl ?? new HitlPolicyService();
  }

  /**
   * Executes a tool after gating through HITL if required.
   *
   * @param toolCall  Parsed tool invocation from the model.
   * @param executeFn Concrete tool execution function.
   * @param policy    Persisted HITL policy.
   * @param sessionAutoApprove  Whether session-level auto-approve is active.
   * @param isMcp     Whether the tool originates from an MCP server.
   * @param onConfirmRequired  Called when HITL confirmation is needed; returns a resolver.
   * @param onExecuting  Called just before execution (for UI progress).
   */
  async execute(
    toolCall: ToolCall,
    executeFn: ToolExecuteFn,
    policy: HitlPolicy,
    sessionAutoApprove: boolean,
    isMcp: boolean,
    onConfirmRequired: (toolCall: ToolCall) => Promise<boolean>,
    onExecuting: (toolCall: ToolCall) => void,
  ): Promise<ToolResult> {
    // ── Parse error shortcircuit ────────────────────────────────────────────
    if (toolCall.argumentsParseError) {
      const content = buildParseErrorMessage(toolCall);
      onExecuting(toolCall);
      return { serialized: content };
    }

    // ── HITL gate ───────────────────────────────────────────────────────────
    if (this.hitl.shouldConfirm(toolCall.name, policy, sessionAutoApprove, isMcp)) {
      const approved = await onConfirmRequired(toolCall);
      if (!approved) {
        return { wasRejected: true, serialized: "" };
      }
    }

    // ── Execution ───────────────────────────────────────────────────────────
    onExecuting(toolCall);
    this.logger.debug(`Executing tool: ${toolCall.name} id=${toolCall.id}`);

    let result: unknown;
    try {
      result = await Promise.race([
        executeFn(toolCall.name, toolCall.arguments),
        timeout(TOOL_TIMEOUT_MS, toolCall.name),
      ]);
    } catch (err) {
      const msg = `[Erro ao executar tool "${toolCall.name}"] ${toMessage(err)}`;
      this.logger.error(`Tool ${toolCall.name} failed`, err);
      return { serialized: msg };
    }

    const serialized = serializeResult(result);
    const fileDiff = extractFileDiff(result);
    this.logger.debug(`Tool ${toolCall.name} succeeded | resultLen=${serialized.length}`);

    return { serialized, fileDiff };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildParseErrorMessage(toolCall: ToolCall): string {
  const snippet = (toolCall.rawArgumentsText ?? "").slice(0, 4_000);
  return [
    `[Erro de argumentos para tool "${toolCall.name}"]`,
    toolCall.argumentsParseError,
    "",
    "--- Argumentos brutos (fragmento) ---",
    snippet,
  ].join("\n");
}

function timeout(ms: number, toolName: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Tool "${toolName}" excedeu o limite de ${ms / 1000}s`)),
      ms,
    ),
  );
}

function serializeResult(result: unknown): string {
  if (typeof result === "string") return result;
  if (result === null || result === undefined) return "";
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.content === "string") return obj.content;
    return JSON.stringify(result, null, 2);
  }
  return String(result);
}

function extractFileDiff(result: unknown): FileDiffPayload | undefined {
  if (typeof result !== "object" || result === null) return undefined;
  const obj = result as Record<string, unknown>;
  const diff = obj.fileDiff;
  if (typeof diff !== "object" || diff === null) return undefined;
  return diff as FileDiffPayload;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
