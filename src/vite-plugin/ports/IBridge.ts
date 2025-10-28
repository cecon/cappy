/**
 * Port: Interface para comunicação com a extensão VS Code
 */
export interface IBridge {
  connect(port: number): Promise<void>;
  disconnect(): Promise<void>;
  send(message: unknown): void;
  onMessage(handler: (data: unknown) => void): void;
  onStatusChange(handler: (connected: boolean) => void): void;
  isConnected(): boolean;
}
