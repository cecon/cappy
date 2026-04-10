import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import {
  getLastUserText,
  matchMockScenario,
  nextMockToolCallId,
  type MockKeywordScenario,
} from "./mock-keywords.js";

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

interface CappyConfig {
  openrouter: {
    apiKey: string;
    model: string;
  };
  agent: {
    systemPrompt: string;
    maxIterations: number;
  };
  mcp: {
    servers: Array<{ name: string; url: string }>;
  };
}

interface AgentLoopLike {
  run(
    messages: Message[],
    tools: AgentTool[],
    options?: { mcpTools?: McpTool[]; chatMode?: ChatUiMode },
  ): Promise<Message[]>;
  abort(): void;
  approve(toolCallId: string): boolean;
  approveSessionAutoDestructive(toolCallId: string): boolean;
  persistAllowAllDestructive(toolCallId: string): Promise<boolean>;
  reject(toolCallId: string): boolean;
  /** Cenários `@mock:hitl` / `@mock:write` — HITL sem LLM. */
  requestDestructiveConfirmationMock(toolCall: ToolCall): Promise<boolean>;
  on(eventName: "stream:token", listener: (token: string) => void): this;
  on(eventName: "stream:done", listener: () => void): this;
  on(eventName: "tool:confirm", listener: (toolCall: ToolCall) => void): this;
  on(eventName: "tool:executing", listener: (toolCall: ToolCall) => void): this;
  on(
    eventName: "tool:result",
    listener: (toolCall: ToolCall, result: string, fileDiff?: unknown) => void,
  ): this;
  on(eventName: "tool:rejected", listener: (toolCall: ToolCall) => void): this;
  on(
    eventName: "context:usage",
    listener: (payload: {
      usedTokens: number;
      limitTokens: number;
      effectiveInputBudgetTokens: number;
      didTrimForApi: boolean;
      droppedMessageCount: number;
    }) => void,
  ): this;
  on(eventName: "error", listener: (error: Error) => void): this;
  off(eventName: "stream:token", listener: (token: string) => void): this;
  off(eventName: "stream:done", listener: () => void): this;
  off(eventName: "tool:confirm", listener: (toolCall: ToolCall) => void): this;
  off(eventName: "tool:executing", listener: (toolCall: ToolCall) => void): this;
  off(
    eventName: "tool:result",
    listener: (toolCall: ToolCall, result: string, fileDiff?: unknown) => void,
  ): this;
  off(eventName: "tool:rejected", listener: (toolCall: ToolCall) => void): this;
  off(
    eventName: "context:usage",
    listener: (payload: {
      usedTokens: number;
      limitTokens: number;
      effectiveInputBudgetTokens: number;
      didTrimForApi: boolean;
      droppedMessageCount: number;
    }) => void,
  ): this;
  off(eventName: "error", listener: (error: Error) => void): this;
}

interface ExtensionToolsModule {
  toolsRegistry: AgentTool[];
}

interface ExtensionLoopModule {
  AgentLoop: new () => AgentLoopLike;
}

interface ExtensionConfigModule {
  loadConfig(workspaceRoot: string): Promise<CappyConfig>;
  saveConfig(workspaceRoot: string, config: CappyConfig): Promise<void>;
}

interface ExtensionAgentPreferencesModule {
  loadAgentPreferences: (workspaceRoot: string) => Promise<{ hitl: { destructiveTools: "confirm_each" | "allow_all" } } | null>;
}

interface McpTool {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpManagerLike {
  connect(servers: CappyConfig["mcp"]["servers"]): Promise<void>;
  listTools(): McpTool[];
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string>;
  disconnect(): Promise<void>;
}

interface ExtensionMcpModule {
  McpManager: new () => McpManagerLike;
}

type ChatUiMode = "plain" | "agent" | "ask";

type IncomingWsMessage =
  | { type: "chat:send"; messages: Message[]; mode?: ChatUiMode }
  | { type: "session:new" }
  | { type: "tool:approve"; toolCallId: string }
  | { type: "hitl:approveSession"; toolCallId: string }
  | { type: "hitl:approvePersist"; toolCallId: string }
  | { type: "tool:reject"; toolCallId: string }
  | { type: "file:open"; path: string }
  | { type: "config:load" }
  | { type: "config:save"; config: CappyConfig }
  | { type: "mcp:list" };

type OutgoingWsMessage =
  | { type: "stream:token"; token: string }
  | { type: "stream:done" }
  | { type: "session:cleared" }
  | { type: "tool:confirm"; toolCall: ToolCall }
  | { type: "tool:executing"; toolCall: ToolCall }
  | { type: "tool:result"; toolCall: ToolCall; result: string; fileDiff?: unknown }
  | { type: "tool:rejected"; toolCall: ToolCall }
  | { type: "agent:shell:start"; command: string; cwd?: string }
  | {
      type: "agent:shell:complete";
      command: string;
      stdout: string;
      stderr: string;
      errorText?: string;
    }
  | { type: "config:loaded"; config: CappyConfig }
  | { type: "config:saved" }
  | { type: "mcp:tools"; tools: McpTool[] }
  | {
      type: "context:usage";
      usedTokens: number;
      limitTokens: number;
      effectiveInputBudgetTokens: number;
      didTrimForApi: boolean;
      droppedMessageCount: number;
    }
  | {
      type: "hitl:policy";
      destructiveTools: "confirm_each" | "allow_all";
      sessionAutoApproveDestructive: boolean;
    }
  | { type: "error"; message: string };

/** Porta HTTP/WebSocket do mock; alinhar com `CAPPY_CLI_MOCK_PORT` no `pnpm dev` (Vite injeta no webview). */
const PORT = Number.parseInt(process.env.CAPPY_CLI_MOCK_PORT ?? process.env.PORT ?? "3333", 10);
const extensionDependenciesPromise = loadExtensionDependencies();

/**
 * Serializes and sends one bridge message to a websocket client.
 */
function sendJson(socket: WebSocket, message: OutgoingWsMessage): void {
  socket.send(JSON.stringify(message));
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "cli-mock" }));
    return;
  }

  if (request.url === "/tools") {
    void respondTools(response);
    return;
  }

  response.writeHead(200, { "content-type": "text/plain" });
  response.end("Cappy cli-mock is running.");
});

const wsServer = new WebSocketServer({ server });

wsServer.on("connection", (socket) => {
  void initializeSocketConnection(socket);
});

function handleListenError(err: NodeJS.ErrnoException): void {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `[cli-mock] Porta ${PORT} já está em uso (outro cli-mock ou processo). Encerre-o, por exemplo:\n` +
        `  lsof -ti :${PORT} | xargs kill\n` +
        `Ou use outra porta na mesma sessão (webview + mock):\n` +
        `  CAPPY_CLI_MOCK_PORT=3334 pnpm dev`,
    );
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.error("[cli-mock] Erro no servidor:", err);
  process.exit(1);
}

/** `listen` pode emitir em `http.Server` e/ou em `WebSocketServer` — regista ambos para evitar unhandled. */
server.on("error", handleListenError);
wsServer.on("error", handleListenError);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`cli-mock listening on http://localhost:${PORT}`);
});

let shuttingDown = false;

/**
 * Fecha clientes WebSocket e o HTTP server para o processo sair de imediato com Ctrl+C
 * (evita "Process didn't exit" do tsx watch).
 */
function shutdown(): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  wsServer.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
  setTimeout(() => {
    process.exit(0);
  }, 2000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

/**
 * Initializes one websocket connection with AgentLoop wiring.
 */
async function initializeSocketConnection(socket: WebSocket): Promise<void> {
  let dependencies: Awaited<typeof extensionDependenciesPromise>;
  try {
    dependencies = await extensionDependenciesPromise;
  } catch {
    sendJson(socket, { type: "error", message: "Falha ao carregar dependencias da extension." });
    return;
  }

  const agentLoop = new dependencies.AgentLoop();
  const mcpManager = new dependencies.McpManager();
  const tools = dependencies.tools;
  const workspaceRoot = process.cwd();
  const hitlUiSessionState = { sessionAutoApproveDestructive: false };

  const pushHitlPolicy = async (): Promise<void> => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const prefs = await dependencies.loadAgentPreferences(workspaceRoot);
    const destructiveTools = prefs?.hitl.destructiveTools ?? "confirm_each";
    sendJson(socket, {
      type: "hitl:policy",
      destructiveTools,
      sessionAutoApproveDestructive: hitlUiSessionState.sessionAutoApproveDestructive,
    });
  };

  const streamTokenListener = (token: string) => {
    sendJson(socket, { type: "stream:token", token });
  };
  const streamDoneListener = () => {
    sendJson(socket, { type: "stream:done" });
  };
  const toolConfirmListener = (toolCall: ToolCall) => {
    sendJson(socket, { type: "tool:confirm", toolCall });
  };
  const toolExecutingListener = (toolCall: ToolCall) => {
    sendJson(socket, { type: "tool:executing", toolCall });
  };
  const toolResultListener = (toolCall: ToolCall, result: string, fileDiff?: unknown) => {
    sendJson(socket, {
      type: "tool:result",
      toolCall,
      result,
      ...(fileDiff !== undefined ? { fileDiff } : {}),
    });
  };
  const toolRejectedListener = (toolCall: ToolCall) => {
    sendJson(socket, { type: "tool:rejected", toolCall });
  };
  const errorListener = (error: Error) => {
    sendJson(socket, { type: "error", message: error.message });
  };
  const contextUsageListener = (payload: {
    usedTokens: number;
    limitTokens: number;
    effectiveInputBudgetTokens: number;
    didTrimForApi: boolean;
    droppedMessageCount: number;
  }) => {
    sendJson(socket, {
      type: "context:usage",
      usedTokens: payload.usedTokens,
      limitTokens: payload.limitTokens,
      effectiveInputBudgetTokens: payload.effectiveInputBudgetTokens,
      didTrimForApi: payload.didTrimForApi,
      droppedMessageCount: payload.droppedMessageCount,
    });
  };

  agentLoop.on("stream:token", streamTokenListener);
  agentLoop.on("stream:done", streamDoneListener);
  agentLoop.on("tool:confirm", toolConfirmListener);
  agentLoop.on("tool:executing", toolExecutingListener);
  agentLoop.on("tool:result", toolResultListener);
  agentLoop.on("tool:rejected", toolRejectedListener);
  agentLoop.on("error", errorListener);
  agentLoop.on("context:usage", contextUsageListener);

  void pushHitlPolicy();

  socket.on("message", (raw) => {
    let message: IncomingWsMessage | undefined;
    try {
      const parsed = JSON.parse(String(raw)) as unknown;
      if (isIncomingWsMessage(parsed)) {
        message = parsed;
      }
    } catch {
      sendJson(socket, { type: "error", message: "Mensagem JSON invalida." });
      return;
    }

    if (!message) {
      sendJson(socket, { type: "error", message: "Formato de mensagem invalido." });
      return;
    }

    if (message.type === "chat:send") {
      const lastUser = getLastUserText(message.messages);
      const mockScenario = matchMockScenario(lastUser);
      if (mockScenario !== null) {
        void runMockKeywordScenario(socket, agentLoop, mockScenario);
        return;
      }
      void runAgentLoop(agentLoop, message.messages, tools, mcpManager.listTools(), socket, message.mode);
      return;
    }

    if (message.type === "session:new") {
      agentLoop.abort();
      hitlUiSessionState.sessionAutoApproveDestructive = false;
      sendJson(socket, { type: "session:cleared" });
      void pushHitlPolicy();
      return;
    }

    if (message.type === "tool:approve") {
      if (!agentLoop.approve(message.toolCallId)) {
        sendJson(socket, {
          type: "error",
          message: `Confirmacao pendente nao encontrada: ${message.toolCallId}`,
        });
      }
      return;
    }

    if (message.type === "config:load") {
      void dependencies
        .loadConfig(workspaceRoot)
        .then(async (config) => {
          await mcpManager.connect(config.mcp.servers);
          sendJson(socket, { type: "config:loaded", config });
          void pushHitlPolicy();
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : "Falha ao carregar configuracao.";
          sendJson(socket, { type: "error", message: errorMessage });
        });
      return;
    }

    if (message.type === "config:save") {
      void dependencies
        .saveConfig(workspaceRoot, message.config)
        .then(async () => {
          await mcpManager.connect(message.config.mcp.servers);
          sendJson(socket, { type: "config:saved" });
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : "Falha ao salvar configuracao.";
          sendJson(socket, { type: "error", message: errorMessage });
        });
      return;
    }

    if (message.type === "mcp:list") {
      sendJson(socket, { type: "mcp:tools", tools: mcpManager.listTools() });
      return;
    }

    if (message.type === "file:open") {
      sendJson(socket, {
        type: "error",
        message: "Abrir ficheiro no editor so funciona na extensao Cappy (VS Code / Cursor).",
      });
      return;
    }

    if (message.type === "tool:reject") {
      if (!agentLoop.reject(message.toolCallId)) {
        sendJson(socket, {
          type: "error",
          message: `Confirmacao pendente nao encontrada: ${message.toolCallId}`,
        });
      }
      return;
    }

    if (message.type === "hitl:approveSession") {
      if (!agentLoop.approveSessionAutoDestructive(message.toolCallId)) {
        sendJson(socket, {
          type: "error",
          message: `Confirmacao pendente nao encontrada: ${message.toolCallId}`,
        });
      } else {
        hitlUiSessionState.sessionAutoApproveDestructive = true;
        void pushHitlPolicy();
      }
      return;
    }

    if (message.type === "hitl:approvePersist") {
      void agentLoop.persistAllowAllDestructive(message.toolCallId).then((ok) => {
        if (!ok && socket.readyState === WebSocket.OPEN) {
          sendJson(socket, {
            type: "error",
            message: `Confirmacao pendente nao encontrada: ${message.toolCallId}`,
          });
        } else if (ok) {
          hitlUiSessionState.sessionAutoApproveDestructive = true;
          void pushHitlPolicy();
        }
      });
      return;
    }
  });

  socket.on("close", () => {
    agentLoop.off("stream:token", streamTokenListener);
    agentLoop.off("stream:done", streamDoneListener);
    agentLoop.off("tool:confirm", toolConfirmListener);
    agentLoop.off("tool:executing", toolExecutingListener);
    agentLoop.off("tool:result", toolResultListener);
    agentLoop.off("tool:rejected", toolRejectedListener);
    agentLoop.off("error", errorListener);
    agentLoop.off("context:usage", contextUsageListener);
    void mcpManager.disconnect();
  });
}

/**
 * Cenários `@mock:…` — emite mensagens WebSocket alinhadas ao bridge, sem LLM.
 */
async function runMockKeywordScenario(
  socket: WebSocket,
  agentLoop: AgentLoopLike,
  scenario: MockKeywordScenario,
): Promise<void> {
  try {
    switch (scenario) {
      case "stream-only": {
        sendJson(socket, { type: "stream:token", token: "[mock:stream] Resposta simulada sem tools.\n" });
        sendJson(socket, { type: "stream:done" });
        return;
      }
      case "context-usage": {
        sendJson(socket, {
          type: "context:usage",
          usedTokens: 4200,
          limitTokens: 128_000,
          effectiveInputBudgetTokens: 120_000,
          didTrimForApi: false,
          droppedMessageCount: 0,
        });
        sendJson(socket, { type: "stream:token", token: "[mock:usage] Snapshot de contexto enviado.\n" });
        sendJson(socket, { type: "stream:done" });
        return;
      }
      case "hitl-shell": {
        const command = "echo 'cli-mock @mock:hitl'";
        const toolCall: ToolCall = {
          id: nextMockToolCallId("mock-bash"),
          name: "Bash",
          arguments: { command },
        };
        sendJson(socket, { type: "stream:token", token: "[mock:hitl] Pedido de shell (HITL)…\n" });
        sendJson(socket, { type: "stream:done" });
        const approved = await agentLoop.requestDestructiveConfirmationMock(toolCall);
        if (!approved) {
          sendJson(socket, { type: "tool:rejected", toolCall });
          return;
        }
        sendJson(socket, { type: "tool:executing", toolCall });
        sendJson(socket, { type: "agent:shell:start", command });
        sendJson(socket, {
          type: "agent:shell:complete",
          command,
          stdout: "cli-mock @mock:hitl\n",
          stderr: "",
        });
        sendJson(socket, {
          type: "tool:result",
          toolCall,
          result: "cli-mock @mock:hitl\n",
        });
        sendJson(socket, { type: "stream:token", token: "\n[mock] Comando concluído.\n" });
        sendJson(socket, { type: "stream:done" });
        return;
      }
      case "hitl-write": {
        const toolCall: ToolCall = {
          id: nextMockToolCallId("mock-write"),
          name: "Write",
          arguments: {
            path: "mock/output.txt",
            content: "conteudo ficticio (cli-mock @mock:write)",
          },
        };
        sendJson(socket, { type: "stream:token", token: "[mock:write] Pedido de escrita (HITL)…\n" });
        sendJson(socket, { type: "stream:done" });
        const approved = await agentLoop.requestDestructiveConfirmationMock(toolCall);
        if (!approved) {
          sendJson(socket, { type: "tool:rejected", toolCall });
          return;
        }
        sendJson(socket, { type: "tool:executing", toolCall });
        sendJson(socket, {
          type: "tool:result",
          toolCall,
          result: "Ficheiro escrito (simulado).",
        });
        sendJson(socket, { type: "stream:token", token: "\n[mock] Write concluido.\n" });
        sendJson(socket, { type: "stream:done" });
        return;
      }
      default: {
        const _exhaustive: never = scenario;
        void _exhaustive;
      }
    }
  } catch {
    if (socket.readyState === WebSocket.OPEN) {
      sendJson(socket, { type: "error", message: "Falha no cenario mock." });
    }
  }
}

/**
 * Runs one AgentLoop cycle and reports unexpected runtime failures.
 */
async function runAgentLoop(
  agentLoop: AgentLoopLike,
  messages: Message[],
  tools: AgentTool[],
  mcpTools: McpTool[],
  socket: WebSocket,
  modeRaw: unknown,
): Promise<void> {
  try {
    const deps = await extensionDependenciesPromise;
    const mode = deps.parseChatUiMode(modeRaw);
    const toolsForRun = deps.selectToolsForChatMode(mode, tools);
    const mcpForRun = deps.mcpToolsForChatMode(mode, mcpTools);
    await agentLoop.run(messages, toolsForRun, { mcpTools: mcpForRun, chatMode: mode });
  } catch {
    // The loop already emits a typed "error" event.
    if (socket.readyState === WebSocket.OPEN) {
      sendJson(socket, { type: "error", message: "Falha ao executar o AgentLoop." });
    }
  }
}

/**
 * Narrows inbound websocket payloads to the expected protocol.
 */
function isIncomingWsMessage(value: unknown): value is IncomingWsMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "chat:send") {
    if (!Array.isArray(value.messages)) {
      return false;
    }
    if (
      value.mode !== undefined &&
      value.mode !== "plain" &&
      value.mode !== "agent" &&
      value.mode !== "ask"
    ) {
      return false;
    }
    return true;
  }

  if (value.type === "session:new") {
    return true;
  }

  if (value.type === "tool:approve" || value.type === "tool:reject") {
    return typeof value.toolCallId === "string" && value.toolCallId.length > 0;
  }

  if (value.type === "hitl:approveSession" || value.type === "hitl:approvePersist") {
    return typeof value.toolCallId === "string" && value.toolCallId.length > 0;
  }

  if (value.type === "config:load") {
    return true;
  }

  if (value.type === "config:save") {
    return isCappyConfig(value.config);
  }

  if (value.type === "mcp:list") {
    return true;
  }

  if (value.type === "file:open") {
    return typeof value.path === "string" && value.path.trim().length > 0;
  }

  return false;
}

/**
 * Narrows unknown values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates runtime payloads as CappyConfig.
 */
function isCappyConfig(value: unknown): value is CappyConfig {
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

/**
 * Returns tool metadata for the health endpoint.
 */
async function respondTools(response: import("node:http").ServerResponse): Promise<void> {
  try {
    const dependencies = await extensionDependenciesPromise;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        tools: dependencies.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      }),
    );
  } catch {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Falha ao carregar tools da extension." }));
  }
}

/**
 * Loads AgentLoop and tools from extension using relative module paths.
 */
interface ExtensionChatModeModule {
  parseChatUiMode(value: unknown): ChatUiMode;
  selectToolsForChatMode(mode: ChatUiMode, allTools: AgentTool[]): AgentTool[];
  mcpToolsForChatMode(mode: ChatUiMode, list: McpTool[]): McpTool[];
}

async function loadExtensionDependencies(): Promise<{
  AgentLoop: new () => AgentLoopLike;
  tools: AgentTool[];
  McpManager: new () => McpManagerLike;
  loadConfig(workspaceRoot: string): Promise<CappyConfig>;
  saveConfig(workspaceRoot: string, config: CappyConfig): Promise<void>;
  loadAgentPreferences: ExtensionAgentPreferencesModule["loadAgentPreferences"];
  parseChatUiMode: (value: unknown) => ChatUiMode;
  selectToolsForChatMode: (mode: ChatUiMode, allTools: AgentTool[]) => AgentTool[];
  mcpToolsForChatMode: (mode: ChatUiMode, list: McpTool[]) => McpTool[];
}> {
  const loopModule = (await importFirst([
    "../../extension/src/agent/loop.ts",
    "../../extension/src/agent/loop.js",
    "../../extension/dist/agent/loop.js",
  ])) as ExtensionLoopModule;

  const toolsModule = (await importFirst([
    "../../extension/src/tools/index.ts",
    "../../extension/src/tools/index.js",
    "../../extension/dist/tools/index.js",
  ])) as ExtensionToolsModule;

  const configModule = (await importFirst([
    "../../extension/src/config/index.ts",
    "../../extension/src/config/index.js",
    "../../extension/dist/config/index.js",
  ])) as ExtensionConfigModule;

  const mcpModule = (await importFirst([
    "../../extension/src/mcp/client.ts",
    "../../extension/src/mcp/client.js",
    "../../extension/dist/mcp/client.js",
  ])) as ExtensionMcpModule;

  const chatModeModule = (await importFirst([
    "../../extension/src/bridge/chatMode.ts",
    "../../extension/src/bridge/chatMode.js",
  ])) as ExtensionChatModeModule;

  const agentPreferencesModule = (await importFirst([
    "../../extension/src/agent/agentPreferences.ts",
    "../../extension/src/agent/agentPreferences.js",
  ])) as ExtensionAgentPreferencesModule;

  return {
    AgentLoop: loopModule.AgentLoop,
    tools: toolsModule.toolsRegistry,
    McpManager: mcpModule.McpManager,
    loadConfig: configModule.loadConfig,
    saveConfig: configModule.saveConfig,
    loadAgentPreferences: agentPreferencesModule.loadAgentPreferences,
    parseChatUiMode: chatModeModule.parseChatUiMode,
    selectToolsForChatMode: chatModeModule.selectToolsForChatMode,
    mcpToolsForChatMode: chatModeModule.mcpToolsForChatMode,
  };
}

/**
 * Imports the first module path that resolves successfully.
 */
async function importFirst(modulePaths: string[]): Promise<unknown> {
  let lastError: unknown = undefined;

  for (const modulePath of modulePaths) {
    try {
      const importedModule = await import(modulePath);
      return importedModule;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Nenhum caminho de modulo foi carregado.");
}
