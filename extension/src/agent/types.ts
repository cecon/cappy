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
}

/**
 * Canonical message format used by the agent loop.
 */
export interface Message {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * Events emitted by the agent loop lifecycle.
 */
export interface AgentEvents {
  "stream:token": (token: string) => void;
  "stream:done": () => void;
  "tool:confirm": (toolCall: ToolCall) => void;
  "tool:executing": (toolCall: ToolCall) => void;
  "tool:result": (toolCall: ToolCall, result: string) => void;
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
