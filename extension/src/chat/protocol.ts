/**
 * Wire protocol shared by:
 *  - VS Code extension host  (src/chat/*)
 *  - Webview  (webview-src/*)
 *  - Cappy CLI in --rpc mode  (future, cli/src)
 *
 * Each layer translates to/from the next:
 *   webview ⇄ extension : postMessage envelopes (this file)
 *   extension ⇄ CLI     : same shape over stdio NDJSON (also this file)
 */

export type PermissionMode = "confirm_each" | "allow_all" | "deny_all";

export interface MentionRef {
  uri: string;
  label: string;
  range?: { startLine: number; endLine: number };
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  id: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  createdAt: number;
  toolCalls?: ToolCall[];
  toolResultFor?: string;
}

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: string | null;
  messageCount: number;
}

/* ── Webview → Extension ─────────────────────────────────────────────────── */

export type WebviewToHost =
  | { type: "ready" }
  | { type: "user.message"; sessionId: string | null; text: string; mentions: MentionRef[] }
  | { type: "session.new" }
  | { type: "session.resume"; sessionId: string }
  | { type: "session.list" }
  | { type: "session.delete"; sessionId: string }
  | { type: "hitl.response"; toolCallId: string; approved: boolean }
  | { type: "abort"; sessionId: string }
  | { type: "diff.accept"; uri: string }
  | { type: "diff.reject"; uri: string }
  | { type: "mention.search"; query: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };

/* ── Extension → Webview ─────────────────────────────────────────────────── */

export type HostToWebview =
  | { type: "init"; sessionId: string | null; sessions: SessionMeta[]; settings: WebviewSettings }
  | { type: "settings.update"; settings: WebviewSettings }
  | { type: "session.opened"; sessionId: string; history: ChatMessage[] }
  | { type: "session.list"; sessions: SessionMeta[] }
  | { type: "stream.start"; messageId: string }
  | { type: "stream.delta"; messageId: string; text: string }
  | { type: "stream.tool"; messageId: string; tool: ToolCall }
  | { type: "stream.toolResult"; messageId: string; result: ToolResult }
  | { type: "stream.end"; messageId: string }
  | { type: "hitl.request"; toolCallId: string; tool: ToolCall }
  | { type: "diff.proposed"; uri: string }
  | { type: "diff.cleared"; uri: string }
  | { type: "mention.results"; query: string; results: MentionRef[] }
  | { type: "command.focus" }
  | { type: "command.blur" }
  | { type: "command.newConversation" }
  | { type: "command.insertAtMention"; ref: MentionRef }
  | { type: "error"; message: string };

export interface WebviewSettings {
  useCtrlEnterToSend: boolean;
  preferredLocation: "sidebar" | "panel";
  permissionMode: PermissionMode;
}
