/**
 * Adapter: VS Code Webview postMessage → IMessageBridge.
 * Isolates VS Code webview API from the application layer.
 */

import * as vscode from "vscode";

import type { IMessageBridge } from "../../domain/ports/IMessageBridge";

/**
 * Creates a message bridge backed by a real VS Code webview.
 * The returned adapter sends messages to the webview and exposes a
 * subscription hook so the application layer can react to incoming messages.
 */
export class WebviewBridgeAdapter implements IMessageBridge {
  private readonly webview: vscode.Webview;
  private disposed = false;

  constructor(webview: vscode.Webview) {
    this.webview = webview;
  }

  send(message: Record<string, unknown>): void {
    if (this.disposed) return;
    void this.webview.postMessage(message);
  }

  dispose(): void {
    this.disposed = true;
  }

  /**
   * Subscribes to messages coming from the webview.
   * Returns a VS Code Disposable that unsubscribes when disposed.
   */
  onMessage(handler: (message: unknown) => void): vscode.Disposable {
    return this.webview.onDidReceiveMessage(handler);
  }
}
