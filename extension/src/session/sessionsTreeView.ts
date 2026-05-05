import * as vscode from "vscode";

import type { SessionListing } from "./SessionStore";
import { SessionStore } from "./SessionStore";

export class SessionTreeItem extends vscode.TreeItem {
  public constructor(public readonly session: SessionListing) {
    super(buildLabel(session), vscode.TreeItemCollapsibleState.None);
    this.id = session.id;
    this.description = new Date(session.metadata.updatedAt).toLocaleString();
    this.tooltip = `${session.metadata.preview.title || "(untitled)"}\n${session.id}`;
    this.resourceUri = vscode.Uri.file(session.paths.chat);
    this.command = {
      command: "vscode.openWith",
      title: "Open Cappy Session",
      arguments: [this.resourceUri, "cappy.session"],
    };
    this.contextValue = "cappy.session";
  }
}

function buildLabel(s: SessionListing): string {
  const title = s.metadata.preview.title.trim();
  if (title.length > 0) {
    return title;
  }
  return s.id;
}

/**
 * Tree view backing `cappy.openSessions`. Lists sessions from `~/.cappy/sessions/`
 * sorted by updatedAt desc.
 */
export class SessionsTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private readonly emitter = new vscode.EventEmitter<SessionTreeItem | undefined>();

  public readonly onDidChangeTreeData = this.emitter.event;

  public constructor(private readonly store: SessionStore) {}

  public getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(): Promise<SessionTreeItem[]> {
    const list = await this.store.listSessions();
    return list.map((s) => new SessionTreeItem(s));
  }

  public refresh(): void {
    this.emitter.fire(undefined);
  }
}
