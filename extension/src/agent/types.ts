import type { FileDiffPayload } from "../utils/fileDiffPayload";

/**
 * Roles supported by the agent message history.
 */
export type MessageRole = "user" | "assistant" | "tool";

/**
 * One tool invocation requested by the model.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Quando definido, o parse local (e opcionalmente o LLM) falhou; o loop envia erro como resultado da tool. */
  argumentsParseError?: string;
  /** Texto bruto dos argumentos em stream (eco para o modelo corrigir). */
  rawArgumentsText?: string;
}

/**
 * Image attachment sent with a message (base64 data URL).
 */
export interface ImageAttachment {
  dataUrl: string;
  mimeType: string;
}

/**
 * Canonical message format used by the agent loop.
 */
export interface Message {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  images?: ImageAttachment[];
}

/**
 * Events emitted by the agent loop lifecycle.
 */
export interface AgentEvents {
  "stream:token": (token: string) => void;
  "stream:done": () => void;
  /** Non-persisted system notice (e.g. model fallback warnings). Not stored in message history. */
  "stream:system": (message: string) => void;
  "context:usage": (payload: import("./contextBudget").ContextUsagePayload) => void;
  "tool:confirm": (toolCall: ToolCall) => void;
  "tool:executing": (toolCall: ToolCall) => void;
  "tool:result": (toolCall: ToolCall, result: string, fileDiff?: FileDiffPayload) => void;
  "tool:rejected": (toolCall: ToolCall) => void;
  error: (err: Error) => void;
}

/**
 * JSON schema used by function tools.
 */
export interface ToolJsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

/**
 * Tool contract consumed by the agent loop.
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolJsonSchema;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}
