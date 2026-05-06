import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as readline from "node:readline";

import * as vscode from "vscode";

import type { HostToWebview, WebviewToHost } from "./protocol.js";

/**
 * Bridge between the VS Code extension host and a `cappy --rpc` child
 * process. The protocol is line-delimited JSON: each stdin line is a
 * `RpcRequest`; each stdout line is a `RpcEvent`. Mirrors `cli/src/cliRpc.ts`.
 */

type Permission = "confirm_each" | "allow_all" | "deny_all";

interface RpcSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface RpcHistoryMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  createdAt: number;
}

type RpcRequest =
  | { type: "init"; workspace?: string; mode?: "agent" | "ask" | "plain"; permissionMode?: Permission }
  | {
      type: "user.message";
      sessionId: string | null;
      text: string;
      mentions: { uri: string; label: string; range?: { startLine: number; endLine: number } }[];
    }
  | { type: "session.new" }
  | { type: "session.list" }
  | { type: "session.resume"; sessionId: string }
  | { type: "session.delete"; sessionId: string }
  | { type: "abort" }
  | { type: "hitl.response"; toolCallId: string; approved: boolean }
  | { type: "shutdown" };

type RpcEvent =
  | { type: "ready"; version: string; workspace: string }
  | { type: "session.opened"; sessionId: string; history: RpcHistoryMessage[] }
  | { type: "session.list"; sessions: RpcSessionSummary[] }
  | { type: "stream.start"; messageId: string }
  | { type: "stream.delta"; messageId: string; text: string }
  | { type: "stream.tool"; messageId: string; tool: { id: string; name: string; input: unknown } }
  | {
      type: "stream.toolResult";
      messageId: string;
      result: { id: string; ok: boolean; output?: unknown; error?: string };
    }
  | { type: "stream.end"; messageId: string }
  | { type: "hitl.request"; toolCallId: string; tool: { id: string; name: string; input: unknown } }
  | { type: "system"; message: string }
  | { type: "error"; message: string };

export interface BridgeHandlers {
  onEvent: (msg: HostToWebview) => void;
  onProcessExit: (code: number | null) => void;
  log: (level: "info" | "warn" | "error", message: string) => void;
}

export class CliBridge implements vscode.Disposable {
  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private ready = false;
  private buffered: RpcRequest[] = [];

  public constructor(private readonly handlers: BridgeHandlers) {}

  public start(): void {
    if (this.child) {
      return;
    }
    const { command, args, cwd, env } = resolveSpawn();
    this.handlers.log("info", `spawning: ${command} ${args.join(" ")} (cwd=${cwd})`);
    try {
      this.child = spawn(command, args, {
        cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
    } catch (err) {
      this.handlers.onEvent({
        type: "error",
        message: `Failed to spawn cappy CLI: ${(err as Error).message}`,
      });
      return;
    }

    this.rl = readline.createInterface({ input: this.child.stdout });
    this.rl.on("line", (line) => this.onLine(line));

    this.child.stderr.on("data", (data: Buffer) => {
      const text = data.toString("utf-8").trimEnd();
      if (text.length > 0) this.handlers.log("info", `[cli] ${text}`);
    });

    this.child.on("error", (err) => {
      this.handlers.onEvent({
        type: "error",
        message: `cappy CLI process error: ${err.message}`,
      });
    });

    this.child.on("exit", (code) => {
      this.ready = false;
      this.handlers.onProcessExit(code);
      this.cleanup();
    });
  }

  public send(msg: WebviewToHost): void {
    const req = translateOutbound(msg);
    if (!req) {
      return;
    }
    if (!this.ready) {
      this.buffered.push(req);
      return;
    }
    this.write(req);
  }

  public abort(): void {
    if (this.ready) this.write({ type: "abort" });
  }

  public newSession(): void {
    if (this.ready) this.write({ type: "session.new" });
    else this.buffered.push({ type: "session.new" });
  }

  public listSessions(): void {
    if (this.ready) this.write({ type: "session.list" });
    else this.buffered.push({ type: "session.list" });
  }

  public resumeSession(sessionId: string): void {
    const req: RpcRequest = { type: "session.resume", sessionId };
    if (this.ready) this.write(req);
    else this.buffered.push(req);
  }

  public deleteSession(sessionId: string): void {
    const req: RpcRequest = { type: "session.delete", sessionId };
    if (this.ready) this.write(req);
    else this.buffered.push(req);
  }

  public dispose(): void {
    if (this.child) {
      try {
        this.write({ type: "shutdown" });
      } catch {
        // ignore broken pipes during shutdown
      }
      this.child.kill();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.rl?.close();
    this.rl = null;
    this.child = null;
    this.ready = false;
    this.buffered = [];
  }

  private write(req: RpcRequest): void {
    const ok = this.child?.stdin.write(`${JSON.stringify(req)}\n`);
    if (!ok) {
      this.handlers.log("warn", "stdin write returned false (backpressure)");
    }
  }

  private onLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let event: RpcEvent;
    try {
      event = JSON.parse(trimmed) as RpcEvent;
    } catch (err) {
      this.handlers.log("error", `bad JSON from cli: ${(err as Error).message} :: ${trimmed.slice(0, 200)}`);
      return;
    }
    if (event.type === "ready") {
      this.ready = true;
      this.flushBuffered();
      return;
    }
    const out = translateInbound(event);
    if (out) this.handlers.onEvent(out);
  }

  private flushBuffered(): void {
    const queue = this.buffered;
    this.buffered = [];
    for (const req of queue) {
      this.write(req);
    }
  }
}

/* ── translation ────────────────────────────────────────────────────────── */

function translateOutbound(msg: WebviewToHost): RpcRequest | null {
  switch (msg.type) {
    case "user.message":
      return {
        type: "user.message",
        sessionId: msg.sessionId,
        text: msg.text,
        mentions: msg.mentions.map((m) => ({
          uri: m.uri,
          label: m.label,
          ...(m.range ? { range: m.range } : {}),
        })),
      };
    case "session.new":
      return { type: "session.new" };
    case "session.list":
      return { type: "session.list" };
    case "session.resume":
      return { type: "session.resume", sessionId: msg.sessionId };
    case "session.delete":
      return { type: "session.delete", sessionId: msg.sessionId };
    case "hitl.response":
      return { type: "hitl.response", toolCallId: msg.toolCallId, approved: msg.approved };
    case "abort":
      return { type: "abort" };
    default:
      return null;
  }
}

function translateInbound(event: RpcEvent): HostToWebview | null {
  switch (event.type) {
    case "session.opened":
      return {
        type: "session.opened",
        sessionId: event.sessionId,
        history: event.history.map((h) => ({
          id: h.id,
          role: h.role,
          text: h.text,
          createdAt: h.createdAt,
        })),
      };
    case "session.list":
      return {
        type: "session.list",
        sessions: event.sessions.map((s) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
          messageCount: s.messageCount,
        })),
      };
    case "stream.start":
      return { type: "stream.start", messageId: event.messageId };
    case "stream.delta":
      return { type: "stream.delta", messageId: event.messageId, text: event.text };
    case "stream.tool":
      return { type: "stream.tool", messageId: event.messageId, tool: event.tool };
    case "stream.toolResult":
      return { type: "stream.toolResult", messageId: event.messageId, result: event.result };
    case "stream.end":
      return { type: "stream.end", messageId: event.messageId };
    case "hitl.request":
      return { type: "hitl.request", toolCallId: event.toolCallId, tool: event.tool };
    case "system":
      return { type: "error", message: event.message };
    case "error":
      return { type: "error", message: event.message };
    default:
      return null;
  }
}

/* ── spawn resolution ──────────────────────────────────────────────────── */

function resolveSpawn(): {
  command: string;
  args: string[];
  cwd: string | undefined;
  env: NodeJS.ProcessEnv;
} {
  const cfg = vscode.workspace.getConfiguration("cappy");
  const raw = cfg.get<string>("cli.command", "cappy").trim();
  const tokens = tokenize(raw);
  if (tokens.length === 0) {
    throw new Error("cappy.cli.command is empty");
  }
  const [command, ...args] = tokens;
  args.push("--rpc");

  const envVars = cfg.get<{ name: string; value: string }[]>("environmentVariables", []);
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const { name, value } of envVars) {
    env[name] = value;
  }

  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return { command: command!, args, cwd, env };
}

/** Lightweight quote-aware tokenizer for cli.command setting. */
function tokenize(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur.length > 0) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}
