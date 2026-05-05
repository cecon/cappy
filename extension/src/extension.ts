import * as vscode from "vscode";

import { createWebviewBridge, type WebviewBridgeOptions } from "./bridge/webview";
import {
  launchOpenClaudeCli,
  openOpenClaudeRepository,
  openOpenClaudeWorkspaceProfile,
} from "./openClaudeLauncher";
import { CappyEditorProvider } from "./session/CappyEditorProvider";
import { SessionStore } from "./session/SessionStore";
import { SessionsTreeProvider } from "./session/sessionsTreeView";
import { disposeLogger, showLog } from "./utils/logger";

const CHAT_VIEW_ID = "cappy.chatView";
const SIDEBAR_CONTAINER_ID = "cappy-sidebar";

const extensionDisposables: vscode.Disposable[] = [];

/**
 * Webview provider responsible for rendering and managing Cappy chat view.
 */
class CappyWebviewViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private webviewView: vscode.WebviewView | undefined;

  private readonly bridgeDisposables: vscode.Disposable[] = [];

  /**
   * Creates a provider bound to the extension context.
   */
  public constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Resolves the view and wires the runtime bridge to the webview.
   */
  public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.webviewView = webviewView;
    await this.renderWebview(webviewView);

    webviewView.onDidDispose(() => {
      this.disposeBridge();
      this.webviewView = undefined;
    });
  }

  /**
   * Reveals the chat view when already created.
   */
  public reveal(): void {
    this.webviewView?.show(true);
  }

  /**
   * Clears chat state by reloading the webview HTML and bridge.
   */
  public async clearChat(): Promise<void> {
    if (!this.webviewView) {
      return;
    }
    await this.renderWebview(this.webviewView);
  }

  /**
   * Disposes provider runtime resources.
   */
  public dispose(): void {
    this.disposeBridge();
  }

  /**
   * Configures webview, loads compiled HTML and initializes host bridge.
   */
  private async renderWebview(webviewView: vscode.WebviewView): Promise<void> {
    const webviewRoot = vscode.Uri.joinPath(this.context.extensionUri, "out", "webview");
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewRoot],
    };

    webviewView.webview.html = await loadWebviewHtml(webviewView.webview, webviewRoot);

    this.disposeBridge();
    const bridgeOptions: WebviewBridgeOptions = {
      onNewSession: async () => {
        await this.clearChat();
        this.reveal();
      },
    };
    this.bridgeDisposables.push(...createWebviewBridge(webviewView.webview, bridgeOptions));
  }

  /**
   * Clears bridge listeners and disposables.
   */
  private disposeBridge(): void {
    while (this.bridgeDisposables.length > 0) {
      const disposable = this.bridgeDisposables.pop();
      disposable?.dispose();
    }
  }
}

/**
 * Activates extension runtime and command registrations.
 */
export function activate(context: vscode.ExtensionContext): void {
  const provider = new CappyWebviewViewProvider(context);
  const providerRegistration = vscode.window.registerWebviewViewProvider(CHAT_VIEW_ID, provider);

  const openChatCommand = vscode.commands.registerCommand("cappy.openChat", async () => {
    await vscode.commands.executeCommand(`workbench.view.extension.${SIDEBAR_CONTAINER_ID}`);
    provider.reveal();
  });

  const clearChatCommand = vscode.commands.registerCommand("cappy.clearChat", async () => {
    await vscode.commands.executeCommand(`workbench.view.extension.${SIDEBAR_CONTAINER_ID}`);
    await provider.clearChat();
    provider.reveal();
  });

  const launchOpenClaudeCommand = vscode.commands.registerCommand("cappy.launchOpenClaude", async () => {
    await launchOpenClaudeCli({ requireWorkspaceRoot: false });
  });

  const launchOpenClaudeWorkspaceRootCommand = vscode.commands.registerCommand(
    "cappy.launchOpenClaudeWorkspaceRoot",
    async () => {
      await launchOpenClaudeCli({ requireWorkspaceRoot: true });
    },
  );

  const openOpenClaudeProfileCommand = vscode.commands.registerCommand(
    "cappy.openOpenClaudeProfile",
    async () => {
      await openOpenClaudeWorkspaceProfile();
    },
  );

  const openOpenClaudeRepoCommand = vscode.commands.registerCommand("cappy.openOpenClaudeRepository", async () => {
    await openOpenClaudeRepository();
  });

  const showLogCommand = vscode.commands.registerCommand("cappy.showLog", () => {
    showLog();
  });

  const sessionStore = new SessionStore();
  const sessionsTree = new SessionsTreeProvider(sessionStore);
  const editorRegistration = CappyEditorProvider.register(context, sessionStore);
  const treeRegistration = vscode.window.registerTreeDataProvider("cappy.sessions", sessionsTree);

  const newSessionCommand = vscode.commands.registerCommand("cappy.newSession", async () => {
    const config = vscode.workspace.getConfiguration("cappy");
    const primaryModel = config.get<string>("model", "openai/gpt-5");
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const { paths } = await sessionStore.createSession({ primaryModel, workspaceRoot });
    const uri = vscode.Uri.file(paths.chat);
    await vscode.commands.executeCommand("vscode.openWith", uri, CappyEditorProvider.viewType);
    sessionsTree.refresh();
  });

  const openSessionsCommand = vscode.commands.registerCommand("cappy.openSessions", async () => {
    const list = await sessionStore.listSessions();
    if (list.length === 0) {
      const choice = await vscode.window.showInformationMessage(
        "No Cappy sessions yet.",
        "New Session",
      );
      if (choice === "New Session") {
        await vscode.commands.executeCommand("cappy.newSession");
      }
      return;
    }
    const pick = await vscode.window.showQuickPick(
      list.map((s) => ({
        label: s.metadata.preview.title || s.id,
        description: new Date(s.metadata.updatedAt).toLocaleString(),
        detail: `${s.metadata.preview.messageCount} messages · ${s.metadata.totals.llmCalls} llm calls`,
        sessionId: s.id,
        chatPath: s.paths.chat,
      })),
      { placeHolder: "Open a Cappy session" },
    );
    if (!pick) {
      return;
    }
    await vscode.commands.executeCommand(
      "vscode.openWith",
      vscode.Uri.file(pick.chatPath),
      CappyEditorProvider.viewType,
    );
  });

  const deleteSessionCommand = vscode.commands.registerCommand("cappy.deleteSession", async (item: { id?: string } | undefined) => {
    let id = item?.id;
    if (!id) {
      const list = await sessionStore.listSessions();
      const pick = await vscode.window.showQuickPick(
        list.map((s) => ({ label: s.metadata.preview.title || s.id, description: s.id, sessionId: s.id })),
        { placeHolder: "Delete which session?" },
      );
      id = pick?.sessionId;
    }
    if (!id) {
      return;
    }
    const confirm = await vscode.window.showWarningMessage(
      `Delete session ${id}? This cannot be undone.`,
      { modal: true },
      "Delete",
    );
    if (confirm !== "Delete") {
      return;
    }
    await sessionStore.deleteSession(id);
    sessionsTree.refresh();
  });

  extensionDisposables.push(
    provider,
    providerRegistration,
    openChatCommand,
    clearChatCommand,
    launchOpenClaudeCommand,
    launchOpenClaudeWorkspaceRootCommand,
    openOpenClaudeProfileCommand,
    openOpenClaudeRepoCommand,
    showLogCommand,
    editorRegistration,
    treeRegistration,
    newSessionCommand,
    openSessionsCommand,
    deleteSessionCommand,
  );
  context.subscriptions.push(...extensionDisposables);
}

/**
 * Loads the built webview HTML and rewrites asset URLs to VS Code URIs.
 */
async function loadWebviewHtml(webview: vscode.Webview, webviewRoot: vscode.Uri): Promise<string> {
  const htmlUri = vscode.Uri.joinPath(webviewRoot, "index.html");
  const htmlBytes = await vscode.workspace.fs.readFile(htmlUri);
  const html = new TextDecoder("utf-8").decode(htmlBytes);
  return rewriteAssetUris(html, webview, webviewRoot);
}

/**
 * Rewrites local src/href references so VS Code can serve static assets.
 */
function rewriteAssetUris(html: string, webview: vscode.Webview, webviewRoot: vscode.Uri): string {
  return html.replace(/(src|href)="([^"]+)"/g, (_fullMatch: string, attribute: string, rawPath: string) => {
    if (
      rawPath.startsWith("http://") ||
      rawPath.startsWith("https://") ||
      rawPath.startsWith("data:") ||
      rawPath.startsWith("vscode-webview-resource:") ||
      rawPath.startsWith("#")
    ) {
      return `${attribute}="${rawPath}"`;
    }

    const normalizedPath = rawPath.replace(/^\.\//, "");
    const assetUri = vscode.Uri.joinPath(webviewRoot, normalizedPath);
    const webviewUri = webview.asWebviewUri(assetUri);
    return `${attribute}="${webviewUri.toString()}"`;
  });
}

/**
 * Cleans extension resources on shutdown.
 */
export function deactivate(): void {
  while (extensionDisposables.length > 0) {
    const disposable = extensionDisposables.pop();
    disposable?.dispose();
  }
  disposeLogger();
}
