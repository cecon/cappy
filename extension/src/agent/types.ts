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

/** Payload broadcast whenever plan mode is entered, updated, or exited. */
export interface PlanStatePayload {
  active: boolean;
  filePath: string | null;
  content: string | null;
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
  /** Emitted after EnterPlanMode, PlanWrite, or ExitPlanMode to sync the webview plan panel. */
  "plan:state": (payload: PlanStatePayload) => void;
  error: (err: Error) => void;
}

/** One stage in a pipeline — maps to a single AgentLoop run. */
export interface PipelineStage {
  id: string;
  name: string;
  /** Extra instruction appended to the system prompt for this stage only. */
  systemPromptSuffix?: string;
  /** If set, only these tool names are available (whitelist overrides blockedTools). */
  allowedTools?: string[];
  /** Tools excluded from this stage (blacklist). Ignored when allowedTools is present. */
  blockedTools?: string[];
  /** When true, the runner pauses after this stage and waits for `pipeline:advance` before continuing. */
  requiresApproval?: boolean;
  /** Max LLM rounds for this stage (undefined = config default). */
  maxIterations?: number;
}

/** An ordered sequence of stages that the PipelineRunner executes end-to-end. */
export interface PipelineDefinition {
  id: string;
  name: string;
  stages: PipelineStage[];
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
