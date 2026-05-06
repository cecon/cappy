import * as vscode from "vscode";

import {
  SessionTreeItem,
  SessionsTreeProvider,
  deleteSessionFolder,
} from "./session/sessionsTreeView";

const extensionDisposables: vscode.Disposable[] = [];

/**
 * Activates the Cappy extension. The extension is a thin shell around the
 * `cappy` CLI: it lists sessions from `~/.cappy/sessions/` and spawns the CLI
 * inside the integrated terminal. All agent / LLM / tool work lives in the CLI.
 */
export function activate(context: vscode.ExtensionContext): void {
  const sessionsTree = new SessionsTreeProvider();
  const treeRegistration = vscode.window.registerTreeDataProvider("cappy.sessions", sessionsTree);

  const terminals = new Map<string, vscode.Terminal>();

  const newSessionCommand = vscode.commands.registerCommand("cappy.newSession", () => {
    const term = spawnCli([], "Cappy");
    terminals.set("__new__", term);
    sessionsTree.refresh();
  });

  const resumeSessionCommand = vscode.commands.registerCommand(
    "cappy.resumeSession",
    (sessionId: string | undefined) => {
      if (!sessionId) {
        return;
      }
      const existing = terminals.get(sessionId);
      if (existing && existing.exitStatus === undefined) {
        existing.show();
        return;
      }
      const term = spawnCli(["--resume", sessionId], `Cappy: ${sessionId}`);
      terminals.set(sessionId, term);
    },
  );

  const openSessionsCommand = vscode.commands.registerCommand("cappy.openSessions", async () => {
    await vscode.commands.executeCommand("workbench.view.extension.cappy-sidebar");
    sessionsTree.refresh();
  });

  const refreshSessionsCommand = vscode.commands.registerCommand("cappy.refreshSessions", () => {
    sessionsTree.refresh();
  });

  const deleteSessionCommand = vscode.commands.registerCommand(
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

  const closedSub = vscode.window.onDidCloseTerminal((t) => {
    for (const [id, term] of terminals) {
      if (term === t) {
        terminals.delete(id);
        sessionsTree.refresh();
        break;
      }
    }
  });

  extensionDisposables.push(
    treeRegistration,
    newSessionCommand,
    resumeSessionCommand,
    openSessionsCommand,
    refreshSessionsCommand,
    deleteSessionCommand,
    closedSub,
  );
  context.subscriptions.push(...extensionDisposables);
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
