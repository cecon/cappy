import { WebSocket } from "ws";
import type { IBridge } from "../ports/IBridge";

/**
 * Adapter: Bridge para comunicação com DevServerBridge da extensão VS Code
 */
export class DevServerBridgeAdapter implements IBridge {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Array<(data: unknown) => void> = [];
  private statusHandlers: Array<(connected: boolean) => void> = [];
  private targetPort: number = 7002;

  async connect(port: number): Promise<void> {
    this.targetPort = port;
    return this.attemptConnection();
  }

  private attemptConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(`ws://localhost:${this.targetPort}`);

        this.ws.on("open", () => {
          console.log(`🔗 [BridgeAdapter] Connected to extension on port ${this.targetPort}`);
          this.notifyStatus(true);
          resolve();
        });

        this.ws.on("message", (data) => {
          this.messageHandlers.forEach(handler => handler(data));
        });

        this.ws.on("close", () => {
          console.warn("⚠️ [BridgeAdapter] Connection closed");
          this.notifyStatus(false);
          this.scheduleReconnect();
        });

        this.ws.on("error", (err) => {
          console.warn("⚠️ [BridgeAdapter] Connection error:", (err as Error).message);
          this.notifyStatus(false);
          this.scheduleReconnect();
          reject(err);
        });
      } catch (err) {
        console.warn("⚠️ [BridgeAdapter] Failed to connect:", (err as Error).message);
        this.scheduleReconnect();
        reject(err);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log("🔄 [BridgeAdapter] Reconnecting...");
      this.attemptConnection().catch(() => {
        // Silent fail, will retry again
      });
    }, 2000);
  }

  private notifyStatus(connected: boolean): void {
    this.statusHandlers.forEach(handler => handler(connected));
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(handler: (data: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  onStatusChange(handler: (connected: boolean) => void): void {
    this.statusHandlers.push(handler);
  }

  isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }
}
