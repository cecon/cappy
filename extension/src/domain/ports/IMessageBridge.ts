/**
 * Port: webview ↔ extension host message bridge.
 * Allows testing the agent without a real VS Code webview.
 */

export interface IMessageBridge {
  /** Sends a typed message to the webview. */
  send(message: Record<string, unknown>): void;
  /** Releases listeners and resources. */
  dispose(): void;
}
