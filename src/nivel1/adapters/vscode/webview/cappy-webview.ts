/**
 * @fileoverview Cappy WebView Provider — manages the sidebar Dashboard lifecycle.
 * @module webview/cappy-webview
 *
 * Single Responsibility: WebviewViewProvider lifecycle and scheduler dashboard communication.
 * HTML/CSS/JS are in dashboard.html.ts, dashboard.css.ts, dashboard.js.ts.
 */

import * as vscode from 'vscode';
import { generateDashboardHtml } from './dashboard.html';

/**
 * WebView provider for the Cappy sidebar panel.
 * Shows scheduler status and local automation controls.
 */
export class CappyWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.dashboard';

  private view: vscode.WebviewView | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  // ────────────────────────── Public API ──────────────────────────

  /** Post message to the webview (for updates that don't need HTML re-render) */
  postMessage(msg: any): void {
    this.view?.webview.postMessage(msg);
  }

  // ────────────────────────── Lifecycle ──────────────────────────

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Render HTML with current state baked in
    webviewView.webview.html = this.buildHtml();

    // Handle messages from webview → extension
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'refresh':
          this.rerender();
          break;
        case 'webview-ready':
          break;
        case 'scheduler-add':
          vscode.commands.executeCommand('cappy.scheduler.add', msg.data);
          break;
        case 'scheduler-toggle':
          vscode.commands.executeCommand('cappy.scheduler.toggle', msg.data);
          break;
        case 'scheduler-remove':
          vscode.commands.executeCommand('cappy.scheduler.remove', msg.data);
          break;
        case 'scheduler-run':
          vscode.commands.executeCommand('cappy.scheduler.run', msg.data);
          break;
      }
    });

    // Sync when panel becomes visible again
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.rerender();
      }
    });
  }

  // ────────────────────────── Private ──────────────────────────

  /**
   * Re-render the entire webview HTML with fresh state.
   * This is the nuclear but reliable approach — no postMessage dependency.
   */
  private rerender(): void {
    if (!this.view) return;

    this.view.webview.html = this.buildHtml();
  }

  /** Build the full HTML string with current state injected */
  private buildHtml(): string {
    const iconUri = this.view
      ? this.view.webview.asWebviewUri(
          vscode.Uri.joinPath(this.extensionUri, 'src', 'assets', 'icon.png'),
        ).toString()
      : '';

    return generateDashboardHtml({ iconUri, initialStatusJson: 'null' });
  }
}
