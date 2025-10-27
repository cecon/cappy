import type { WebSocket } from "ws";

/**
 * Port: Interface para servidor WebSocket
 */
export interface IWebSocketServer {
  start(port: number): Promise<void>;
  close(): Promise<void>;
  broadcast(message: unknown): void;
  onConnection(handler: (client: IWebSocketClient) => void): void;
  onError(handler: (error: Error) => void): void;
}

/**
 * Port: Interface para cliente WebSocket
 */
export interface IWebSocketClient {
  send(message: unknown): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  close(): void;
  readonly readyState: number;
  readonly raw?: WebSocket;
}
