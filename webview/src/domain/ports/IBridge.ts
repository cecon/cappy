/**
 * Port: abstract bridge between the webview and the extension host.
 * Extracted from vscode-bridge.ts; allows testing with in-memory implementations.
 */

import type { OutgoingMessage, IncomingMessage } from "../../lib/vscode-bridge";

/**
 * Minimal bridge contract used throughout the webview.
 * Implementations: VsCodeBridge (production) and in-memory mocks (tests).
 */
export interface IBridge {
  /** Sends a typed message to the extension host. */
  send(message: OutgoingMessage): void;
  /**
   * Registers a handler for incoming messages from the host.
   * Returns an unsubscribe function — call it in useEffect cleanup.
   */
  onMessage(handler: (message: IncomingMessage) => void): () => void;
}
