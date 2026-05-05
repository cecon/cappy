import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type { TodoItem } from "../agent/sessionContext";
import {
  CAPPY_EVENT_VERSION,
  CAPPY_SESSION_VERSION,
  CAPPY_TODOS_VERSION,
  type AgentName,
  type AgentUsage,
  type ChatEvent,
  type SessionMetadata,
  type SessionStatus,
  type SessionTotals,
  type TodosFile,
  makeEmptyAgentUsage,
  makeEmptyTotals,
} from "./sessionTypes";

const HOME = os.homedir();
const ROOT = path.join(HOME, ".cappy", "sessions");
const ID_TITLE_MAX = 80;

export interface CreateSessionInput {
  primaryModel: string;
  workspaceRoot: string | null;
}

export interface SessionPaths {
  dir: string;
  chat: string;
  metadata: string;
  plan: string;
  todos: string;
  attachments: string;
}

export interface SessionListing {
  id: string;
  metadata: SessionMetadata;
  paths: SessionPaths;
}

export interface UsageDelta {
  agent: AgentName;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  llmCallDelta?: number;
  toolCallDelta?: number;
}

/**
 * File-system owner of `~/.cappy/sessions/<id>/`. Pure async I/O, no VS Code coupling.
 */
export class SessionStore {
  public constructor(private readonly root: string = ROOT) {}

  public getRoot(): string {
    return this.root;
  }

  public paths(id: string): SessionPaths {
    const dir = path.join(this.root, id);
    return {
      dir,
      chat: path.join(dir, "chat.cappy"),
      metadata: path.join(dir, "session.json"),
      plan: path.join(dir, "plan.md"),
      todos: path.join(dir, "todos.json"),
      attachments: path.join(dir, "attachments"),
    };
  }

  public async createSession(input: CreateSessionInput): Promise<SessionListing> {
    const id = generateSessionId();
    const paths = this.paths(id);
    await fs.mkdir(paths.dir, { recursive: true });
    const now = new Date().toISOString();
    const metadata: SessionMetadata = {
      v: CAPPY_SESSION_VERSION,
      id,
      createdAt: now,
      updatedAt: now,
      status: "active",
      workspaceRoot: input.workspaceRoot,
      primaryModel: input.primaryModel,
      totals: makeEmptyTotals(),
      agents: {},
      preview: { title: "", messageCount: 0 },
    };
    await Promise.all([
      writeJsonAtomic(paths.metadata, metadata),
      writeIfMissing(paths.chat, ""),
      writeIfMissing(paths.plan, ""),
      writeJsonAtomic(paths.todos, makeEmptyTodos()),
    ]);
    return { id, metadata, paths };
  }

  public async listSessions(): Promise<SessionListing[]> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(this.root);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        return [];
      }
      throw err;
    }
    const out: SessionListing[] = [];
    for (const name of entries) {
      const paths = this.paths(name);
      const metadata = await this.readMetadata(name).catch(() => null);
      if (!metadata) {
        continue;
      }
      out.push({ id: name, metadata, paths });
    }
    out.sort((a, b) => (a.metadata.updatedAt < b.metadata.updatedAt ? 1 : -1));
    return out;
  }

  public async readMetadata(id: string): Promise<SessionMetadata> {
    const raw = await fs.readFile(this.paths(id).metadata, "utf-8");
    return JSON.parse(raw) as SessionMetadata;
  }

  public async writeMetadata(id: string, metadata: SessionMetadata): Promise<void> {
    metadata.updatedAt = new Date().toISOString();
    await writeJsonAtomic(this.paths(id).metadata, metadata);
  }

  public async setStatus(id: string, status: SessionStatus): Promise<SessionMetadata> {
    const meta = await this.readMetadata(id);
    meta.status = status;
    await this.writeMetadata(id, meta);
    return meta;
  }

  public async deleteSession(id: string): Promise<void> {
    await fs.rm(this.paths(id).dir, { recursive: true, force: true });
  }

  /**
   * Append a chat event to the JSONL transcript and refresh metadata totals/preview.
   */
  public async appendEvent(id: string, event: ChatEvent): Promise<void> {
    if (event.v !== CAPPY_EVENT_VERSION) {
      throw new Error(`Unsupported chat event version: ${String(event.v)}`);
    }
    const paths = this.paths(id);
    const line = JSON.stringify(event) + "\n";
    await fs.mkdir(paths.dir, { recursive: true });
    await fs.appendFile(paths.chat, line, "utf-8");
    await this.refreshMetadataAfterEvent(id, event);
  }

  public async readEvents(id: string): Promise<ChatEvent[]> {
    let raw = "";
    try {
      raw = await fs.readFile(this.paths(id).chat, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        return [];
      }
      throw err;
    }
    const out: ChatEvent[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      try {
        out.push(JSON.parse(trimmed) as ChatEvent);
      } catch {
        // Half-written tail line: skip.
      }
    }
    return out;
  }

  public async readTodos(id: string): Promise<TodosFile> {
    try {
      const raw = await fs.readFile(this.paths(id).todos, "utf-8");
      return JSON.parse(raw) as TodosFile;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        return makeEmptyTodos();
      }
      throw err;
    }
  }

  public async writeTodos(id: string, todos: TodoItem[]): Promise<TodosFile> {
    const file: TodosFile = {
      v: CAPPY_TODOS_VERSION,
      updatedAt: new Date().toISOString(),
      todos: [...todos],
    };
    await writeJsonAtomic(this.paths(id).todos, file);
    return file;
  }

  public async readPlan(id: string): Promise<string> {
    try {
      return await fs.readFile(this.paths(id).plan, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        return "";
      }
      throw err;
    }
  }

  public async writePlan(id: string, content: string): Promise<void> {
    const paths = this.paths(id);
    await fs.mkdir(paths.dir, { recursive: true });
    await fs.writeFile(paths.plan, content, "utf-8");
  }

  /**
   * Apply a usage delta from an LLM call onto the session metadata.
   */
  public async applyUsage(id: string, delta: UsageDelta): Promise<SessionMetadata> {
    const meta = await this.readMetadata(id);
    const agentName = delta.agent || "main";
    const agent = meta.agents[agentName] ?? makeEmptyAgentUsage();
    agent.tokensIn += delta.tokensIn;
    agent.tokensOut += delta.tokensOut;
    agent.costUSD += delta.costUSD;
    agent.calls += delta.llmCallDelta ?? 1;
    meta.agents[agentName] = agent;
    meta.totals = sumTotals(meta.totals, delta);
    await this.writeMetadata(id, meta);
    return meta;
  }

  private async refreshMetadataAfterEvent(id: string, event: ChatEvent): Promise<void> {
    const meta = await this.readMetadata(id).catch(() => null);
    if (!meta) {
      return;
    }
    let dirty = false;
    if (event.kind === "user:message" && meta.preview.title.length === 0) {
      meta.preview.title = event.content.replace(/\s+/g, " ").trim().slice(0, ID_TITLE_MAX);
      dirty = true;
    }
    if (event.kind === "user:message" || event.kind === "assistant:message") {
      meta.preview.messageCount += 1;
      dirty = true;
    }
    if (event.kind === "tool:executing") {
      meta.totals.toolCalls += 1;
      dirty = true;
    }
    if (event.kind === "session:closed") {
      meta.status = event.reason === "errored" ? "errored" : "closed";
      dirty = true;
    }
    if (dirty) {
      await this.writeMetadata(id, meta);
    }
  }
}

function generateSessionId(): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString().padStart(4, "0");
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const hh = now.getHours().toString().padStart(2, "0");
  const mi = now.getMinutes().toString().padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).padEnd(5, "0");
  return `${yyyy}-${mm}-${dd}T${hh}${mi}-${rand}`;
}

function makeEmptyTodos(): TodosFile {
  return { v: CAPPY_TODOS_VERSION, updatedAt: new Date().toISOString(), todos: [] };
}

function sumTotals(totals: SessionTotals, delta: UsageDelta): SessionTotals {
  return {
    tokensIn: totals.tokensIn + delta.tokensIn,
    tokensOut: totals.tokensOut + delta.tokensOut,
    costUSD: totals.costUSD + delta.costUSD,
    llmCalls: totals.llmCalls + (delta.llmCallDelta ?? 1),
    toolCalls: totals.toolCalls + (delta.toolCallDelta ?? 0),
  };
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const data = JSON.stringify(value, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmp, data, "utf-8");
  await fs.rename(tmp, filePath);
}

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content, "utf-8");
  }
}

/**
 * Reusable agent name used when no sub-agent attribution is available.
 */
export const PRIMARY_AGENT: AgentName = "main";

export function makeUsageDelta(input: Partial<UsageDelta> & { agent: AgentName }): UsageDelta {
  const out: UsageDelta = {
    agent: input.agent,
    tokensIn: input.tokensIn ?? 0,
    tokensOut: input.tokensOut ?? 0,
    costUSD: input.costUSD ?? 0,
  };
  if (input.llmCallDelta !== undefined) {
    out.llmCallDelta = input.llmCallDelta;
  }
  if (input.toolCallDelta !== undefined) {
    out.toolCallDelta = input.toolCallDelta;
  }
  return out;
}

export type { AgentUsage };
