import * as vscode from "vscode";

import { CliBridge } from "./cliBridge.js";
import type { HostToWebview, WebviewToHost } from "./protocol.js";
import { buildWebviewHtml } from "./htmlShell.js";

/**
 * Sidebar webview view (activity bar). Owns its own CliBridge: each
 * webview = one cappy CLI process. The bridge starts lazily on the
 * first user.message so the CLI isn't spawned until needed.
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cappy.chat";

  private view: vscode.WebviewView | undefined;
  private bridge: CliBridge | undefined;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "out")],
    };
    webviewView.webview.html = buildWebviewHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage((msg: WebviewToHost) => {
      this.handleMessage(msg);
    });

    webviewView.onDidDispose(() => {
      this.bridge?.dispose();
      this.bridge = undefined;
      this.view = undefined;
    });
  }

  public post(msg: HostToWebview): void {
    void this.view?.webview.postMessage(msg);
  }

  public reveal(): void {
    this.view?.show?.(true);
  }

  public resumeSession(sessionId: string): void {
    this.reveal();
    this.ensureBridge().resumeSession(sessionId);
  }

  public refreshSessionList(): void {
    this.bridge?.listSessions();
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
        // session.list / session.resume / session.delete / mention.search /
        // diff.* still land here when the corresponding flows are wired up.
        return;
    }
  }
}

export function readWebviewSettings(): {
  useCtrlEnterToSend: boolean;
  preferredLocation: "sidebar" | "panel";
  permissionMode: "confirm_each" | "allow_all" | "deny_all";
} {
  const cfg = vscode.workspace.getConfiguration("cappy");
  return {
    useCtrlEnterToSend: cfg.get<boolean>("useCtrlEnterToSend", false),
    preferredLocation: cfg.get<"sidebar" | "panel">("preferredLocation", "sidebar"),
    permissionMode: cfg.get<"confirm_each" | "allow_all" | "deny_all">(
      "initialPermissionMode",
      "confirm_each",
    ),
  };
}
