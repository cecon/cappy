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
 * Política HITL espelhada do host para a UI decidir auto-aprovação (`hitl:policy`).
 */
export interface HitlUiPolicy {
  destructiveTools: "confirm_each" | "allow_all";
  sessionAutoApproveDestructive: boolean;
}

/**
 * Outbound messages sent from webview to host.
 */
export type OutgoingMessage =
  | { type: "chat:send"; messages: Message[]; mode?: ChatUiMode }
  | { type: "chat:stop" }
  /** Pedido ao host para nova sessão (reload do webview na extensão; mock envia `session:cleared`). */
  | { type: "session:new" }
  | { type: "tool:approve"; toolCallId: string }
  | { type: "hitl:approveSession"; toolCallId: string }
  | { type: "hitl:approvePersist"; toolCallId: string }
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
  /** Dev (cli-mock): estado local do chat reposto sem reload da página. */
  | { type: "session:cleared" }
  | { type: "tool:confirm"; toolCall: ToolCall }
  | { type: "tool:executing"; toolCall: ToolCall }
  | { type: "tool:result"; toolCall: ToolCall; result: string; fileDiff?: FileDiffPayload }
  | { type: "tool:rejected"; toolCall: ToolCall }
  | { type: "config:loaded"; config: CappyConfig }
  | { type: "config:saved" }
  | { type: "mcp:tools"; tools: McpTool[] }
  | ({ type: "context:usage" } & ContextUsageSnapshot)
  | { type: "error"; message: string }
  /** Mesmo comando shell que o agente está a executar (Bash / runTerminal). */
  | { type: "agent:shell:start"; command: string; cwd?: string }
  /** Stdout/stderr do mesmo `exec` usado pela tool. */
  | { type: "agent:shell:complete"; command: string; stdout: string; stderr: string; errorText?: string }
  | ({ type: "hitl:policy" } & HitlUiPolicy);

/**
 * Bridge contract used by the webview UI.
 */
export interface Bridge {
  send(message: OutgoingMessage): void;
  /**
   * Regista um handler; devolve função para remover (usar no cleanup do `useEffect`).
   */
  onMessage(handler: (message: IncomingMessage) => void): () => void;
}

/** Superfície mínima compatível com `vscode.postMessage`. */
interface VsCodeLikeApi {
  postMessage(message: OutgoingMessage): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeLikeApi;
  }
}

/**
 * Estado partilhado do bridge no browser (Vite HMR recria módulos; isto mantém
 * uma única ligação WebSocket e um único listener `message` sem depender de hacks por ficheiro).
 */
const BRIDGE_STATE = Symbol.for("@cappy/webview-bridge-state");
/** Garante um único `addEventListener("message")` mesmo com múltiplas avaliações do módulo (HMR / chunks). */
const WINDOW_MESSAGE_FN = Symbol.for("@cappy/webview-bridge-window-message-fn");

interface SharedBridgeState {
  incomingHandlers: Set<(message: IncomingMessage) => void>;
  devSocket: WebSocket | null;
  devApi: VsCodeLikeApi | null;
  wsFailureNotified: boolean;
}

function dispatchIncomingToHandlers(event: MessageEvent<unknown>): void {
  const globalRecord = globalThis as typeof globalThis & Record<symbol, SharedBridgeState | undefined>;
  const current = globalRecord[BRIDGE_STATE];
  if (!current) {
    return;
  }
  if (!isIncomingMessage(event.data)) {
    return;
  }
  const incomingMessage = event.data;
  current.incomingHandlers.forEach((handler) => {
    handler(incomingMessage);
  });
}

/**
 * Um único listener em `window`; o estado actual é lido em tempo de dispatch (compatível com HMR).
 */
function attachWindowMessageListenerOnce(): void {
  const globalRecord = globalThis as typeof globalThis & Record<symbol, unknown>;
  if (typeof globalRecord[WINDOW_MESSAGE_FN] === "function") {
    return;
  }
  const fn = (event: MessageEvent<unknown>): void => {
    dispatchIncomingToHandlers(event);
  };
  globalRecord[WINDOW_MESSAGE_FN] = fn;
  window.addEventListener("message", fn);
}

function getSharedBridgeState(): SharedBridgeState {
  const globalRecord = globalThis as typeof globalThis & Record<symbol, SharedBridgeState | undefined>;
  let state = globalRecord[BRIDGE_STATE];
  if (!state) {
    state = {
      incomingHandlers: new Set(),
      devSocket: null,
      devApi: null,
      wsFailureNotified: false,
    };
    globalRecord[BRIDGE_STATE] = state;
  }
  attachWindowMessageListenerOnce();
  return state;
}

function getCliMockWebSocketUrl(): string {
  const port = import.meta.env.VITE_CAPPY_CLI_MOCK_PORT ?? "3333";
  return `ws://localhost:${port}`;
}

/**
 * Uma única ligação ao cli-mock por aba; reutilizada entre recargas HMR do bundle.
 */
function getOrCreateDevHostApi(shared: SharedBridgeState): VsCodeLikeApi {
  if (shared.devApi && shared.devSocket) {
    const rs = shared.devSocket.readyState;
    /** Evita fechar um socket ainda a ligar quando o módulo é avaliado mais do que uma vez (duplicaria eventos). */
    if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) {
      return shared.devApi;
    }
  }
  if (shared.devSocket) {
    shared.devSocket.close();
    shared.devSocket = null;
    shared.devApi = null;
  }

  const url = getCliMockWebSocketUrl();
  const socket = new WebSocket(url);
  shared.devSocket = socket;

  let hasOpened = false;

  const notifyDevServerMissing = (): void => {
    if (shared.wsFailureNotified || hasOpened) {
      return;
    }
    shared.wsFailureNotified = true;
    window.postMessage(
      {
        type: "error",
        message: `Sem ligação ao cli-mock em ${url}. Na raiz do repo execute \`pnpm dev\` (inicia webview + cli-mock) ou noutro terminal \`pnpm dev:mock\`.`,
      } satisfies IncomingMessage,
      "*",
    );
  };

  socket.addEventListener("message", (event) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!isIncomingMessage(parsed)) {
      return;
    }
    window.postMessage(parsed, "*");
  });

  socket.addEventListener("open", () => {
    hasOpened = true;
  });

  socket.addEventListener("error", notifyDevServerMissing);
  socket.addEventListener("close", () => {
    if (socket !== shared.devSocket) {
      return;
    }
    if (!hasOpened) {
      notifyDevServerMissing();
    }
  });

  const api: VsCodeLikeApi = {
    postMessage(message: OutgoingMessage): void {
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
  shared.devApi = api;
  return api;
}

function resolveHostApi(shared: SharedBridgeState): VsCodeLikeApi {
  if (typeof window.acquireVsCodeApi === "function") {
    const vscodeApi = window.acquireVsCodeApi();
    return {
      postMessage(message: OutgoingMessage): void {
        vscodeApi.postMessage(message);
      },
    };
  }
  return getOrCreateDevHostApi(shared);
}

const sharedBridge = getSharedBridgeState();
const vscodeApi = resolveHostApi(sharedBridge);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const globalRecord = globalThis as typeof globalThis & Record<symbol, SharedBridgeState | undefined> &
      Record<symbol, unknown>;
    const state = globalRecord[BRIDGE_STATE];
    const fn = globalRecord[WINDOW_MESSAGE_FN];
    if (typeof fn === "function") {
      window.removeEventListener("message", fn as (event: MessageEvent<unknown>) => void);
    }
    delete globalRecord[WINDOW_MESSAGE_FN];
    if (!state) {
      return;
    }
    state.incomingHandlers.clear();
    if (state.devSocket) {
      state.devSocket.close();
      state.devSocket = null;
    }
    state.devApi = null;
    delete globalRecord[BRIDGE_STATE];
  });
}

/**
 * Returns the runtime bridge implementation.
 */
export function getBridge(): Bridge {
  const host = getSharedBridgeState();
  return {
    send(message: OutgoingMessage): void {
      vscodeApi.postMessage(message);
    },
    onMessage(handler: (message: IncomingMessage) => void): () => void {
      host.incomingHandlers.add(handler);
      return () => {
        host.incomingHandlers.delete(handler);
      };
    },
  };
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

  if (value.type === "session:cleared") {
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

  if (value.type === "agent:shell:start") {
    return typeof value.command === "string" && (value.cwd === undefined || typeof value.cwd === "string");
  }

  if (value.type === "agent:shell:complete") {
    return (
      typeof value.command === "string" &&
      typeof value.stdout === "string" &&
      typeof value.stderr === "string" &&
      (value.errorText === undefined || typeof value.errorText === "string")
    );
  }

  if (value.type === "hitl:policy") {
    return (
      (value.destructiveTools === "confirm_each" || value.destructiveTools === "allow_all") &&
      typeof value.sessionAutoApproveDestructive === "boolean"
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
