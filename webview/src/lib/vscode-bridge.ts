import { getVsCodeApiOrMock } from "./vscode-mock";
import type {
  CappyConfig,
  ChatUiMode,
  ContextUsageSnapshot,
  FileDiffPayload,
  McpTool,
  Message,
  ToolCall,
} from "./types";

/**
 * Outbound messages sent from webview to host.
 */
export type OutgoingMessage =
  | { type: "chat:send"; messages: Message[]; mode?: ChatUiMode }
  | { type: "tool:approve"; toolCallId: string }
  | { type: "tool:reject"; toolCallId: string }
  | { type: "file:open"; path: string }
  | { type: "config:load" }
  | { type: "config:save"; config: CappyConfig }
  | { type: "mcp:list" }
  | { type: "history:load"; sessionId: string };

/**
 * Inbound messages received from host in the webview.
 */
export type IncomingMessage =
  | { type: "stream:token"; token: string }
  | { type: "stream:done" }
  | { type: "tool:confirm"; toolCall: ToolCall }
  | { type: "tool:executing"; toolCall: ToolCall }
  | { type: "tool:result"; toolCall: ToolCall; result: string; fileDiff?: FileDiffPayload }
  | { type: "tool:rejected"; toolCall: ToolCall }
  | { type: "config:loaded"; config: CappyConfig }
  | { type: "config:saved" }
  | { type: "mcp:tools"; tools: McpTool[] }
  | ({ type: "context:usage" } & ContextUsageSnapshot)
  | { type: "error"; message: string };

/**
 * Bridge contract used by the webview UI.
 */
export interface Bridge {
  send(message: OutgoingMessage): void;
  onMessage(handler: (message: IncomingMessage) => void): void;
}

const vscodeApi = getVsCodeApiOrMock();
const incomingHandlers = new Set<(message: IncomingMessage) => void>();
let isSubscribed = false;

/**
 * Returns the runtime bridge implementation.
 */
export function getBridge(): Bridge {
  ensureWindowSubscription();
  return {
    send(message: OutgoingMessage): void {
      vscodeApi.postMessage(message);
    },
    onMessage(handler: (message: IncomingMessage) => void): void {
      incomingHandlers.add(handler);
    },
  };
}

/**
 * Subscribes once to browser window messages and dispatches typed events.
 */
function ensureWindowSubscription(): void {
  if (isSubscribed) {
    return;
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (!isIncomingMessage(event.data)) {
      return;
    }
    const incomingMessage = event.data;
    incomingHandlers.forEach((handler) => {
      handler(incomingMessage);
    });
  });

  isSubscribed = true;
}

/**
 * Narrows unknown values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates incoming host messages against the bridge protocol.
 */
function isIncomingMessage(value: unknown): value is IncomingMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "stream:token") {
    return typeof value.token === "string";
  }

  if (value.type === "stream:done") {
    return true;
  }

  if (value.type === "tool:confirm" || value.type === "tool:executing" || value.type === "tool:rejected") {
    return isToolCall(value.toolCall);
  }

  if (value.type === "tool:result") {
    return (
      isToolCall(value.toolCall) &&
      typeof value.result === "string" &&
      (value.fileDiff === undefined || isFileDiffPayload(value.fileDiff))
    );
  }

  if (value.type === "error") {
    return typeof value.message === "string";
  }

  if (value.type === "config:loaded") {
    return isCappyConfig(value.config);
  }

  if (value.type === "config:saved") {
    return true;
  }

  if (value.type === "mcp:tools") {
    return Array.isArray(value.tools) && value.tools.every((tool) => isMcpTool(tool));
  }

  if (value.type === "context:usage") {
    return (
      typeof value.usedTokens === "number" &&
      typeof value.limitTokens === "number" &&
      typeof value.effectiveInputBudgetTokens === "number" &&
      typeof value.didTrimForApi === "boolean" &&
      typeof value.droppedMessageCount === "number"
    );
  }

  return false;
}

/**
 * Validates optional file diff payload from the extension host.
 */
function isFileDiffPayload(value: unknown): value is FileDiffPayload {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.path !== "string" || typeof value.additions !== "number" || typeof value.deletions !== "number") {
    return false;
  }
  if (!Array.isArray(value.hunks)) {
    return false;
  }
  return value.hunks.every(
    (hunk) =>
      isRecord(hunk) &&
      Array.isArray(hunk.lines) &&
      hunk.lines.every(
        (line) =>
          isRecord(line) &&
          (line.type === "context" || line.type === "add" || line.type === "del") &&
          typeof line.text === "string",
      ),
  );
}

/**
 * Validates a runtime object as ToolCall.
 */
function isToolCall(value: unknown): value is ToolCall {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isRecord(value.arguments)
  );
}

/**
 * Validates runtime payloads as CappyConfig.
 */
function isCappyConfig(value: unknown): value is CappyConfig {
  if (!isRecord(value) || !isRecord(value.openrouter) || !isRecord(value.agent) || !isRecord(value.mcp)) {
    return false;
  }
  const or = value.openrouter;
  if (
    or.contextWindowTokens !== undefined &&
    (typeof or.contextWindowTokens !== "number" || or.contextWindowTokens < 4096)
  ) {
    return false;
  }
  if (
    or.reservedOutputTokens !== undefined &&
    (typeof or.reservedOutputTokens !== "number" || or.reservedOutputTokens < 256)
  ) {
    return false;
  }
  return (
    typeof value.openrouter.apiKey === "string" &&
    typeof value.openrouter.model === "string" &&
    typeof value.agent.systemPrompt === "string" &&
    typeof value.agent.maxIterations === "number" &&
    Array.isArray(value.mcp.servers) &&
    value.mcp.servers.every(
      (server) => isRecord(server) && typeof server.name === "string" && typeof server.url === "string",
    )
  );
}

/**
 * Validates runtime payloads as McpTool.
 */
function isMcpTool(value: unknown): value is McpTool {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.serverName === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string"
  );
}
