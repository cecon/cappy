import { EventEmitter } from "node:events";

import OpenAI from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import type { ChatUiMode } from "../bridge/chatMode";
import { loadConfig, type CappyConfig } from "../config";
import { coerceSearchPattern, mergeNestedPatternArgs } from "../tools/coercePattern";
import type { McpTool } from "../mcp/client";
import type { ToolDefinition } from "../tools/toolTypes";
import type { FileDiffPayload } from "../utils/fileDiffPayload";
import {
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  DEFAULT_RESERVED_OUTPUT_TOKENS,
  estimateMessagesTokens,
  estimateTextTokens,
  getEffectiveInputBudgetTokens,
  SYSTEM_PROMPT_OVERHEAD_TOKENS,
  trimMessagesForBudget,
  type ContextUsagePayload,
} from "./contextBudget";
import {
  MAX_CONTEXT_SANITIZE_ITERATIONS,
  MIN_DROPPED_TOKENS_TO_SUMMARIZE,
  summarizeDroppedMessagesForMainAgent,
} from "./contextSanitize";
import {
  appendCompactionNote,
  getConversationCompactionSummary,
  getPlanMode,
} from "./sessionContext";
import type { AgentEvents, AgentTool, Message, ToolCall } from "./types";
import { recoverToolArgumentsWithLlm } from "./toolArgumentRecovery";
import {
  ensureDefaultAgentPreferencesFile,
  formatAgentPreferencesPromptBlock,
  loadAgentPreferences,
  saveAgentPreferences,
  type AgentPreferences,
} from "./agentPreferences";
import { loadWorkspaceSkillsPrompt } from "./workspaceSkills";
import { buildWorkspaceTreePromptBlock } from "./workspaceTree";
import { buildKnowledgePromptBlock } from "./knowledgeBase";
import { logDebug, logError, logInfo } from "../utils/logger";

/**
 * Hard timeout for a single tool execution (5 minutes).
 * Prevents the loop from hanging indefinitely on stuck tool calls (e.g. runTerminal waiting on stdin).
 */
const TOOL_EXECUTION_TIMEOUT_MS = 300_000;

/**
 * Tools that require explicit user confirmation before execution.
 */
const DESTRUCTIVE_TOOLS = ["writeFile", "Write", "runTerminal", "Bash", "Edit"] as const;
const MCP_DESTRUCTIVE_KEYWORDS = [
  "write", "delete", "remove", "create", "execute", "run",
  "truncate", "drop", "overwrite", "update", "patch",
  "destroy", "insert", "modify", "deploy", "push", "migrate",
] as const;

const DESTRUCTIVE_TOOL_SET = new Set<string>(DESTRUCTIVE_TOOLS);

/**
 * Tools that are safe to execute in parallel (no side-effects on workspace state).
 * For MCP tools the heuristic is: not matching any MCP_DESTRUCTIVE_KEYWORDS.
 */
const READONLY_TOOL_NAMES = new Set<string>([
  "Read", "readFile",
  "Glob", "globFiles",
  "listDir",
  "Grep", "searchCode",
  "ListSkills", "ReadSkill",
  "ListKnowledge", "ReadKnowledge",
  "SemanticSearch",
  "WebFetch", "WebSearch",
  "ExploreAgent",
]);

/**
 * Number of consecutive tool errors that trigger the Smart Loop Breaker.
 */
const MAX_CONSECUTIVE_TOOL_ERRORS = 3;

/**
 * Cost per 1M tokens (input/output) for common OpenRouter models (USD).
 * Used for per-run cost estimates emitted via stream:system.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-4o":                           { input: 5.00,  output: 15.00 },
  "openai/gpt-4o-mini":                      { input: 0.15,  output: 0.60  },
  "openai/gpt-4-turbo":                      { input: 10.00, output: 30.00 },
  "openai/gpt-3.5-turbo":                    { input: 0.50,  output: 1.50  },
  "openai/gpt-oss-120b":                     { input: 2.00,  output: 8.00  },
  "anthropic/claude-3-5-sonnet":             { input: 3.00,  output: 15.00 },
  "anthropic/claude-3-5-sonnet-20241022":    { input: 3.00,  output: 15.00 },
  "anthropic/claude-3-7-sonnet":             { input: 3.00,  output: 15.00 },
  "anthropic/claude-3-haiku":                { input: 0.25,  output: 1.25  },
  "anthropic/claude-3-opus":                 { input: 15.00, output: 75.00 },
  "google/gemini-2.0-flash":                 { input: 0.10,  output: 0.40  },
  "google/gemini-1.5-pro":                   { input: 1.25,  output: 5.00  },
  "google/gemini-1.5-flash":                 { input: 0.075, output: 0.30  },
  "meta-llama/llama-3.1-70b-instruct":       { input: 0.88,  output: 0.88  },
  "meta-llama/llama-3.1-8b-instruct":        { input: 0.18,  output: 0.18  },
  "meta-llama/llama-3.3-70b-instruct":       { input: 0.59,  output: 0.79  },
  "deepseek/deepseek-chat":                  { input: 0.27,  output: 1.10  },
  "deepseek/deepseek-r1":                    { input: 0.55,  output: 2.19  },
  "mistralai/mistral-small":                 { input: 0.20,  output: 0.60  },
  "mistralai/mistral-large":                 { input: 2.00,  output: 6.00  },
  "qwen/qwen-2.5-72b-instruct":              { input: 0.35,  output: 0.40  },
};

/**
 * Injected while plan mode is active (OpenClaude-style EnterPlanMode).
 */
const PLAN_MODE_SYSTEM_PROMPT =
  "You are in PLAN MODE. Explore the codebase, read files, and design an approach. " +
  "Do not use Write, writeFile, Edit, Bash, or runTerminal until you call ExitPlanMode or the user explicitly asks for implementation. " +
  "You may use ExploreAgent for read-only deep code/web search. Use TodoWrite to track steps. " +
  "Use WebFetch or WebSearch for quick public lookups when helpful.";

interface PendingToolCallState {
  id: string;
  name: string;
  argumentsText: string;
}

interface AgentLoopOptions {
  workspaceRoot?: string;
  onMcpCall?: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<string>;
}

const PLAIN_MODE_SYSTEM_PROMPT =
  "Modo Plain: responde só em texto. Não invoques ferramentas. Não finjas ter lido ficheiros do disco; usa apenas o que o utilizador enviou no chat.";

const ASK_MODE_SYSTEM_PROMPT =
  "Modo Ask: podes usar só ferramentas de leitura e pesquisa (ler código, grep, glob, web). " +
  "Não escrevas ficheiros, não executas shell, não uses Write/Edit/Bash salvo o utilizador pedir explicitamente alterações no repo.";

interface AgentRunOptions {
  mcpTools?: McpTool[];
  /**
   * Webview mode: ajusta prompts de sistema (plain/ask) em buildOpenAiMessages.
   */
  chatMode?: ChatUiMode;
  /**
   * Extra system instruction prepended before plan-mode (used by read-only subagents).
   */
  systemPromptPrefix?: string;
  /**
   * When true, streaming tokens are not emitted (nested subagent runs).
   */
  silent?: boolean;
  /**
   * When true, plan-mode system prompt is skipped (subagent should explore with read-only tools).
   */
  ignorePlanMode?: boolean;
  /**
   * Maximum number of LLM rounds (outer while iterations); undefined = unlimited.
   */
  maxLlmRounds?: number;
}

/**
 * Event-driven agent loop with OpenRouter streaming support.
 */
export class AgentLoop extends EventEmitter {
  private readonly workspaceRoot: string;

  private readonly onMcpCall:
    | ((
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<string>)
    | undefined;

  private client: OpenAI | null = null;

  private model: string | null = null;

  private visionModel: string | null = null;

  private readonly pendingConfirmations = new Map<string, (approved: boolean) => void>();

  /** AbortController for the current run; cancelled via abort(). */
  private runAbort: AbortController | null = null;

  /** Per-`run()` options; cleared after each run. */
  private runOptions: AgentRunOptions = {};

  /**
   * Bloco injectado a partir de `.cappy/skill` (ficheiros `.md`, recursivo; recarregado em cada `run()`).
   */
  private workspaceSkillsBlock = "";

  /** Bloco injectado com `.cappy/agent-preferences.json`. */
  private agentPreferencesBlock = "";

  /** Árvore compacta do workspace injectada no system prompt (apenas runs não-silenciosos). */
  private workspaceTreeBlock = "";

  /** Catálogo compacto de Knowledge Items injectado no system prompt (apenas runs não-silenciosos). */
  private workspaceKnowledgeBlock = "";

  /** Política lida do disco no início de cada `run()` (prompt do modelo). A auto-aprovação na UI é responsabilidade do webview. */
  private hitlPersistedDestructive: AgentPreferences["hitl"]["destructiveTools"] = "confirm_each";

  /** Usage from the last streaming completion chunk (for cost tracking). */
  private lastRunUsage: { promptTokens: number; completionTokens: number } | null = null;

  /**
   * Creates a loop instance bound to one workspace root.
   */
  public constructor(options: AgentLoopOptions = {}) {
    super();
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.onMcpCall = options.onMcpCall;
  }

  /**
   * Typed event subscription for agent lifecycle events.
   */
  public override on<K extends keyof AgentEvents>(eventName: K, listener: AgentEvents[K]): this {
    return super.on(eventName, listener);
  }

  /**
   * Aprova o pedido pendente. A política «aprovar todos nesta sessão» é aplicada no webview (`hitl:policy`).
   */
  public approveSessionAutoDestructive(toolCallId: string): boolean {
    return this.approve(toolCallId);
  }

  /**
   * Aprova o pedido actual, grava `allow_all` em `.cappy/agent-preferences.json` e activa auto-aprovação.
   */
  public async persistAllowAllDestructive(toolCallId: string): Promise<boolean> {
    const ok = this.approve(toolCallId);
    if (!ok) {
      return false;
    }
    this.hitlPersistedDestructive = "allow_all";
    const prefs: AgentPreferences = {
      version: 1,
      hitl: { destructiveTools: "allow_all" },
    };
    await saveAgentPreferences(this.workspaceRoot, prefs);
    this.agentPreferencesBlock = formatAgentPreferencesPromptBlock(prefs);
    return true;
  }

  /**
   * Approves one pending destructive tool execution.
   */
  public approve(toolCallId: string): boolean {
    const resolver = this.pendingConfirmations.get(toolCallId);
    if (!resolver) {
      return false;
    }
    this.pendingConfirmations.delete(toolCallId);
    resolver(true);
    return true;
  }

  /**
   * Aborts the current agent run (stop button).
   */
  public abort(): void {
    if (this.runAbort) {
      this.runAbort.abort();
      this.runAbort = null;
    }
    // Also reject any pending confirmations so the loop unblocks
    for (const [id, resolver] of this.pendingConfirmations) {
      resolver(false);
      this.pendingConfirmations.delete(id);
    }
  }

  /**
   * Rejects one pending destructive tool execution.
   */
  public reject(toolCallId: string): boolean {
    const resolver = this.pendingConfirmations.get(toolCallId);
    if (!resolver) {
      return false;
    }
    this.pendingConfirmations.delete(toolCallId);
    resolver(false);
    return true;
  }

  /**
   * Runs the manual agent loop until the model stops requesting tools.
   */
  public async run(messages: Message[], tools: AgentTool[], options: AgentRunOptions = {}): Promise<Message[]> {
    this.runOptions = options;
    this.runAbort = new AbortController();
    this.workspaceSkillsBlock = await loadWorkspaceSkillsPrompt(this.workspaceRoot);
    // Build workspace tree and knowledge catalog only for interactive runs — subagents skip this to save tokens
    if (!options.silent) {
      this.workspaceTreeBlock = await buildWorkspaceTreePromptBlock(this.workspaceRoot);
      this.workspaceKnowledgeBlock = await buildKnowledgePromptBlock(this.workspaceRoot);
    } else {
      this.workspaceTreeBlock = "";
      this.workspaceKnowledgeBlock = "";
    }
    await ensureDefaultAgentPreferencesFile(this.workspaceRoot);
    const prefs = await loadAgentPreferences(this.workspaceRoot);
    this.hitlPersistedDestructive = prefs?.hitl.destructiveTools ?? "confirm_each";
    this.agentPreferencesBlock = formatAgentPreferencesPromptBlock(prefs);
    // Load config once per run — avoids repeated disk reads inside createStream / resolveParsedToolCalls
    const runConfig = await loadConfig();
    const mergedTools = this.mergeTools(tools, options.mcpTools ?? []);
    const history = [...messages];
    const toolsByName = new Map<string, AgentTool>(mergedTools.map((tool) => [tool.name, tool]));
    // Case-insensitive index for models that emit lowercase tool names (e.g. "edit" instead of "Edit")
    const toolsByLowerName = new Map<string, AgentTool>(mergedTools.map((tool) => [tool.name.toLowerCase(), tool]));
    /** Per-run cache for readonly tool results. Keyed by "toolName:stableArgs". Cleared after any destructive tool. */
    const toolResultCache = new Map<string, string>();
    const maxRounds = options.maxLlmRounds;
    let completedLlmRounds = 0;
    let consecutiveToolErrors = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    logInfo(`Agent run started | messages=${messages.length} tools=${mergedTools.length} mode=${options.chatMode ?? "agent"}`);
    void logDebug(`Tool names: ${mergedTools.map((t) => t.name).join(", ")}`);

    try {
      while (true) {
        if (this.runAbort?.signal.aborted) {
          logInfo("Agent run aborted by user");
          this.emitEvent("stream:done");
          break;
        }
        if (maxRounds !== undefined && completedLlmRounds >= maxRounds) {
          history.push({
            role: "assistant",
            content:
              "[Cappy] Limite de rodadas do agente aninhado atingido. " +
              "Peça um relatório mais estreito ou aumente max_iterations na próxima chamada.",
          });
          this.emitEvent("stream:done");
          break;
        }

        const assistantTextParts: string[] = [];
        const pendingToolCalls = new Map<number, PendingToolCallState>();

        void logDebug(`LLM round ${completedLlmRounds + 1} | history=${history.length} messages`);

        const MAX_STREAM_RETRIES = 2;
        let streamAttempt = 0;
        while (true) {
          try {
            const stream = await this.createStream(history, mergedTools, runConfig);
            for await (const chunk of stream) {
              if (this.runAbort?.signal.aborted) {
                break;
              }
              this.consumeChunk(chunk, assistantTextParts, pendingToolCalls);
            }
            break;
          } catch (streamErr) {
            const errMsg = asError(streamErr).message.toLowerCase();
            const isTransient =
              errMsg.includes("terminated") ||
              errMsg.includes("econnreset") ||
              errMsg.includes("socket hang up") ||
              errMsg.includes("network") ||
              errMsg.includes("fetch failed") ||
              errMsg.includes("aborted");
            if (isTransient && streamAttempt < MAX_STREAM_RETRIES) {
              streamAttempt += 1;
              logInfo(`Stream transient error "${asError(streamErr).message}", retrying (${streamAttempt}/${MAX_STREAM_RETRIES})...`);
              assistantTextParts.length = 0;
              pendingToolCalls.clear();
              continue;
            }
            throw streamErr;
          }
        }

        void logDebug(`Stream consumed | chunks done, parsing tool calls...`);
        completedLlmRounds += 1;

        // Accumulate token usage for cost tracking
        if (this.lastRunUsage) {
          totalPromptTokens += this.lastRunUsage.promptTokens;
          totalCompletionTokens += this.lastRunUsage.completionTokens;
          this.lastRunUsage = null;
        }

        const assistantContent = assistantTextParts.join("");
        const toolCalls = await this.resolveParsedToolCalls(pendingToolCalls, toolsByName, runConfig);

        void logDebug(`LLM round ${completedLlmRounds} finished | toolCalls=${toolCalls.length} textLen=${assistantContent.length}`);

        if (toolCalls.length === 0) {
          if (assistantContent.length > 0) {
            history.push({ role: "assistant", content: assistantContent });
          }
          logInfo("Agent run complete (no more tool calls)");
          this.emitEvent("stream:done");
          break;
        }

        history.push({
          role: "assistant",
          content: assistantContent,
          tool_calls: toolCalls,
        });

        let wasRejected = false;

        // Validation pass: resolve canonical tool names before any execution
        for (const toolCall of toolCalls) {
          const tool = toolsByName.get(toolCall.name) ?? toolsByLowerName.get(toolCall.name.toLowerCase());
          if (!tool) {
            throw new Error(`Tool "${toolCall.name}" nao esta registrada.`);
          }
          toolCall.name = tool.name;
        }

        // All-readonly batch with no parse errors → execute in parallel
        const batchIsAllReadonly =
          toolCalls.length > 1 &&
          toolCalls.every((tc) => !tc.argumentsParseError && this.isReadonlyTool(tc.name));

        if (batchIsAllReadonly) {
          // Pre-check cache per slot so cache hits resolve immediately without I/O
          const cachedBySlot: (string | null)[] = toolCalls.map(
            (tc) => toolResultCache.get(`${tc.name}:${stableJsonKey(tc.arguments)}`) ?? null,
          );

          // Emit tool:executing for all tools in order before any execution starts
          for (const toolCall of toolCalls) {
            this.emitEvent("tool:executing", toolCall);
            void logDebug(`Executing tool (parallel): ${toolCall.name} id=${toolCall.id}`);
          }

          // Launch all executions concurrently; cache hits resolve synchronously
          const execPromises = toolCalls.map((toolCall, i) => {
            if (cachedBySlot[i] !== null) {
              return Promise.resolve(cachedBySlot[i] as unknown);
            }
            const tool = toolsByName.get(toolCall.name)!;
            return Promise.race([
              tool.execute(toolCall.arguments),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Tool "${toolCall.name}" excedeu o limite de ${TOOL_EXECUTION_TIMEOUT_MS / 1000}s`,
                      ),
                    ),
                  TOOL_EXECUTION_TIMEOUT_MS,
                ),
              ),
            ]);
          });

          // allSettled preserves index order → history integrity is maintained
          const settlements = await Promise.allSettled(execPromises);

          let parallelHadError = false;
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i]!;
            const settlement = settlements[i]!;
            let serializedResult: string;
            let fileDiffPayload: FileDiffPayload | undefined;
            if (settlement.status === "fulfilled") {
              if (cachedBySlot[i] !== null) {
                serializedResult = cachedBySlot[i]!;
                void logDebug(`Tool ${toolCall.name} cache hit (parallel)`);
              } else {
                serializedResult = serializeToolResult(settlement.value);
                fileDiffPayload = extractFileDiffPayload(settlement.value);
                toolResultCache.set(`${toolCall.name}:${stableJsonKey(toolCall.arguments)}`, serializedResult);
                void logDebug(`Tool ${toolCall.name} succeeded | resultLen=${serializedResult.length}`);
              }
            } else {
              serializedResult = `[Erro ao executar tool "${toolCall.name}"] ${asError(settlement.reason).message}`;
              logError(`Tool ${toolCall.name} failed: ${asError(settlement.reason).message}`);
              parallelHadError = true;
            }
            this.emitEvent("tool:result", toolCall, serializedResult, fileDiffPayload);
            history.push({ role: "tool", content: serializedResult, tool_call_id: toolCall.id });
          }
          if (parallelHadError) {
            consecutiveToolErrors++;
          } else {
            consecutiveToolErrors = 0;
          }
        } else {
          // Sequential path — original logic with cache support
          for (const toolCall of toolCalls) {
            if (this.isDestructiveTool(toolCall.name)) {
              const approved = await this.confirm(toolCall);
              if (!approved) {
                this.emitEvent("tool:rejected", toolCall);
                wasRejected = true;
                break;
              }
            }

            if (toolCall.argumentsParseError) {
              const snippet = truncateToolArgsSnippet(toolCall.rawArgumentsText ?? "", 4_000);
              const parseFailContent = [
                `[Erro de argumentos para tool "${toolCall.name}"]`,
                toolCall.argumentsParseError,
                "",
                "--- Argumentos brutos (fragmento) ---",
                snippet,
              ].join("\n");
              this.emitEvent("tool:executing", toolCall);
              this.emitEvent("tool:result", toolCall, parseFailContent, undefined);
              history.push({ role: "tool", content: parseFailContent, tool_call_id: toolCall.id });
              continue;
            }

            // Check cache for readonly tools before executing
            const cacheKey = `${toolCall.name}:${stableJsonKey(toolCall.arguments)}`;
            const cachedResult = this.isReadonlyTool(toolCall.name) ? toolResultCache.get(cacheKey) : undefined;

            this.emitEvent("tool:executing", toolCall);
            void logDebug(`Executing tool: ${toolCall.name} id=${toolCall.id}`);
            let serializedResult: string;
            let fileDiffPayload: FileDiffPayload | undefined;

            if (cachedResult !== undefined) {
              void logDebug(`Tool ${toolCall.name} cache hit`);
              serializedResult = cachedResult;
            } else {
              const tool = toolsByName.get(toolCall.name)!;
              try {
                const result = await Promise.race([
                  tool.execute(toolCall.arguments),
                  new Promise<never>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(
                          new Error(
                            `Tool "${toolCall.name}" excedeu o limite de ${TOOL_EXECUTION_TIMEOUT_MS / 1000}s`,
                          ),
                        ),
                      TOOL_EXECUTION_TIMEOUT_MS,
                    ),
                  ),
                ]);
                serializedResult = serializeToolResult(result);
                fileDiffPayload = extractFileDiffPayload(result);
                void logDebug(`Tool ${toolCall.name} succeeded | resultLen=${serializedResult.length}`);
                if (this.isReadonlyTool(toolCall.name)) {
                  toolResultCache.set(cacheKey, serializedResult);
                } else {
                  // Any destructive tool invalidates the entire cache to prevent stale reads
                  toolResultCache.clear();
                }
                consecutiveToolErrors = 0;
              } catch (execError) {
                serializedResult = `[Erro ao executar tool "${toolCall.name}"] ${asError(execError).message}`;
                fileDiffPayload = undefined;
                logError(`Tool ${toolCall.name} failed: ${asError(execError).message}`);
                consecutiveToolErrors++;
              }
            }

            this.emitEvent("tool:result", toolCall, serializedResult, fileDiffPayload);
            history.push({ role: "tool", content: serializedResult, tool_call_id: toolCall.id });
          }
        }

        if (consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
          this.emitEvent(
            "stream:system",
            `Smart Loop Breaker: ${MAX_CONSECUTIVE_TOOL_ERRORS} erros consecutivos de tools. ` +
            "O agente parou para evitar loop infinito. Revê os erros acima e reinicia.",
          );
          logInfo(`Agent stopped by Smart Loop Breaker after ${consecutiveToolErrors} consecutive tool errors`);
          this.emitEvent("stream:done");
          break;
        }

        if (wasRejected) {
          logInfo("Agent run stopped (tool rejected)");
          this.emitEvent("stream:done");
          break;
        }

        void logDebug(`All tools executed for round ${completedLlmRounds}, looping for next LLM call...`);
      }

      if (!options.silent && totalPromptTokens > 0) {
        const pricing = MODEL_PRICING[runConfig.openrouter.model];
        const costStr = pricing
          ? ` (~$${((totalPromptTokens * pricing.input + totalCompletionTokens * pricing.output) / 1_000_000).toFixed(4)})`
          : "";
        this.emitEvent(
          "stream:system",
          `Tokens: ${totalPromptTokens.toLocaleString()} entrada + ${totalCompletionTokens.toLocaleString()} saída${costStr} | ${completedLlmRounds} rounds`,
        );
      }

      logInfo(`Agent run finished | totalRounds=${completedLlmRounds} historyLen=${history.length}`);
      return history;
    } catch (error) {
      const normalizedError = asError(error);
      const msg = normalizedError.message.toLowerCase();
      const isTransient =
        msg.includes("terminated") ||
        msg.includes("econnreset") ||
        msg.includes("socket hang up") ||
        msg.includes("fetch failed");
      const userMessage = isTransient
        ? `Conexão com a API foi interrompida (${normalizedError.message}). Tente novamente.`
        : normalizedError.message;
      logError(`Agent loop error: ${normalizedError.message}`);
      const reported = new Error(userMessage);
      this.emitEvent("error", reported);
      throw reported;
    } finally {
      this.runAbort = null;
      this.runOptions = {};
      this.workspaceSkillsBlock = "";
      this.agentPreferencesBlock = "";
      this.workspaceTreeBlock = "";
      this.workspaceKnowledgeBlock = "";
      this.lastRunUsage = null;
      // Clear cached client so the next run picks up fresh config (API key, model changes)
      this.client = null;
      this.model = null;
      this.visionModel = null;
    }
  }

  /**
   * Creates one streaming completion request to OpenRouter.
   */
  private async createStream(messages: Message[], tools: AgentTool[], config: CappyConfig) {
    const { client, model, visionModel } = await this.getClientAndModel();
    const contextWindow =
      typeof config.openrouter.contextWindowTokens === "number" && config.openrouter.contextWindowTokens >= 4096
        ? config.openrouter.contextWindowTokens
        : DEFAULT_CONTEXT_WINDOW_TOKENS;
    const reservedOut =
      typeof config.openrouter.reservedOutputTokens === "number" && config.openrouter.reservedOutputTokens >= 512
        ? config.openrouter.reservedOutputTokens
        : DEFAULT_RESERVED_OUTPUT_TOKENS;
    const effectiveBudget = getEffectiveInputBudgetTokens(contextWindow, reservedOut);

    const sanitized = sanitizeHistory(messages);
    let validMessages: Message[];
    let didTrimForApi = false;
    let droppedMessageCount = 0;

    if (this.runOptions.silent) {
      const compactionExtraSilent = 0;
      const trimBudget = Math.max(1024, effectiveBudget - SYSTEM_PROMPT_OVERHEAD_TOKENS - compactionExtraSilent);
      const tr = trimMessagesForBudget(sanitized, trimBudget);
      validMessages = tr.messages;
      didTrimForApi = tr.droppedCount > 0;
      droppedMessageCount = tr.droppedCount;
    } else {
      let work = [...sanitized];
      for (let iter = 0; iter < MAX_CONTEXT_SANITIZE_ITERATIONS; iter += 1) {
        const compactionExtra = estimateTextTokens(getConversationCompactionSummary());
        const trimBudget = Math.max(1024, effectiveBudget - SYSTEM_PROMPT_OVERHEAD_TOKENS - compactionExtra);
        const tr = trimMessagesForBudget(work, trimBudget);
        if (tr.droppedCount === 0) {
          work = tr.messages;
          break;
        }
        didTrimForApi = true;
        droppedMessageCount += tr.droppedCount;
        const dropped = work.slice(0, tr.droppedCount);
        work = tr.messages;
        const droppedTokens = estimateMessagesTokens(dropped);
        if (droppedTokens >= MIN_DROPPED_TOKENS_TO_SUMMARIZE) {
          try {
            const summary = await summarizeDroppedMessagesForMainAgent(client, model, dropped);
            if (summary.length > 0) {
              appendCompactionNote(summary);
            } else {
              appendCompactionNote(
                `[Compactação] Trecho omitido (~${String(droppedTokens)} tokens); modelo não devolveu resumo.`,
              );
            }
          } catch {
            appendCompactionNote(
              `[Compactação] Trecho omitido (~${String(droppedTokens)} tokens); falha ao gerar resumo.`,
            );
          }
        } else {
          appendCompactionNote(`[Compactação] Trecho curto omitido (~${String(droppedTokens)} tokens).`);
        }
      }

      const compactionExtraFinal = estimateTextTokens(getConversationCompactionSummary());
      const trimBudgetFinal = Math.max(1024, effectiveBudget - SYSTEM_PROMPT_OVERHEAD_TOKENS - compactionExtraFinal);
      const finalTr = trimMessagesForBudget(work, trimBudgetFinal);
      if (finalTr.droppedCount > 0) {
        didTrimForApi = true;
        droppedMessageCount += finalTr.droppedCount;
        const droppedFinal = work.slice(0, finalTr.droppedCount);
        work = finalTr.messages;
        const finalTokens = estimateMessagesTokens(droppedFinal);
        if (finalTokens >= MIN_DROPPED_TOKENS_TO_SUMMARIZE) {
          try {
            const summaryFinal = await summarizeDroppedMessagesForMainAgent(client, model, droppedFinal);
            if (summaryFinal.length > 0) {
              appendCompactionNote(summaryFinal);
            } else {
              appendCompactionNote(
                `[Compactação] Ajuste final: trecho omitido (~${String(finalTokens)} tokens); resumo vazio.`,
              );
            }
          } catch {
            appendCompactionNote(
              `[Compactação] Ajuste final: trecho omitido (~${String(finalTokens)} tokens); falha ao resumir.`,
            );
          }
        } else {
          appendCompactionNote(`[Compactação] Ajuste final: trecho curto omitido (~${String(finalTokens)} tokens).`);
        }
        const compactionAfterFinal = estimateTextTokens(getConversationCompactionSummary());
        const trimAfterFinal = Math.max(1024, effectiveBudget - SYSTEM_PROMPT_OVERHEAD_TOKENS - compactionAfterFinal);
        const lastTr = trimMessagesForBudget(work, trimAfterFinal);
        if (lastTr.droppedCount > 0) {
          didTrimForApi = true;
          droppedMessageCount += lastTr.droppedCount;
          appendCompactionNote("[Compactação] Último corte após novo resumo (orçamento).");
        }
        validMessages = lastTr.messages;
      } else {
        validMessages = finalTr.messages;
      }
    }

    const usagePayload: ContextUsagePayload = {
      usedTokens: estimateMessagesTokens(sanitized),
      limitTokens: contextWindow,
      effectiveInputBudgetTokens: effectiveBudget,
      didTrimForApi,
      droppedMessageCount,
    };
    if (!this.runOptions.silent) {
      this.emitEvent("context:usage", usagePayload);
    }
    const hasImages = validMessages.some((m) => m.images && m.images.length > 0);
    const selectedModel = hasImages ? visionModel : model;

    void logDebug(`createStream | model=${selectedModel} msgs=${validMessages.length} budget=${effectiveBudget} trimmed=${String(didTrimForApi)} dropped=${droppedMessageCount}`);

    try {
      return await client.chat.completions.create({
        model: selectedModel,
        stream: true,
        stream_options: { include_usage: true },
        messages: this.buildOpenAiMessages(validMessages),
        tools: tools.map((tool) => toChatTool(tool)),
      });
    } catch (error) {
      const errorMessage = asError(error).message;
      if (errorMessage.includes("image input") || errorMessage.includes("image_url")) {
        this.emitEvent("stream:system", "Modelo de visão não suporta imagens. Enviando apenas texto.");
        const stripped = validMessages.map(stripImages);
        return client.chat.completions.create({
          model,
          stream: true,
          stream_options: { include_usage: true },
          messages: this.buildOpenAiMessages(stripped),
          tools: tools.map((tool) => toChatTool(tool)),
        });
      }
      if (errorMessage.includes("tool use") || errorMessage.includes("tool_use")) {
        this.emitEvent("stream:system", `Modelo \`${selectedModel}\` não suporta tools. Reenviando com modelo principal.`);
        const stripped = validMessages.map(stripImages);
        return client.chat.completions.create({
          model,
          stream: true,
          stream_options: { include_usage: true },
          messages: this.buildOpenAiMessages(stripped),
          tools: tools.map((tool) => toChatTool(tool)),
        });
      }
      throw error;
    }
  }

  /**
   * Builds API messages, optionally prefixing plan-mode system instructions (OpenClaude parity).
   */
  private buildOpenAiMessages(validMessages: Message[]): ChatCompletionMessageParam[] {
    const core = validMessages.map((message) => toChatMessage(message));
    const mode = this.runOptions.chatMode ?? "agent";
    const modeSystem: ChatCompletionMessageParam[] = [];
    if (mode === "plain") {
      modeSystem.push({ role: "system", content: PLAIN_MODE_SYSTEM_PROMPT });
    } else if (mode === "ask") {
      modeSystem.push({ role: "system", content: ASK_MODE_SYSTEM_PROMPT });
    }
    const compactionSummary = this.runOptions.silent ? "" : getConversationCompactionSummary();
    const compactionSystem: ChatCompletionMessageParam[] =
      compactionSummary.length > 0
        ? [
            {
              role: "system",
              content:
                "Memória sanitizada do histórico anterior (compactado para caber no contexto). Usa estes factos como continuação da conversa:\n" +
                compactionSummary,
            },
          ]
        : [];
    const workspaceSkills: ChatCompletionMessageParam[] =
      this.workspaceSkillsBlock.length > 0
        ? [{ role: "system", content: this.workspaceSkillsBlock }]
        : [];
    const agentPreferences: ChatCompletionMessageParam[] =
      this.agentPreferencesBlock.length > 0
        ? [{ role: "system", content: this.agentPreferencesBlock }]
        : [];
    const prefix = this.runOptions.systemPromptPrefix;
    const plan =
      !this.runOptions.ignorePlanMode && getPlanMode() ? [{ role: "system" as const, content: PLAN_MODE_SYSTEM_PROMPT }] : [];
    const extra = prefix && prefix.length > 0 ? [{ role: "system" as const, content: prefix }] : [];
    const workspaceTree: ChatCompletionMessageParam[] =
      this.workspaceTreeBlock.length > 0
        ? [{ role: "system", content: this.workspaceTreeBlock }]
        : [];
    const knowledge: ChatCompletionMessageParam[] =
      this.workspaceKnowledgeBlock.length > 0
        ? [{ role: "system", content: this.workspaceKnowledgeBlock }]
        : [];
    if (
      modeSystem.length === 0 &&
      workspaceSkills.length === 0 &&
      knowledge.length === 0 &&
      agentPreferences.length === 0 &&
      compactionSystem.length === 0 &&
      extra.length === 0 &&
      plan.length === 0 &&
      workspaceTree.length === 0
    ) {
      return core;
    }
    return [
      ...modeSystem,
      ...workspaceSkills,
      ...knowledge,
      ...agentPreferences,
      ...compactionSystem,
      ...extra,
      ...plan,
      ...workspaceTree,
      ...core,
    ];
  }

  /**
   * Applies one stream chunk to the accumulated text and tool-call buffers.
   */
  private consumeChunk(
    chunk: ChatCompletionChunk,
    assistantTextParts: string[],
    pendingToolCalls: Map<number, PendingToolCallState>,
  ): void {
    // Capture usage from the final chunk (sent when stream_options.include_usage = true)
    if (chunk.usage) {
      this.lastRunUsage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
      };
    }

    const choice = chunk.choices[0];
    if (!choice) {
      return;
    }

    const content = choice.delta.content;
    if (typeof content === "string" && content.length > 0) {
      assistantTextParts.push(content);
      if (!this.runOptions.silent) {
        this.emitEvent("stream:token", content);
      }
    }

    const streamedToolCalls = choice.delta.tool_calls;
    if (!Array.isArray(streamedToolCalls)) {
      return;
    }

    for (const streamedToolCall of streamedToolCalls) {
      const index = streamedToolCall.index ?? 0;
      const existing = pendingToolCalls.get(index) ?? {
        id: "",
        name: "",
        argumentsText: "",
      };

      if (typeof streamedToolCall.id === "string" && streamedToolCall.id.length > 0) {
        existing.id = streamedToolCall.id;
      }

      const functionCall = streamedToolCall.function;
      if (functionCall) {
        if (typeof functionCall.name === "string" && functionCall.name.length > 0) {
          existing.name += functionCall.name;
        }
        if (typeof functionCall.arguments === "string" && functionCall.arguments.length > 0) {
          existing.argumentsText += functionCall.arguments;
        }
      }

      pendingToolCalls.set(index, existing);
    }
  }

  /**
   * Parse dos argumentos em stream, com recuperação opcional via LLM e fallback para erro como resultado da tool.
   */
  private async resolveParsedToolCalls(
    pendingToolCalls: Map<number, PendingToolCallState>,
    toolsByName: Map<string, AgentTool>,
    config: CappyConfig,
  ): Promise<ToolCall[]> {
    const orderedEntries = [...pendingToolCalls.entries()].sort(([a], [b]) => a - b);
    const allowLlmRecovery = config.agent.recoverToolArgumentsWithLlm !== false && !this.runOptions.silent;

    let cachedClient: { client: OpenAI; model: string } | null = null;
    const ensureClient = async (): Promise<{ client: OpenAI; model: string }> => {
      if (!cachedClient) {
        const resolved = await this.getClientAndModel();
        cachedClient = { client: resolved.client, model: resolved.model };
      }
      return cachedClient;
    };

    const out: ToolCall[] = [];
    for (const [index, partial] of orderedEntries) {
      if (!partial.name) {
        throw new Error(`Tool call no indice ${index} nao possui nome.`);
      }
      // Sanitize: some models emit control tokens like <|channel|>commentary after the tool name
      const sanitizedName = partial.name.replace(/<\|.*$/u, "").trim();
      if (!sanitizedName) {
        throw new Error(`Tool call no indice ${index} possui nome invalido: "${partial.name}".`);
      }
      const id = partial.id || `tool_call_${index}`;
      let parsed: Record<string, unknown> | undefined;
      let parseFailureMessage: string | undefined;
      try {
        parsed = parseToolArguments(partial.argumentsText, sanitizedName);
      } catch (firstError) {
        parseFailureMessage = asError(firstError).message;
      }

      if (parsed !== undefined) {
        out.push({ id, name: sanitizedName, arguments: parsed });
        continue;
      }

      let recoveredJson: string | null = null;
      if (allowLlmRecovery) {
        const { client, model } = await ensureClient();
        const toolMeta = toolsByName.get(sanitizedName);
        recoveredJson = await recoverToolArgumentsWithLlm(
          client,
          model,
          sanitizedName,
          partial.argumentsText,
          parseFailureMessage ?? "parse falhou",
          toolMeta?.parameters,
        );
      }

      if (recoveredJson) {
        try {
          parsed = parseToolArguments(recoveredJson, partial.name);
          out.push({ id, name: partial.name, arguments: parsed });
          continue;
        } catch (secondError) {
          parseFailureMessage = `${parseFailureMessage ?? "parse falhou"} | recuperacao LLM: ${asError(secondError).message}`;
        }
      }

      out.push({
        id,
        name: partial.name,
        arguments: {},
        argumentsParseError: parseFailureMessage ?? "Falha ao interpretar argumentos JSON.",
        rawArgumentsText: partial.argumentsText,
      });
    }

    return out;
  }

  /**
   * Resolves OpenRouter client and model from workspace config.
   */
  private async getClientAndModel(): Promise<{ client: OpenAI; model: string; visionModel: string }> {
    if (this.client && this.model && this.visionModel) {
      return { client: this.client, model: this.model, visionModel: this.visionModel };
    }

    const config = await loadConfig();
    if (config.openrouter.apiKey.trim().length === 0) {
      throw new Error('Campo "openrouter.apiKey" invalido em ~/.cappy/config.json.');
    }
    if (config.openrouter.model.trim().length === 0) {
      throw new Error('Campo "openrouter.model" invalido em ~/.cappy/config.json.');
    }

    this.client = new OpenAI({
      apiKey: config.openrouter.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.model = config.openrouter.model;
    this.visionModel = config.openrouter.visionModel;
    return { client: this.client, model: this.model, visionModel: this.visionModel };
  }

  /**
   * Checks whether one tool requires explicit user confirmation.
   */
  private isDestructiveTool(toolName: string): boolean {
    if (DESTRUCTIVE_TOOL_SET.has(toolName)) {
      return true;
    }

    const normalizedToolName = toolName.toLowerCase();
    return MCP_DESTRUCTIVE_KEYWORDS.some((keyword) => normalizedToolName.includes(keyword));
  }

  /**
   * Returns true when the tool has no side-effects and is safe to run in parallel / cache.
   * For MCP tools: readonly if not matching any destructive keyword.
   */
  private isReadonlyTool(toolName: string): boolean {
    if (READONLY_TOOL_NAMES.has(toolName)) {
      return true;
    }
    // MCP tools: readonly if not destructive
    return !this.isDestructiveTool(toolName);
  }

  /**
   * Merges native tools with MCP tools exposed through callback execution.
   */
  private mergeTools(nativeTools: AgentTool[], mcpTools: McpTool[]): AgentTool[] {
    const mappedMcpTools = mcpTools.map<AgentTool>((tool) => ({
      name: formatMcpToolName(tool.serverName, tool.name),
      description: tool.description,
      parameters: toAgentToolSchema(tool.inputSchema),
      execute: async (params) => {
        if (!this.onMcpCall) {
          throw new Error("Callback MCP nao configurado.");
        }
        return this.onMcpCall(tool.serverName, tool.name, params);
      },
    }));

    return [...nativeTools, ...mappedMcpTools];
  }

  /**
   * Emits confirmation event and waits for approve/reject resolution.
   */
  private confirm(toolCall: ToolCall): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingConfirmations.set(toolCall.id, resolve);
      this.emitEvent("tool:confirm", toolCall);
    });
  }

  /**
   * Cenário do cli-mock (`@mock:…`): emite `tool:confirm` e aguarda aprovação na UI sem passar pelo LLM.
   *
   * @returns `true` se o utilizador aprovou, `false` se rejeitou ou `abort()`.
   */
  public async requestDestructiveConfirmationMock(toolCall: ToolCall): Promise<boolean> {
    return await this.confirm(toolCall);
  }

  /**
   * Internal typed event emitter helper.
   */
  private emitEvent<K extends keyof AgentEvents>(
    eventName: K,
    ...args: Parameters<AgentEvents[K]>
  ): void {
    super.emit(eventName, ...args);
  }
}

/**
 * Backward-compatible facade that executes the new loop and returns final assistant text.
 */
export async function runAgentLoop(messages: Message[], tools: ToolDefinition[]): Promise<string> {
  if (messages.length === 0) {
    return "";
  }

  const loop = new AgentLoop();
  const normalizedTools = tools as unknown as AgentTool[];
  const history = await loop.run(messages, normalizedTools);
  const lastAssistantMessage = [...history]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.length > 0);

  return lastAssistantMessage?.content ?? "";
}

/**
 * Removes inconsistencies from the message history to prevent API 400 errors.
 * Handles three cases:
 * 1. Tool messages without tool_call_id (orphan results).
 * 2. Tool results whose tool_call_id has no corresponding call in any assistant message.
 * 3. Tool calls in assistant messages that have no corresponding tool result (e.g. after
 *    a HITL rejection mid-batch — the assistant message was pushed before confirmation).
 */
function sanitizeHistory(messages: Message[]): Message[] {
  // Collect IDs that have a tool result in history
  const resolvedIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "tool" && msg.tool_call_id) {
      resolvedIds.add(msg.tool_call_id);
    }
  }
  // Collect IDs that are referenced by assistant tool_calls
  const requestedIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        requestedIds.add(tc.id);
      }
    }
  }

  const result: Message[] = [];
  for (const msg of messages) {
    // Drop orphan tool messages (no tool_call_id)
    if (msg.role === "tool" && !msg.tool_call_id) {
      continue;
    }
    // Drop tool results whose call doesn't exist in any assistant message
    if (msg.role === "tool" && msg.tool_call_id && !requestedIds.has(msg.tool_call_id)) {
      continue;
    }
    // For assistant messages: strip tool_calls that were never resolved (rejected / aborted mid-batch)
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      const completeCalls = msg.tool_calls.filter((tc) => resolvedIds.has(tc.id));
      if (completeCalls.length === 0) {
        // No completed calls — keep message text but drop the tool_calls array
        const { tool_calls: _dropped, ...rest } = msg;
        result.push(rest as Message);
      } else if (completeCalls.length !== msg.tool_calls.length) {
        // Partial completion — keep only the resolved calls
        result.push({ ...msg, tool_calls: completeCalls });
      } else {
        result.push(msg);
      }
      continue;
    }
    result.push(msg);
  }
  return result;
}

/**
 * Returns a copy of the message with images removed.
 */
function stripImages(message: Message): Message {
  if (!message.images || message.images.length === 0) {
    return message;
  }
  const { images, ...rest } = message;
  return rest as Message;
}

/**
 * Converts internal message format into OpenAI-compatible message param.
 */
function toChatMessage(message: Message): ChatCompletionMessageParam {
  if (message.role === "tool") {
    if (!message.tool_call_id) {
      throw new Error("Mensagem com role 'tool' precisa de tool_call_id.");
    }
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.tool_call_id,
    };
  }

  if (message.role === "assistant") {
    const assistantToolCalls = message.tool_calls?.map((toolCall) => ({
      id: toolCall.id,
      type: "function" as const,
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }));

    return {
      role: "assistant",
      content: message.content,
      ...(assistantToolCalls ? { tool_calls: assistantToolCalls } : {}),
    };
  }

  return buildUserMessage(message);
}

/**
 * Builds an OpenAI-compatible user message, supporting optional image attachments.
 */
function buildUserMessage(message: Message): ChatCompletionMessageParam {
  if (!message.images || message.images.length === 0) {
    return {
      role: "user",
      content: message.content,
    };
  }

  const parts: ChatCompletionContentPart[] = [];
  if (message.content.length > 0) {
    parts.push({ type: "text", text: message.content });
  }
  for (const img of message.images) {
    parts.push({
      type: "image_url",
      image_url: { url: img.dataUrl, detail: "auto" },
    });
  }
  return {
    role: "user",
    content: parts,
  };
}

/**
 * Converts local tool contracts into OpenAI function-tool definitions.
 */
function toChatTool(tool: AgentTool): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/**
 * Formats one MCP tool into a unique tool name for model calls.
 */
function formatMcpToolName(serverName: string, toolName: string): string {
  return `${serverName}__${toolName}`;
}

/**
 * Produces a deterministic JSON key for tool arguments by sorting object keys recursively.
 * Ensures {a:1,b:2} and {b:2,a:1} map to the same cache key.
 */
function stableJsonKey(args: Record<string, unknown>): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(sortKeys);
    }
    if (value !== null && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortKeys(obj[k])]));
    }
    return value;
  };
  return JSON.stringify(sortKeys(args));
}

/**
 * Serializes tool execution result for history/event payloads.
 */
function serializeToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (isRecord(result) && result.fileDiff && isRecord(result.fileDiff)) {
    const fd = result.fileDiff as unknown as FileDiffPayload;
    const slim: Record<string, unknown> = {
      ok: result.ok,
      path: fd.path,
      additions: fd.additions,
      deletions: fd.deletions,
    };
    if (typeof result.replacements === "number") {
      slim.replacements = result.replacements;
    }
    return JSON.stringify(slim);
  }
  return JSON.stringify(result);
}

/**
 * Pulls rich diff payload for the webview (not sent in full to the model transcript).
 */
function extractFileDiffPayload(result: unknown): FileDiffPayload | undefined {
  if (!isRecord(result) || !result.fileDiff || !isRecord(result.fileDiff)) {
    return undefined;
  }
  return result.fileDiff as unknown as FileDiffPayload;
}

/**
 * Converts generic MCP input schema into AgentTool schema contract.
 */
function toAgentToolSchema(schema: Record<string, unknown>): AgentTool["parameters"] {
  if (typeof schema.type === "string" && schema.type === "object" && isRecord(schema.properties)) {
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : undefined;

    return {
      ...schema,
      type: "object",
      properties: schema.properties,
      ...(required ? { required } : {}),
    };
  }

  return {
    type: "object",
    properties: {},
  };
}

/**
 * Trunca texto longo para o eco de argumentos brutos nas mensagens de tool.
 */
function truncateToolArgsSnippet(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  const head = Math.max(32, Math.floor(maxChars / 2) - 2);
  const tail = maxChars - head - 3;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

/**
 * Parses model-provided function arguments into a JSON object.
 */
function parseToolArguments(argumentsText: string, toolName: string): Record<string, unknown> {
  const trimmedArguments = normalizeSmartQuotes(argumentsText).trim();
  if (trimmedArguments.length === 0) {
    return {};
  }

  const candidateJsonChunks = collectJsonCandidates(trimmedArguments);
  const triedJson = new Set<string>();
  for (const candidateJson of candidateJsonChunks) {
    for (const variant of [candidateJson, repairCommonJsonIssues(candidateJson)]) {
      if (triedJson.has(variant)) {
        continue;
      }
      triedJson.add(variant);
      try {
        const parsed = JSON.parse(variant) as unknown;
        if (isRecord(parsed)) {
          const name = toolName.toLowerCase();
          if (name === "grep" || name === "glob") {
            const kind = name === "grep" ? "grep" : "glob";
            const merged = mergeNestedPatternArgs(parsed);
            if (coerceSearchPattern(merged, kind).length === 0) {
              continue;
            }
            return merged;
          }
          return parsed;
        }
      } catch {
        // Try next variant.
      }
    }
  }

  const fallbackArguments = inferFallbackArguments(trimmedArguments, toolName);
  if (fallbackArguments) {
    return fallbackArguments;
  }

  throw new Error(`Argumentos JSON invalidos para tool "${toolName}".`);
}

/**
 * Substitui aspas curvas tipográficas por ASCII para o JSON.parse aceitar.
 */
function normalizeSmartQuotes(text: string): string {
  return text.replace(/\u201c|\u201d/gu, '"').replace(/\u2018|\u2019/gu, "'");
}

/**
 * Narrows unknown values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalizes unknown throwables into Error instances.
 */
function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  const description = typeof error === "string" ? error : "Erro desconhecido no loop do agente.";
  return new Error(description);
}

/**
 * Removes vírgulas finais antes de `}` ou `]` (erro comum em JSON gerado por LLMs).
 */
function repairCommonJsonIssues(json: string): string {
  return json.replace(/,\s*([}\]])/gu, "$1");
}

/**
 * Extrai o primeiro objecto JSON com chaves balanceadas (respeita `{`/`}` dentro de strings).
 */
function extractBalancedJsonObject(rawArguments: string): string | null {
  const start = rawArguments.indexOf("{");
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < rawArguments.length; i++) {
    const c = rawArguments[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return rawArguments.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Builds JSON parse candidates from raw tool argument text.
 */
function collectJsonCandidates(rawArguments: string): string[] {
  const direct = rawArguments.trim();
  const withoutCodeFence = stripCodeFence(direct);
  const objectSlice = extractJsonObjectSlice(withoutCodeFence);
  const balancedSlice = extractBalancedJsonObject(withoutCodeFence);
  const uniqueCandidates = new Set<string>();

  if (direct.length > 0) {
    uniqueCandidates.add(direct);
  }
  if (withoutCodeFence.length > 0) {
    uniqueCandidates.add(withoutCodeFence);
  }
  if (objectSlice && objectSlice.length > 0) {
    uniqueCandidates.add(objectSlice);
  }
  if (balancedSlice && balancedSlice.length > 0) {
    uniqueCandidates.add(balancedSlice);
  }

  return [...uniqueCandidates];
}

/**
 * Removes markdown fences from argument text.
 */
function stripCodeFence(rawArguments: string): string {
  const normalized = rawArguments.trim();
  if (!normalized.startsWith("```")) {
    return normalized;
  }
  return normalized
    .replace(/^```[a-zA-Z]*\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

/**
 * Extracts first JSON-like object slice from mixed text.
 */
function extractJsonObjectSlice(rawArguments: string): string | null {
  const firstBrace = rawArguments.indexOf("{");
  const lastBrace = rawArguments.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }
  return rawArguments.slice(firstBrace, lastBrace + 1).trim();
}

/**
 * Infers valid arguments for common tools from non-JSON text.
 */
function inferFallbackArguments(rawArguments: string, toolName: string): Record<string, unknown> | null {
  const cleaned = rawArguments.trim();
  if (cleaned.length === 0) {
    return null;
  }

  const normalizedToolName = toolName.toLowerCase();
  if (normalizedToolName === "listdir" || normalizedToolName === "readfile") {
    const pathValue = inferSingleTextValue(cleaned);
    return pathValue ? { path: pathValue } : null;
  }
  if (normalizedToolName === "searchcode") {
    const queryValue = inferSingleTextValue(cleaned);
    return queryValue ? { query: queryValue } : null;
  }
  if (normalizedToolName === "runterminal") {
    const commandValue = inferSingleTextValue(cleaned);
    return commandValue ? { command: commandValue } : null;
  }
  if (normalizedToolName === "grep" || normalizedToolName === "glob") {
    return inferGrepOrGlobArguments(cleaned);
  }

  return null;
}

/**
 * Extrai `pattern` / `path` / `glob` quando o modelo envia pseudo-JSON (chave `pattern` sem aspas, etc.).
 */
function inferLooseGrepPatternObject(cleaned: string): Record<string, unknown> | null {
  const unquoted =
    cleaned.match(/\bpattern\s*:\s*"((?:\\.|[^"\\])*)"/su) ??
    cleaned.match(/\bpattern\s*:\s*'((?:\\.|[^'\\])*)'/su);
  if (unquoted?.[1] !== undefined && unquoted[1].length > 0) {
    const pattern = unquoted[1]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/gu, '"')
      .replace(/\\\\/gu, "\\");
    const out: Record<string, unknown> = { pattern };
    const pathM = cleaned.match(/\bpath\s*:\s*"((?:\\.|[^"\\])*)"/su);
    if (pathM?.[1]) {
      out.path = pathM[1].replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
    }
    const globM = cleaned.match(/\bglob\s*:\s*"((?:\\.|[^"\\])*)"/su);
    if (globM?.[1]) {
      out.glob = globM[1].replace(/\\"/gu, '"');
    }
    return out;
  }

  const nestedArguments = cleaned.match(
    /\barguments\s*:\s*\{[\s\S]*?"pattern"\s*:\s*"((?:\\.|[^"\\])*)"/su,
  );
  if (nestedArguments?.[1] !== undefined && nestedArguments[1].length > 0) {
    return {
      pattern: nestedArguments[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/gu, '"')
        .replace(/\\\\/gu, "\\"),
    };
  }

  return null;
}

/**
 * Recupera `{ pattern, path? }` quando o JSON da tool Grep/Glob veio partido ou usa `regex`/`query` em vez de `pattern`.
 */
function inferGrepOrGlobArguments(cleaned: string): Record<string, unknown> | null {
  const patternKeyCandidates = ["pattern", "Pattern", "regex", "regexp", "query", "search", "q"];

  for (const field of patternKeyCandidates) {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const rich = cleaned.match(new RegExp(`"${escapedField}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "su"));
    if (rich?.[1] !== undefined && rich[1].length > 0) {
      const pattern = rich[1]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/gu, '"')
        .replace(/\\\\/gu, "\\");
      const out: Record<string, unknown> = { pattern };
      const pathRich = cleaned.match(/"path"\s*:\s*"((?:\\.|[^"\\])*)"/su);
      if (pathRich?.[1]) {
        out.path = pathRich[1].replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
      }
      const globRich = cleaned.match(/"glob"\s*:\s*"((?:\\.|[^"\\])*)"/su);
      if (globRich?.[1]) {
        out.glob = globRich[1].replace(/\\"/gu, '"');
      }
      return out;
    }
  }

  const singleQuotedPattern = cleaned.match(/'pattern'\s*:\s*'((?:\\.|[^'\\])*)'/su);
  if (singleQuotedPattern?.[1] !== undefined && singleQuotedPattern[1].length > 0) {
    return { pattern: singleQuotedPattern[1].replace(/\\'/gu, "'") };
  }

  for (const field of patternKeyCandidates) {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const simple = cleaned.match(new RegExp(`"${escapedField}"\\s*:\\s*"([^"]*)"`, "u"));
    if (simple?.[1] !== undefined && simple[1].length > 0) {
      return { pattern: simple[1] };
    }
  }

  const looseObject = inferLooseGrepPatternObject(cleaned);
  if (looseObject) {
    return looseObject;
  }

  if (!cleaned.includes("{")) {
    const single = inferSingleTextValue(cleaned);
    return single ? { pattern: single } : null;
  }

  return null;
}

/**
 * Attempts to infer one string argument from raw text.
 */
function inferSingleTextValue(rawArguments: string): string | null {
  const quotedMatch = rawArguments.match(/"([^"]+)"|'([^']+)'/u);
  if (quotedMatch) {
    const value = quotedMatch[1] ?? quotedMatch[2];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  const cleaned = rawArguments
    .replace(/^[a-zA-Z0-9_]+\s*:\s*/u, "")
    .replace(/[{}[\]]/gu, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
