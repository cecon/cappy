import { readFile } from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";

import OpenAI from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import type { McpTool } from "../mcp/client";
import type { ToolDefinition } from "../tools";
import type { AgentEvents, AgentTool, Message, ToolCall } from "./types";

/**
 * Tools that require explicit user confirmation before execution.
 */
const DESTRUCTIVE_TOOLS = ["writeFile", "runTerminal"] as const;
const MCP_DESTRUCTIVE_KEYWORDS = ["write", "delete", "remove", "create", "execute", "run"] as const;

const DESTRUCTIVE_TOOL_SET = new Set<string>(DESTRUCTIVE_TOOLS);

interface PendingToolCallState {
  id: string;
  name: string;
  argumentsText: string;
}

interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

interface CappyConfig {
  openrouter: OpenRouterConfig;
}

interface AgentLoopOptions {
  workspaceRoot?: string;
  onMcpCall?: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<string>;
}

interface AgentRunOptions {
  mcpTools?: McpTool[];
}

/**
 * Event-driven agent loop with OpenRouter streaming support.
 */
export class AgentLoop extends EventEmitter {
  private readonly workspaceRoot: string;

  private readonly configPath: string;

  private readonly onMcpCall?: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<string>;

  private client: OpenAI | null = null;

  private model: string | null = null;

  private readonly pendingConfirmations = new Map<string, (approved: boolean) => void>();

  /**
   * Creates a loop instance bound to one workspace root.
   */
  public constructor(options: AgentLoopOptions = {}) {
    super();
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.configPath = path.join(this.workspaceRoot, ".cappy", "config.json");
    this.onMcpCall = options.onMcpCall;
  }

  /**
   * Typed event subscription for agent lifecycle events.
   */
  public override on<K extends keyof AgentEvents>(eventName: K, listener: AgentEvents[K]): this {
    return super.on(eventName, listener);
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
    const mergedTools = this.mergeTools(tools, options.mcpTools ?? []);
    const history = [...messages];
    const toolsByName = new Map<string, AgentTool>(mergedTools.map((tool) => [tool.name, tool]));

    try {
      while (true) {
        const stream = await this.createStream(history, mergedTools);
        const assistantTextParts: string[] = [];
        const pendingToolCalls = new Map<number, PendingToolCallState>();

        for await (const chunk of stream) {
          this.consumeChunk(chunk, assistantTextParts, pendingToolCalls);
        }

        const assistantContent = assistantTextParts.join("");
        const toolCalls = this.finalizeToolCalls(pendingToolCalls);

        if (toolCalls.length === 0) {
          if (assistantContent.length > 0) {
            history.push({ role: "assistant", content: assistantContent });
          }
          this.emitEvent("stream:done");
          break;
        }

        history.push({
          role: "assistant",
          content: assistantContent,
          tool_calls: toolCalls,
        });

        let wasRejected = false;
        for (const toolCall of toolCalls) {
          const tool = toolsByName.get(toolCall.name);
          if (!tool) {
            throw new Error(`Tool "${toolCall.name}" nao esta registrada.`);
          }

          if (this.isDestructiveTool(toolCall.name)) {
            const approved = await this.confirm(toolCall);
            if (!approved) {
              this.emitEvent("tool:rejected", toolCall);
              wasRejected = true;
              break;
            }
          }

          this.emitEvent("tool:executing", toolCall);
          const result = await tool.execute(toolCall.arguments);
          const serializedResult = serializeToolResult(result);
          this.emitEvent("tool:result", toolCall, serializedResult);
          history.push({
            role: "tool",
            content: serializedResult,
            tool_call_id: toolCall.id,
          });
        }

        if (wasRejected) {
          this.emitEvent("stream:done");
          break;
        }
      }

      return history;
    } catch (error) {
      const normalizedError = asError(error);
      this.emitEvent("error", normalizedError);
      throw normalizedError;
    }
  }

  /**
   * Creates one streaming completion request to OpenRouter.
   */
  private async createStream(messages: Message[], tools: AgentTool[]) {
    const { client, model } = await this.getClientAndModel();
    return client.chat.completions.create({
      model,
      stream: true,
      messages: messages.map((message) => toChatMessage(message)),
      tools: tools.map((tool) => toChatTool(tool)),
    });
  }

  /**
   * Applies one stream chunk to the accumulated text and tool-call buffers.
   */
  private consumeChunk(
    chunk: ChatCompletionChunk,
    assistantTextParts: string[],
    pendingToolCalls: Map<number, PendingToolCallState>,
  ): void {
    const choice = chunk.choices[0];
    if (!choice) {
      return;
    }

    const content = choice.delta.content;
    if (typeof content === "string" && content.length > 0) {
      assistantTextParts.push(content);
      this.emitEvent("stream:token", content);
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
   * Consolidates streamed partial tool-call chunks into complete tool calls.
   */
  private finalizeToolCalls(pendingToolCalls: Map<number, PendingToolCallState>): ToolCall[] {
    const orderedEntries = [...pendingToolCalls.entries()].sort(([a], [b]) => a - b);
    return orderedEntries.map(([index, partial]) => {
      if (!partial.name) {
        throw new Error(`Tool call no indice ${index} nao possui nome.`);
      }
      const parsedArguments = parseToolArguments(partial.argumentsText, partial.name);
      return {
        id: partial.id || `tool_call_${index}`,
        name: partial.name,
        arguments: parsedArguments,
      };
    });
  }

  /**
   * Resolves OpenRouter client and model from workspace config.
   */
  private async getClientAndModel(): Promise<{ client: OpenAI; model: string }> {
    if (this.client && this.model) {
      return { client: this.client, model: this.model };
    }

    const config = await this.readConfig();
    this.client = new OpenAI({
      apiKey: config.openrouter.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.model = config.openrouter.model;
    return { client: this.client, model: this.model };
  }

  /**
   * Reads and validates `.cappy/config.json`.
   */
  private async readConfig(): Promise<CappyConfig> {
    const raw = await readFile(this.configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      throw new Error("Arquivo .cappy/config.json invalido.");
    }
    const openrouter = parsed.openrouter;
    if (!isRecord(openrouter)) {
      throw new Error('Campo "openrouter" ausente em .cappy/config.json.');
    }

    const apiKey = openrouter.apiKey;
    const model = openrouter.model;
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      throw new Error('Campo "openrouter.apiKey" invalido em .cappy/config.json.');
    }
    if (typeof model !== "string" || model.trim().length === 0) {
      throw new Error('Campo "openrouter.model" invalido em .cappy/config.json.');
    }

    return {
      openrouter: {
        apiKey,
        model,
      },
    };
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

  return {
    role: "user",
    content: message.content,
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
 * Serializes tool execution result for history/event payloads.
 */
function serializeToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result);
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
 * Parses model-provided function arguments into a JSON object.
 */
function parseToolArguments(argumentsText: string, toolName: string): Record<string, unknown> {
  const trimmedArguments = argumentsText.trim();
  if (trimmedArguments.length === 0) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedArguments);
  } catch {
    throw new Error(`Argumentos JSON invalidos para tool "${toolName}".`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Argumentos da tool "${toolName}" devem ser um objeto JSON.`);
  }

  return parsed;
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
