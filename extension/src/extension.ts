import * as vscode from "vscode";

import { createWebviewBridge, type WebviewBridgeOptions } from "./bridge/webview";
import {
  launchCappyCli,
  openCappyRepository,
  openCappyWorkspaceProfile,
} from "./cappyLauncher";
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

  const launchCappyCommand = vscode.commands.registerCommand("cappy.launchCappy", async () => {
    await launchCappyCli({ requireWorkspaceRoot: false });
  });

  const launchCappyWorkspaceRootCommand = vscode.commands.registerCommand(
    "cappy.launchCappyWorkspaceRoot",
    async () => {
      await launchCappyCli({ requireWorkspaceRoot: true });
    },
  );

  const openCappyProfileCommand = vscode.commands.registerCommand(
    "cappy.openCappyProfile",
    async () => {
      await openCappyWorkspaceProfile();
    },
  );

  const openCappyRepoCommand = vscode.commands.registerCommand("cappy.openCappyRepository", async () => {
    await openCappyRepository();
  });

  const showLogCommand = vscode.commands.registerCommand("cappy.showLog", () => {
    showLog();
  });

  extensionDisposables.push(
    provider,
    providerRegistration,
    openChatCommand,
    clearChatCommand,
    launchCappyCommand,
    launchCappyWorkspaceRootCommand,
    openCappyProfileCommand,
    openCappyRepoCommand,
    showLogCommand,
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

    const normalizedPath = rawPath.replace(/^\.\//,  "");
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
