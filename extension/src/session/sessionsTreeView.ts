import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

interface SessionInfo {
  id: string;
  dir: string;
  chatPath: string;
  title: string;
  updatedAt: string | null;
  messageCount: number;
  llmCalls: number;
}

const SESSIONS_ROOT = path.join(os.homedir(), ".cappy", "sessions");

async function listSessions(): Promise<SessionInfo[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(SESSIONS_ROOT);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    throw err;
  }
  const out: SessionInfo[] = [];
  for (const name of entries) {
    const dir = path.join(SESSIONS_ROOT, name);
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat?.isDirectory()) {
      continue;
    }
    const info: SessionInfo = {
      id: name,
      dir,
      chatPath: path.join(dir, "chat.cappy"),
      title: name,
      updatedAt: null,
      messageCount: 0,
      llmCalls: 0,
    };
    try {
      const raw = await fs.readFile(path.join(dir, "session.json"), "utf-8");
      const meta = JSON.parse(raw) as {
        preview?: { title?: string; messageCount?: number };
        totals?: { llmCalls?: number };
        updatedAt?: string;
      };
      info.title = meta.preview?.title?.trim() || name;
      info.messageCount = meta.preview?.messageCount ?? 0;
      info.llmCalls = meta.totals?.llmCalls ?? 0;
      info.updatedAt = meta.updatedAt ?? null;
    } catch {
      // Folder without session.json — show by id only.
    }
    out.push(info);
  }
  out.sort((a, b) => {
    const aTime = a.updatedAt ?? "";
    const bTime = b.updatedAt ?? "";
    return aTime < bTime ? 1 : -1;
  });
  return out;
}

export class SessionTreeItem extends vscode.TreeItem {
  public readonly sessionId: string;

  public constructor(public readonly session: SessionInfo) {
    super(session.title, vscode.TreeItemCollapsibleState.None);
    this.sessionId = session.id;
    this.id = session.id;
    if (session.updatedAt) {
      this.description = new Date(session.updatedAt).toLocaleString();
    }
    this.tooltip =
      `${session.title}\n${session.id}\n` +
      `${session.messageCount} messages · ${session.llmCalls} llm calls`;
    this.resourceUri = vscode.Uri.file(session.chatPath);
    this.contextValue = "cappy.session";
    this.command = {
      command: "cappy.resumeSession",
      title: "Resume Cappy Session",
      arguments: [session.id],
    };
  }
}

export class SessionsTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private readonly emitter = new vscode.EventEmitter<SessionTreeItem | undefined>();

  public readonly onDidChangeTreeData = this.emitter.event;

  public getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(): Promise<SessionTreeItem[]> {
    const list = await listSessions();
    return list.map((s) => new SessionTreeItem(s));
  }

  public refresh(): void {
    this.emitter.fire(undefined);
  }
}

export async function deleteSessionFolder(sessionId: string): Promise<void> {
  const dir = path.join(SESSIONS_ROOT, sessionId);
  await fs.rm(dir, { recursive: true, force: true });
}
