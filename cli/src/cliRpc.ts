/**
 * Cappy CLI — JSON-RPC over stdio mode.
 *
 * Each line of stdin is one `RpcRequest`; each line of stdout is one
 * `RpcEvent`. Stderr is reserved for human-readable diagnostics
 * (the bridge logs it as-is). Designed to be spawned by the VS Code
 * extension, but the protocol is plain enough for any client.
 */

import * as readline from "node:readline";
import * as path from "node:path";
import * as fs from "node:fs";

import { AgentLoop } from "./agent/loop.js";
import type { ToolCall } from "./agent/types.js";
import { resetSessionContext } from "./agent/sessionContext.js";
import { loadConfig } from "./config/index.js";
import { buildSystemPromptPrefix, loadCappyMd } from "./cliWorkspaceContext.js";
import { filterToolsByMode, type ChatMode, type Message } from "./cliPipeline.js";
import { SessionStore } from "./session/SessionStore.js";
import { CAPPY_EVENT_VERSION, type ChatEvent } from "./session/sessionTypes.js";
import { toolsRegistry } from "./tools/index.js";

/* ── wire types (mirrored in extension/src/chat/cliBridge.ts) ────────────── */

type Permission = "confirm_each" | "allow_all" | "deny_all";

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface HistoryMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  createdAt: number;
}

export type RpcRequest =
  | { type: "init"; workspace?: string; mode?: ChatMode; permissionMode?: Permission }
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

export type RpcEvent =
  | { type: "ready"; version: string; workspace: string }
  | { type: "session.opened"; sessionId: string; history: HistoryMessage[] }
  | { type: "session.list"; sessions: SessionSummary[] }
  | { type: "stream.start"; messageId: string }
  | { type: "stream.delta"; messageId: string; text: string }
  | { type: "stream.tool"; messageId: string; tool: { id: string; name: string; input: unknown } }
  | {
      type: "stream.toolResult";
      messageId: string;
      result: { id: string; ok: boolean; output?: unknown; error?: string };
    }
  | { type: "stream.end"; messageId: string }
  | {
      type: "hitl.request";
      toolCallId: string;
      tool: { id: string; name: string; input: unknown };
    }
  | { type: "system"; message: string }
  | { type: "error"; message: string };

/* ── state ────────────────────────────────────────────────────────────────── */

interface RpcState {
  workspace: string;
  mode: ChatMode;
  permission: Permission;
  history: Message[];
  systemPromptPrefix: string | undefined;
  pendingHitl: Map<string, (approved: boolean) => void>;
  activeLoop: AgentLoop | null;
  store: SessionStore;
  currentSessionId: string | null;
  primaryModel: string;
}

function emit(event: RpcEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function readVersion(): string {
  try {
    const pkgPath = new URL("../../cli/package.json", import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function nowEvent(): { v: typeof CAPPY_EVENT_VERSION; t: number } {
  return { v: CAPPY_EVENT_VERSION, t: Date.now() };
}

async function ensureSession(state: RpcState): Promise<string> {
  if (state.currentSessionId) {
    return state.currentSessionId;
  }
  const listing = await state.store.createSession({
    primaryModel: state.primaryModel,
    workspaceRoot: state.workspace,
  });
  state.currentSessionId = listing.id;
  emit({ type: "session.opened", sessionId: listing.id, history: [] });
  return listing.id;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

export async function runRpc(opts: { workspace?: string }): Promise<void> {
  const workspace = path.resolve(opts.workspace ?? process.cwd());
  process.env.CAPPY_WORKSPACE_ROOT = workspace;

  let config;
  try {
    config = await loadConfig();
  } catch (err) {
    emit({ type: "error", message: `Failed to load config: ${(err as Error).message}` });
    process.exit(1);
  }
  if (!config.openrouter.apiKey || config.openrouter.apiKey.trim().length === 0) {
    emit({
      type: "error",
      message: "OpenRouter API key not configured. Run `cappy init` or edit ~/.cappy/config.json.",
    });
    process.exit(1);
  }
  if (!fs.existsSync(workspace)) {
    emit({ type: "error", message: `Workspace not found: ${workspace}` });
    process.exit(1);
  }

  const [, systemPromptPrefixRaw] = await Promise.all([
    loadCappyMd(workspace),
    buildSystemPromptPrefix(workspace),
  ]);

  const state: RpcState = {
    workspace,
    mode: "agent",
    permission: "confirm_each",
    history: [],
    systemPromptPrefix: systemPromptPrefixRaw ?? undefined,
    pendingHitl: new Map(),
    activeLoop: null,
    store: new SessionStore(),
    currentSessionId: null,
    primaryModel: config.openrouter.model,
  };

  emit({ type: "ready", version: readVersion(), workspace });

  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let req: RpcRequest;
    try {
      req = JSON.parse(trimmed) as RpcRequest;
    } catch (err) {
      emit({ type: "error", message: `invalid JSON on stdin: ${(err as Error).message}` });
      continue;
    }
    await handleRequest(req, state).catch((err: unknown) => {
      emit({ type: "error", message: (err as Error).message ?? String(err) });
    });
  }
}

async function handleRequest(req: RpcRequest, state: RpcState): Promise<void> {
  switch (req.type) {
    case "init":
      if (req.mode) state.mode = req.mode;
      if (req.permissionMode) state.permission = req.permissionMode;
      return;

    case "session.new":
      // Close current (if any) and reset in-memory state; the next user.message
      // will lazily create a fresh session via ensureSession.
      if (state.currentSessionId) {
        await state.store
          .setStatus(state.currentSessionId, "closed")
          .catch(() => undefined);
      }
      state.currentSessionId = null;
      state.history = [];
      resetSessionContext();
      return;

    case "session.list": {
      const listings = await state.store.listSessions();
      emit({
        type: "session.list",
        sessions: listings.map((l) => ({
          id: l.id,
          title: l.metadata.preview.title || l.id,
          updatedAt: l.metadata.updatedAt,
          messageCount: l.metadata.preview.messageCount,
        })),
      });
      return;
    }

    case "session.resume": {
      const events = await state.store.readEvents(req.sessionId);
      const history: HistoryMessage[] = [];
      const agentHistory: Message[] = [];
      for (const ev of events) {
        if (ev.kind === "user:message") {
          history.push({ id: ev.id, role: "user", text: ev.content, createdAt: ev.t });
          agentHistory.push({ role: "user", content: ev.content });
        } else if (ev.kind === "assistant:message") {
          history.push({ id: ev.id, role: "assistant", text: ev.content, createdAt: ev.t });
          // Note: tool_calls are intentionally dropped on resume — the agent
          // re-plans tool usage based on the recovered transcript.
          agentHistory.push({ role: "assistant", content: ev.content });
        }
      }
      state.currentSessionId = req.sessionId;
      state.history = agentHistory;
      resetSessionContext();
      emit({ type: "session.opened", sessionId: req.sessionId, history });
      return;
    }

    case "session.delete": {
      await state.store.deleteSession(req.sessionId);
      if (state.currentSessionId === req.sessionId) {
        state.currentSessionId = null;
        state.history = [];
        resetSessionContext();
      }
      return;
    }

    case "abort":
      state.activeLoop?.abort();
      for (const resolve of state.pendingHitl.values()) {
        resolve(false);
      }
      state.pendingHitl.clear();
      return;

    case "hitl.response": {
      const resolve = state.pendingHitl.get(req.toolCallId);
      if (resolve) {
        state.pendingHitl.delete(req.toolCallId);
        resolve(req.approved);
      }
      return;
    }

    case "shutdown":
      process.exit(0);

    case "user.message":
      await runTurn(req, state);
      return;
  }
}

async function runTurn(
  req: Extract<RpcRequest, { type: "user.message" }>,
  state: RpcState,
): Promise<void> {
  const sessionId = await ensureSession(state);

  const userText = buildUserText(req);
  state.history.push({ role: "user", content: userText });

  const userMessageId = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await appendEvent(state, sessionId, {
    ...nowEvent(),
    kind: "user:message",
    id: userMessageId,
    content: userText,
  });

  const messageId = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const loop = new AgentLoop({ workspaceRoot: state.workspace });
  state.activeLoop = loop;

  let assistantText = "";

  emit({ type: "stream.start", messageId });

  loop.on("stream:token", (token) => {
    assistantText += token;
    emit({ type: "stream.delta", messageId, text: token });
  });
  loop.on("stream:system", (msg) => {
    emit({ type: "system", message: msg });
  });
  loop.on("tool:executing", (tc: ToolCall) => {
    emit({
      type: "stream.tool",
      messageId,
      tool: { id: tc.id, name: tc.name, input: tc.arguments },
    });
    void appendEvent(state, sessionId, {
      ...nowEvent(),
      kind: "tool:executing",
      toolCallId: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    });
  });
  loop.on("tool:result", (tc: ToolCall, result: string) => {
    emit({
      type: "stream.toolResult",
      messageId,
      result: { id: tc.id, ok: true, output: result },
    });
    void appendEvent(state, sessionId, {
      ...nowEvent(),
      kind: "tool:result",
      toolCallId: tc.id,
      result,
    });
  });
  loop.on("tool:rejected", (tc: ToolCall) => {
    emit({
      type: "stream.toolResult",
      messageId,
      result: { id: tc.id, ok: false, error: "rejected by user" },
    });
    void appendEvent(state, sessionId, {
      ...nowEvent(),
      kind: "tool:rejected",
      toolCallId: tc.id,
    });
  });
  loop.on("tool:confirm", (tc: ToolCall) => {
    if (state.permission === "allow_all") {
      loop.approve(tc.id);
      return;
    }
    if (state.permission === "deny_all") {
      loop.reject(tc.id);
      return;
    }
    emit({
      type: "hitl.request",
      toolCallId: tc.id,
      tool: { id: tc.id, name: tc.name, input: tc.arguments },
    });
    state.pendingHitl.set(tc.id, (approved) => {
      if (approved) loop.approve(tc.id);
      else loop.reject(tc.id);
    });
  });
  loop.on("error", (err: Error) => {
    emit({ type: "error", message: err.message });
  });

  const tools = filterToolsByMode(toolsRegistry, state.mode);

  try {
    const runOpts: { chatMode: ChatMode; systemPromptPrefix?: string } = {
      chatMode: state.mode,
    };
    if (state.systemPromptPrefix !== undefined) {
      runOpts.systemPromptPrefix = state.systemPromptPrefix;
    }
    const updated = await loop.run(
      state.history as Parameters<typeof loop.run>[0],
      tools,
      runOpts,
    );
    state.history = updated as Message[];
  } catch (err) {
    emit({ type: "error", message: (err as Error).message });
  } finally {
    loop.removeAllListeners();
    state.activeLoop = null;
    if (assistantText.length > 0) {
      await appendEvent(state, sessionId, {
        ...nowEvent(),
        kind: "assistant:message",
        id: messageId,
        content: assistantText,
      });
    }
    emit({ type: "stream.end", messageId });
  }
}

async function appendEvent(state: RpcState, sessionId: string, event: ChatEvent): Promise<void> {
  try {
    await state.store.appendEvent(sessionId, event);
  } catch (err) {
    emit({ type: "system", message: `failed to persist event: ${(err as Error).message}` });
  }
}

function buildUserText(req: Extract<RpcRequest, { type: "user.message" }>): string {
  if (req.mentions.length === 0) {
    return req.text;
  }
  const refs = req.mentions
    .map((m) => {
      const range = m.range ? `:${m.range.startLine}-${m.range.endLine}` : "";
      return `- ${m.label}${range} (${m.uri})`;
    })
    .join("\n");
  return `${req.text}\n\n[Referenced files]\n${refs}`;
}
