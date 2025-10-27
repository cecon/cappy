import { WebSocketServer, WebSocket } from "ws";
import type { IWebSocketServer, IWebSocketClient } from "../ports/IWebSocketServer";

/**
 * Adapter: Implementação do servidor WebSocket usando 'ws'
 */
export class WSServerAdapter implements IWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private connectionHandlers: Array<(client: IWebSocketClient) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];

  async start(port: number): Promise<void> {
    if (this.wss) {
      await this.close();
    }

    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port });
        
        this.wss.on("error", (error) => {
          this.errorHandlers.forEach(handler => handler(error));
          reject(error);
        });

        this.wss.on("connection", (ws: WebSocket) => {
          this.clients.add(ws);
          const client = new WSClientAdapter(ws);
          
          ws.on("close", () => {
            this.clients.delete(ws);
          });

          this.connectionHandlers.forEach(handler => handler(client));
        });

        console.log(`🔌 [WSServerAdapter] Listening on port ${port}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    if (!this.wss) return;

    return new Promise((resolve) => {
      this.wss?.close(() => {
        this.wss = null;
        this.clients.clear();
        console.log("✅ [WSServerAdapter] Server closed");
        resolve();
      });
    });
  }

  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          console.error("❌ [WSServerAdapter] Broadcast error:", error);
        }
      }
    }
  }

  onConnection(handler: (client: IWebSocketClient) => void): void {
    this.connectionHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }
}

/**
 * Adapter: Wrapper para cliente WebSocket
 */
export class WSClientAdapter implements IWebSocketClient {
  private messageHandlers: Array<(data: unknown) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on("message", (data) => {
      this.messageHandlers.forEach(handler => handler(data));
    });

    this.ws.on("close", () => {
      this.closeHandlers.forEach(handler => handler());
    });
  }

  send(message: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(handler: (data: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    this.ws.close();
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  get raw(): WebSocket {
    return this.ws;
  }
}
