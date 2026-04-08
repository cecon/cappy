import type { IncomingMessage, OutgoingMessage } from "./vscode-bridge";

/**
 * VS Code-like API surface used by the webview bridge.
 */
export interface VsCodeLikeApi {
  postMessage: (message: OutgoingMessage) => void;
}

interface AcquireVsCodeApi {
  (): VsCodeLikeApi;
}

declare global {
  interface Window {
    acquireVsCodeApi?: AcquireVsCodeApi;
  }
}

/**
 * Creates a VS Code API adapter backed by WebSocket for browser dev mode.
 */
export function createWebSocketVsCodeApi(url: string): VsCodeLikeApi {
  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (isIncomingMessage(parsed)) {
      window.postMessage(parsed, "*");
    }
  });

  return {
    postMessage(message: OutgoingMessage) {
      const payload = JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
        return;
      }
      socket.addEventListener(
        "open",
        () => {
          socket.send(payload);
        },
        { once: true },
      );
    },
  };
}

/**
 * Resolves runtime environment:
 * - VS Code webview: use acquireVsCodeApi
 * - Browser dev: fallback to WebSocket mock
 */
export function getVsCodeApiOrMock(): VsCodeLikeApi {
  if (typeof window.acquireVsCodeApi === "function") {
    const vscodeApi = window.acquireVsCodeApi();
    return {
      postMessage(message: OutgoingMessage): void {
        vscodeApi.postMessage(message);
      },
    };
  }
  return createWebSocketVsCodeApi("ws://localhost:3333");
}

/**
 * Narrows unknown values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates runtime websocket payloads against the bridge incoming protocol.
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
    return isToolCall(value.toolCall) && typeof value.result === "string";
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

  return false;
}

/**
 * Validates runtime objects as ToolCall-like payloads.
 */
function isToolCall(value: unknown): boolean {
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
function isCappyConfig(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.openrouter) || !isRecord(value.agent) || !isRecord(value.mcp)) {
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
