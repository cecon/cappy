import * as vscode from "vscode";

import { CappyEditorProvider } from "./session/CappyEditorProvider";
import { SessionStore } from "./session/SessionStore";
import { SessionsTreeProvider, SessionTreeItem } from "./session/sessionsTreeView";
import { disposeLogger, showLog } from "./utils/logger";

const extensionDisposables: vscode.Disposable[] = [];

/**
 * Activates the Cappy extension. Cada sessão é uma pasta em
 * `~/.cappy/sessions/<id>/` com um `chat.cappy` aberto via custom editor;
 * o sidebar lista as sessões. Sem chat antigo, sem launcher externo.
 */
export function activate(context: vscode.ExtensionContext): void {
  const sessionStore = new SessionStore();
  const sessionsTree = new SessionsTreeProvider(sessionStore);

  const editorRegistration = CappyEditorProvider.register(context, sessionStore);
  const treeRegistration = vscode.window.registerTreeDataProvider("cappy.sessions", sessionsTree);

  const newSessionCommand = vscode.commands.registerCommand("cappy.newSession", async () => {
    const config = vscode.workspace.getConfiguration("cappy");
    const primaryModel = config.get<string>("model", "openai/gpt-5");
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const { paths } = await sessionStore.createSession({ primaryModel, workspaceRoot });
    await vscode.commands.executeCommand(
      "vscode.openWith",
      vscode.Uri.file(paths.chat),
      CappyEditorProvider.viewType,
    );
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

  const deleteSessionCommand = vscode.commands.registerCommand(
    "cappy.deleteSession",
    async (item: SessionTreeItem | { id?: string } | undefined) => {
      let id: string | undefined;
      if (item instanceof SessionTreeItem) {
        id = item.session.id;
      } else if (item && typeof item === "object" && typeof item.id === "string") {
        id = item.id;
      }
      if (!id) {
        const list = await sessionStore.listSessions();
        const pick = await vscode.window.showQuickPick(
          list.map((s) => ({
            label: s.metadata.preview.title || s.id,
            description: s.id,
            sessionId: s.id,
          })),
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
    },
  );

  const refreshSessionsCommand = vscode.commands.registerCommand("cappy.refreshSessions", () => {
    sessionsTree.refresh();
  });

  const showLogCommand = vscode.commands.registerCommand("cappy.showLog", () => {
    showLog();
  });

  extensionDisposables.push(
    editorRegistration,
    treeRegistration,
    newSessionCommand,
    openSessionsCommand,
    deleteSessionCommand,
    refreshSessionsCommand,
    showLogCommand,
  );
  context.subscriptions.push(...extensionDisposables);
}

export function deactivate(): void {
  while (extensionDisposables.length > 0) {
    const disposable = extensionDisposables.pop();
    disposable?.dispose();
  }
  disposeLogger();
}
