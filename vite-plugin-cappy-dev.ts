import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// Adapters
import { WSServerAdapter } from "./src/vite-plugin/adapters/WSServerAdapter";
import { NodeFileSystemAdapter } from "./src/vite-plugin/adapters/NodeFileSystemAdapter";
import { DevServerBridgeAdapter } from "./src/vite-plugin/adapters/DevServerBridgeAdapter";
import { SimpleHTTPRouter } from "./src/vite-plugin/adapters/SimpleHTTPRouter";

// Domain Services
import { TypeScriptAnalyzer } from "./src/vite-plugin/domain/TypeScriptAnalyzer";
import { PHPAnalyzer } from "./src/vite-plugin/domain/PHPAnalyzer";
import { EntityProcessingPipeline } from "./src/vite-plugin/domain/EntityProcessingPipeline";

// Use Cases
import { DocumentManagement } from "./src/vite-plugin/application/DocumentManagement";
import { GraphAPIHandler } from "./src/vite-plugin/application/GraphAPIHandler";
import { TasksAPIHandler } from "./src/vite-plugin/application/TasksAPIHandler";
import { ChatAPIHandler } from "./src/vite-plugin/application/ChatAPIHandler";
import { DebugAnalyzeUseCase } from "./src/vite-plugin/application/DebugAnalyzeUseCase";

// Types
import type { IWebSocketClient } from "./src/vite-plugin/ports/IWebSocketServer";

/**
 * Plugin Vite para Dev Server do Cappy
 * Arquitetura Hexagonal: Ports & Adapters
 */
export function cappyDevServerPlugin(): Plugin {
  let workspaceRoot: string;

  // Adapters (Infrastructure)
  const wsServer = new WSServerAdapter();
  const fileSystem = new NodeFileSystemAdapter();
  const bridge = new DevServerBridgeAdapter();
  const httpRouter = new SimpleHTTPRouter();

  // Domain Services
  let tsAnalyzer: TypeScriptAnalyzer;
  let phpAnalyzer: PHPAnalyzer;
  let entityPipeline: EntityProcessingPipeline;

  // Use Cases
  let documentManagement: DocumentManagement;
  let debugAnalyze: DebugAnalyzeUseCase;

  return {
    name: "cappy-dev-server",

    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { src: "/@cappy/vscode-mock.js" },
            injectTo: "head",
          },
        ],
      };
    },

    async configureServer(server) {
      workspaceRoot = process.cwd();

      console.log("🧢 [Cappy Dev Server] Backend disponível");
      console.log("📂 Workspace:", workspaceRoot);
      console.log("💡 Dica: Acesse http://localhost:3000/dev.html para o dashboard");

      // Inicializa Domain Services
      tsAnalyzer = new TypeScriptAnalyzer(fileSystem, workspaceRoot);
      phpAnalyzer = new PHPAnalyzer();
      entityPipeline = new EntityProcessingPipeline(workspaceRoot);

      // Inicializa Use Cases
      documentManagement = new DocumentManagement(fileSystem, workspaceRoot);
      debugAnalyze = new DebugAnalyzeUseCase(fileSystem, entityPipeline, workspaceRoot);
      
      // Registra analisadores
      debugAnalyze.registerAnalyzer(tsAnalyzer);
      debugAnalyze.registerAnalyzer(phpAnalyzer);

      // Configura HTTP Router
      httpRouter.register("/graph", new GraphAPIHandler(fileSystem, workspaceRoot));
      httpRouter.register("/tasks", new TasksAPIHandler(fileSystem, workspaceRoot));
      httpRouter.register("/chat", new ChatAPIHandler());

      // Inicia WebSocket Server (porta 7001)
      await startWebSocketWithRetry();

      // Conecta com Extension Bridge (porta 7002)
      await bridge.connect(7002);

      // Configura handlers de Bridge
      bridge.onMessage((data) => {
        // Broadcast mensagens do bridge para todos os clientes frontend
        wsServer.broadcast(data);
      });

      bridge.onStatusChange((connected) => {
        wsServer.broadcast({
          type: "bridge/status",
          payload: { connected, port: 7002 },
        });
      });

      // Configura handlers de WebSocket
      wsServer.onConnection((client) => {
        console.log("👋 [WebSocket] Client connected");
        handleClientConnection(client);
      });

      wsServer.onError((error) => {
        console.error("❌ [WebSocket] Error:", error);
      });

      // Middleware para log de requisições
      server.middlewares.use((req, _res, next) => {
        const url = req.url || "";
        if (
          !url.includes("/@vite") &&
          !url.includes("/@fs") &&
          !url.includes("/@id") &&
          !url.includes(".css") &&
          !url.includes("node_modules")
        ) {
          console.log("🔍 [Request]", req.method, url);
        }
        next();
      });

      // Middleware para API REST
      server.middlewares.use("/api", async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");

        const url = req.url || "";
        console.log("📡 [API]", req.method, url);

        try {
          if (url === "/health") {
            res.end(JSON.stringify({ status: "ok", workspace: workspaceRoot }));
            return;
          }

          if (url === "/debug/analyze" && req.method === "POST") {
            await debugAnalyze.analyzeViaHTTP(req, res);
            return;
          }

          // Tenta rotear via httpRouter
          const routed = await httpRouter.route(url, req, res);
          if (routed) return;

          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Endpoint not found" }));
        } catch (error) {
          console.error("❌ [API Error]", error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        }
      });

      // Middleware para servir VS Code mock script
      server.middlewares.use((req, res, next) => {
        if (req.url === "/@cappy/vscode-mock.js") {
          res.setHeader("Content-Type", "application/javascript");
          res.end(getVSCodeMockScript());
          return;
        }

        if (
          req.url?.includes("manifest.json") ||
          req.url?.includes(".crx") ||
          req.url?.endsWith(".map")
        ) {
          res.statusCode = 204;
          res.end();
          return;
        }

        next();
      });

      async function startWebSocketWithRetry(): Promise<void> {
        const PORT = 7001;
        let retryCount = 0;

        while (true) {
          try {
            await wsServer.start(PORT);
            console.log(`🔌 [WebSocket] Server started on port ${PORT}`);
            break;
          } catch (error) {
            retryCount++;
            if (retryCount > 5) {
              console.error(`❌ [WebSocket] Failed to start after ${retryCount} attempts`);
              throw error;
            }
            console.warn(`⚠️ [WebSocket] Port ${PORT} in use, retrying in 1.5s... (attempt ${retryCount})`);
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      }

      function handleClientConnection(client: IWebSocketClient): void {
        console.log("👋 [WebSocket] Novo cliente conectado - configurando handlers...");
        
        client.onMessage(async (data) => {
          try {
            const message = JSON.parse(String(data));
            const { type, payload } = message;
            console.log("📨 [Frontend→Vite]", type, payload ? `(com payload)` : '');

            // Debug/Analyze
            if (type === "debug/analyze") {
              console.log("🔍 [Handler] Processando debug/analyze...");
              if (bridge.isConnected()) {
                bridge.send(message);
              } else {
                await debugAnalyze.analyzeViaWebSocket(payload, client);
              }
              return;
            }

            // Document Management
            if (type === "document/refresh") {
              console.log("🔄 [Handler] Processando document/refresh com paginação...", payload);
              await documentManagement.refreshDocuments(client, payload);
              return;
            }

            if (type === "document/scan") {
              console.log("🔍 [Handler] Processando document/scan - chamando scanDocuments()...");
              await documentManagement.scanDocuments(client);
              return;
            }

            // Document actions que precisam da extensão
            if (type.startsWith("document/") && 
                ["upload", "process", "retry", "clear"].some(action => type.includes(action))) {
              client.send({
                type: "error",
                payload: {
                  error: `Action '${type}' requires VS Code extension. Run 'npm run build' and reload extension.`,
                },
              });
              return;
            }

            // Database status
            if (type === "get-db-status") {
              if (bridge.isConnected()) {
                bridge.send(message);
              } else {
                client.send({
                  type: "db-status",
                  payload: {
                    isConnected: true,
                    nodeCount: 0,
                    relationshipCount: 0,
                    status: "ready",
                    mode: "development",
                  },
                });
              }
              return;
            }

            // Chat messages - sempre tenta bridge primeiro
            if (
              type === "sendMessage" ||
              type === "userPromptResponse" ||
              type.startsWith("chat/")
            ) {
              if (bridge.isConnected()) {
                bridge.send(message);
              } else {
                client.send({
                  type: "error",
                  payload: {
                    error:
                      "Extension bridge not connected (port 7002). Open VS Code with Cappy installed to enable LLM features.",
                  },
                });
              }
              return;
            }

            console.warn("⚠️ [WebSocket] Unknown message type:", type);
          } catch (error) {
            console.error("❌ [WebSocket] Message handling error:", error);
            client.send({
              type: "error",
              payload: { error: String(error) },
            });
          }
        });

        client.onClose(() => {
          console.log("👋 [WebSocket] Client disconnected");
        });
      }
    },
  };
}

/**
 * Script de mock da API do VS Code para desenvolvimento
 */
function getVSCodeMockScript(): string {
  return `
// Mock da API do VS Code para desenvolvimento
console.log('🧢 [Cappy] VS Code API Mock loaded');

let ws = null;
let wsReady = false;

function connectToViteServer() {
  console.log('🔌 [Cappy] Tentando conectar ao WebSocket em ws://localhost:7001...');
  try {
    ws = new WebSocket('ws://localhost:7001');
    
    ws.onopen = () => {
      console.log('✅ [Cappy] Conectado ao Vite dev server!');
      console.log('   WebSocket readyState:', ws.readyState);
      wsReady = true;
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [Vite→Frontend]', data.type, data.payload ? '(com payload)' : '');
        window.postMessage(data, '*');
      } catch (error) {
        console.error('❌ [WebSocket] Parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ [Cappy] WebSocket error:', error);
      wsReady = false;
    };
    
    ws.onclose = () => {
      console.log('🔌 [Cappy] WebSocket desconectado, reconectando em 1s...');
      wsReady = false;
      ws = null;
      setTimeout(connectToViteServer, 1000);
    };
  } catch (error) {
    console.error('❌ [Cappy] Não foi possível conectar:', error);
    wsReady = false;
  }
}

connectToViteServer();

const vsCodeApi = {
  postMessage: async (message) => {
    console.log('📤 [Frontend→Vite] postMessage chamado');
    console.log('   Type:', message.type);
    console.log('   Payload:', message.payload);
    console.log('   WebSocket Ready:', wsReady);
    console.log('   WebSocket State:', ws ? ws.readyState : 'null');
    
    try {
      if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
        console.log('✅ [WebSocket] Enviando mensagem via WebSocket...');
        ws.send(JSON.stringify(message));
        console.log('✅ [WebSocket] Mensagem enviada com sucesso!');
      } else {
        console.error('❌ [WebSocket] Not ready. State:', {
          wsReady,
          ws: !!ws,
          readyState: ws ? ws.readyState : 'null'
        });
        console.error('   Tentando reconectar...');
      }
    } catch (error) {
      console.error('❌ postMessage failed:', error);
    }
  },
  setState: (state) => {
    sessionStorage.setItem('vscode-state', JSON.stringify(state));
  },
  getState: () => {
    const state = sessionStorage.getItem('vscode-state');
    return state ? JSON.parse(state) : undefined;
  }
};

window.acquireVsCodeApi = () => vsCodeApi;
window.vscodeApi = vsCodeApi;
`;
}
