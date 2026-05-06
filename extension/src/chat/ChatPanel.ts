import * as vscode from "vscode";

import { CliBridge } from "./cliBridge.js";
import type { HostToWebview, WebviewToHost } from "./protocol.js";
import { buildWebviewHtml } from "./htmlShell.js";
import { readWebviewSettings } from "./ChatViewProvider.js";

/**
 * Editor-tab webview panel. Mirrors ChatViewProvider — same React bundle,
 * same protocol, dedicated CLI process.
 */
export class ChatPanel {
  public static readonly viewType = "cappyChatPanel";
  private static current: ChatPanel | undefined;

  public static createOrShow(extensionUri: vscode.Uri): ChatPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (ChatPanel.current) {
      ChatPanel.current.panel.reveal(column);
      return ChatPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(ChatPanel.viewType, "Cappy", column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
    });
    ChatPanel.current = new ChatPanel(panel, extensionUri);
    return ChatPanel.current;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): ChatPanel {
    ChatPanel.current = new ChatPanel(panel, extensionUri);
    return ChatPanel.current;
  }

  public static instance(): ChatPanel | undefined {
    return ChatPanel.current;
  }

  private readonly disposables: vscode.Disposable[] = [];
  private bridge: CliBridge | undefined;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
  ) {
    panel.webview.html = buildWebviewHtml(panel.webview, this.extensionUri);
    panel.webview.onDidReceiveMessage(
      (msg: WebviewToHost) => this.handleMessage(msg),
      undefined,
      this.disposables,
    );
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  public post(msg: HostToWebview): void {
    void this.panel.webview.postMessage(msg);
  }

  public reveal(): void {
    this.panel.reveal();
  }

  public resumeSession(sessionId: string): void {
    this.reveal();
    this.ensureBridge().resumeSession(sessionId);
  }

  private ensureBridge(): CliBridge {
    if (this.bridge) return this.bridge;
    this.bridge = new CliBridge({
      onEvent: (event) => this.post(event),
      onProcessExit: (code) =>
        this.post({
          type: "error",
          message: `cappy CLI exited (code ${code ?? "null"}). Click "New Chat" to restart.`,
        }),
      log: (level, message) => console.log(`[cappy.bridge:${level}] ${message}`),
    });
    this.bridge.start();
    return this.bridge;
  }

  private handleMessage(msg: WebviewToHost): void {
    switch (msg.type) {
      case "ready":
        this.post({
          type: "init",
          sessionId: null,
          sessions: [],
          settings: readWebviewSettings(),
        });
        return;
      case "user.message":
        this.ensureBridge().send(msg);
        return;
      case "session.new":
        this.bridge?.newSession();
        return;
      case "session.list":
        this.ensureBridge().listSessions();
        return;
      case "session.resume":
        this.ensureBridge().resumeSession(msg.sessionId);
        return;
      case "session.delete":
        this.ensureBridge().deleteSession(msg.sessionId);
        return;
      case "abort":
        this.bridge?.abort();
        return;
      case "hitl.response":
        this.ensureBridge().send(msg);
        return;
      case "log":
        console.log(`[cappy.chat:webview] ${msg.level}: ${msg.message}`);
        return;
      default:
        return;
    }
  }

  private dispose(): void {
    ChatPanel.current = undefined;
    this.bridge?.dispose();
    this.bridge = undefined;
    while (this.disposables.length > 0) {
      const d = this.disposables.pop();
      d?.dispose();
    }
    this.panel.dispose();
  }
}
