import * as vscode from "vscode";

import { ChatPanel } from "./chat/ChatPanel.js";
import { ChatViewProvider } from "./chat/ChatViewProvider.js";
import {
  SessionTreeItem,
  SessionsTreeProvider,
  deleteSessionFolder,
} from "./session/sessionsTreeView.js";

const extensionDisposables: vscode.Disposable[] = [];

/**
 * Activates the Cappy extension. The extension is a thin VS Code shell
 * around the `cappy` CLI:
 *   - native chat UI (sidebar webview view + editor tab webview panel)
 *   - terminal mode (spawns `cappy` in the integrated terminal)
 *   - sessions tree backed by `~/.cappy/sessions/`
 * All agent / LLM / tool work lives in the CLI.
 */
export function activate(context: vscode.ExtensionContext): void {
  /* ── chat (webview) ──────────────────────────────────────────────────── */
  const chatProvider = new ChatViewProvider(context.extensionUri);
  extensionDisposables.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  extensionDisposables.push(
    vscode.window.registerWebviewPanelSerializer(ChatPanel.viewType, {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel): Promise<void> {
        panel.webview.options = {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
        };
        ChatPanel.revive(panel, context.extensionUri);
      },
    }),
  );

  registerCommand("cappy.chat.openTab", () => {
    ChatPanel.createOrShow(context.extensionUri);
  });
  registerCommand("cappy.chat.openSidebar", async () => {
    await vscode.commands.executeCommand("workbench.view.extension.cappy-sidebar");
    await vscode.commands.executeCommand("cappy.chat.focus");
  });
  registerCommand("cappy.chat.newConversation", () => {
    chatProvider.post({ type: "command.newConversation" });
    ChatPanel.instance()?.post({ type: "command.newConversation" });
  });
  registerCommand("cappy.chat.focus", () => {
    chatProvider.reveal();
    chatProvider.post({ type: "command.focus" });
    ChatPanel.instance()?.post({ type: "command.focus" });
  });
  registerCommand("cappy.chat.blur", () => {
    chatProvider.post({ type: "command.blur" });
    ChatPanel.instance()?.post({ type: "command.blur" });
  });
  registerCommand("cappy.chat.insertAtMention", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const uri = editor.document.uri.toString();
    const sel = editor.selection;
    const ref = {
      uri,
      label: vscode.workspace.asRelativePath(editor.document.uri),
      ...(sel.isEmpty
        ? {}
        : { range: { startLine: sel.start.line + 1, endLine: sel.end.line + 1 } }),
    };
    chatProvider.reveal();
    chatProvider.post({ type: "command.insertAtMention", ref });
    ChatPanel.instance()?.post({ type: "command.insertAtMention", ref });
  });

  /* ── terminal mode ──────────────────────────────────────────────────── */
  const terminals = new Map<string, vscode.Terminal>();
  const sessionsTree = new SessionsTreeProvider();

  registerCommand("cappy.terminal.open", () => {
    const term = spawnCli([], "Cappy");
    terminals.set("__new__", term);
  });
  registerCommand("cappy.newSession", () => {
    const term = spawnCli([], "Cappy");
    terminals.set("__new__", term);
    sessionsTree.refresh();
  });
  registerCommand("cappy.resumeSession", async (sessionId: string | undefined) => {
    if (!sessionId) {
      return;
    }
    const useTerminal = vscode.workspace
      .getConfiguration("cappy")
      .get<boolean>("useTerminal", false);

    if (useTerminal) {
      const existing = terminals.get(sessionId);
      if (existing && existing.exitStatus === undefined) {
        existing.show();
        return;
      }
      const term = spawnCli(["--resume", sessionId], `Cappy: ${sessionId}`);
      terminals.set(sessionId, term);
      return;
    }

    // Native chat: open the preferred surface and resume in-bridge.
    const preferred = vscode.workspace
      .getConfiguration("cappy")
      .get<"sidebar" | "panel">("preferredLocation", "sidebar");
    if (preferred === "panel") {
      const panel = ChatPanel.createOrShow(context.extensionUri);
      panel.resumeSession(sessionId);
    } else {
      await vscode.commands.executeCommand("workbench.view.extension.cappy-sidebar");
      chatProvider.resumeSession(sessionId);
    }
  });

  /* ── sessions tree ──────────────────────────────────────────────────── */
  extensionDisposables.push(
    vscode.window.registerTreeDataProvider("cappy.sessions", sessionsTree),
  );
  registerCommand("cappy.openSessions", async () => {
    await vscode.commands.executeCommand("workbench.view.extension.cappy-sidebar");
    sessionsTree.refresh();
  });
  registerCommand("cappy.refreshSessions", () => sessionsTree.refresh());
  registerCommand(
    "cappy.deleteSession",
    async (item: SessionTreeItem | { sessionId?: string } | undefined) => {
      let id: string | undefined;
      if (item instanceof SessionTreeItem) {
        id = item.sessionId;
      } else if (item && typeof item === "object" && typeof item.sessionId === "string") {
        id = item.sessionId;
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
      await deleteSessionFolder(id);
      const term = terminals.get(id);
      term?.dispose();
      terminals.delete(id);
      sessionsTree.refresh();
    },
  );

  /* ── proposed-diff stubs (wired up when CLI bridge lands) ───────────── */
  registerCommand("cappy.chat.acceptProposedDiff", () => {
    void vscode.commands.executeCommand("setContext", "cappy.viewingProposedDiff", false);
  });
  registerCommand("cappy.chat.rejectProposedDiff", () => {
    void vscode.commands.executeCommand("setContext", "cappy.viewingProposedDiff", false);
  });

  extensionDisposables.push(
    vscode.window.onDidCloseTerminal((t) => {
      for (const [id, term] of terminals) {
        if (term === t) {
          terminals.delete(id);
          sessionsTree.refresh();
          break;
        }
      }
    }),
  );

  context.subscriptions.push(...extensionDisposables);
}

function registerCommand(id: string, fn: (...args: never[]) => unknown): void {
  extensionDisposables.push(vscode.commands.registerCommand(id, fn as never));
}

function spawnCli(
  args: string[],
  name: string,
  viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
): vscode.Terminal {
  const config = vscode.workspace.getConfiguration("cappy");
  const command = config.get<string>("cli.command", "cappy");
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const terminal = vscode.window.createTerminal({
    name,
    ...(cwd ? { cwd } : {}),
    location: { viewColumn },
    isTransient: true,
  });
  const escaped = args
    .map((a) => (/\s/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a))
    .join(" ");
  terminal.show(true);
  terminal.sendText(escaped.length > 0 ? `${command} ${escaped}` : command);
  return terminal;
}

export function deactivate(): void {
  while (extensionDisposables.length > 0) {
    const disposable = extensionDisposables.pop();
    disposable?.dispose();
  }
}
