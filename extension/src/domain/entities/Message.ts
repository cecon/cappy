/**
 * Core message and tool-call entities — zero external dependencies.
 * Single source of truth shared across extension and adapters.
 */

export type MessageRole = "user" | "assistant" | "tool";

/** One tool invocation streamed by the model. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Set when local JSON parse failed; loop reports error as tool result. */
  argumentsParseError?: string;
  /** Raw streamed argument text used for LLM-based recovery. */
  rawArgumentsText?: string;
}

/** Base64 image attached to a user message (vision support). */
export interface ImageAttachment {
  dataUrl: string;
  mimeType: string;
}

/** One line in a compact diff card rendered in the webview. */
export interface DiffLine {
  type: "context" | "add" | "del";
  text: string;
}

/** Serialisable diff summary produced by Write/Edit tools. */
export interface FileDiffPayload {
  path: string;
  additions: number;
  deletions: number;
  hunks: Array<{ lines: DiffLine[] }>;
}

/** Canonical message used throughout the agent pipeline. */
export interface Message {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  images?: ImageAttachment[];
  /** Populated by file-mutation tools for webview diff cards. */
  fileDiff?: FileDiffPayload;
}
