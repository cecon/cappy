import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { SessionStore } from "../SessionStore";
import { CAPPY_EVENT_VERSION, type ChatEvent } from "../sessionTypes";

let tmpRoot: string;
let store: SessionStore;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cappy-store-"));
  store = new SessionStore(tmpRoot);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

function ev(body: { kind: string; [k: string]: unknown; t?: number }): ChatEvent {
  const { t, ...rest } = body;
  return { v: CAPPY_EVENT_VERSION, t: t ?? Date.now(), ...rest } as unknown as ChatEvent;
}

describe("SessionStore — createSession", () => {
  it("cria pasta com chat.cappy, session.json, plan.md, todos.json", async () => {
    const { id, paths } = await store.createSession({
      primaryModel: "openai/gpt-5",
      workspaceRoot: "/some/ws",
    });

    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{4}-[a-z0-9]{5}$/);
    await expect(fs.access(paths.chat)).resolves.toBeUndefined();
    await expect(fs.access(paths.metadata)).resolves.toBeUndefined();
    await expect(fs.access(paths.plan)).resolves.toBeUndefined();
    await expect(fs.access(paths.todos)).resolves.toBeUndefined();
  });

  it("metadata inicial em status active com totals zerados", async () => {
    const { id } = await store.createSession({ primaryModel: "x", workspaceRoot: null });
    const meta = await store.readMetadata(id);
    expect(meta.status).toBe("active");
    expect(meta.totals).toEqual({ tokensIn: 0, tokensOut: 0, costUSD: 0, llmCalls: 0, toolCalls: 0 });
    expect(meta.agents).toEqual({});
  });
});

describe("SessionStore — appendEvent / readEvents", () => {
  it("escreve uma linha JSON por evento e relê em ordem", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });

    const e1 = ev({ kind: "user:message", id: "u1", content: "oi" });
    const e2 = ev({ kind: "assistant:message", id: "a1", content: "olá" });

    await store.appendEvent(id, e1);
    await store.appendEvent(id, e2);

    const events = await store.readEvents(id);
    expect(events).toHaveLength(2);
    expect(events[0]?.kind).toBe("user:message");
    expect(events[1]?.kind).toBe("assistant:message");
  });

  it("ignora linhas truncadas (crash safety)", async () => {
    const { id, paths } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.appendEvent(id, ev({ kind: "user:message", id: "u1", content: "hello" }));
    await fs.appendFile(paths.chat, "{ \"v\": 1, \"kind\": \"user:m", "utf-8");

    const events = await store.readEvents(id);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("user:message");
  });

  it("readEvents em sessão inexistente devolve array vazio", async () => {
    const events = await store.readEvents("nope");
    expect(events).toEqual([]);
  });

  it("user:message popula preview.title e incrementa messageCount", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.appendEvent(id, ev({ kind: "user:message", id: "u1", content: "Primeiro pedido" }));
    await store.appendEvent(id, ev({ kind: "assistant:message", id: "a1", content: "resposta" }));
    const meta = await store.readMetadata(id);
    expect(meta.preview.title).toBe("Primeiro pedido");
    expect(meta.preview.messageCount).toBe(2);
  });

  it("tool:executing incrementa totals.toolCalls", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.appendEvent(id, ev({ kind: "tool:executing", toolCallId: "t1", name: "Edit", arguments: {} }));
    await store.appendEvent(id, ev({ kind: "tool:executing", toolCallId: "t2", name: "Bash", arguments: {} }));
    const meta = await store.readMetadata(id);
    expect(meta.totals.toolCalls).toBe(2);
  });

  it("session:closed fecha status conforme reason", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.appendEvent(id, ev({ kind: "session:closed", reason: "errored" }));
    expect((await store.readMetadata(id)).status).toBe("errored");

    const { id: id2 } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.appendEvent(id2, ev({ kind: "session:closed", reason: "user" }));
    expect((await store.readMetadata(id2)).status).toBe("closed");
  });
});

describe("SessionStore — applyUsage", () => {
  it("acumula por agente e nos totals", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.applyUsage(id, { agent: "main", tokensIn: 100, tokensOut: 20, costUSD: 0.001 });
    await store.applyUsage(id, { agent: "main", tokensIn: 50, tokensOut: 10, costUSD: 0.0005 });
    await store.applyUsage(id, { agent: "explore", tokensIn: 200, tokensOut: 40, costUSD: 0.002 });

    const meta = await store.readMetadata(id);
    expect(meta.agents.main?.calls).toBe(2);
    expect(meta.agents.main?.tokensIn).toBe(150);
    expect(meta.agents.main?.tokensOut).toBe(30);
    expect(meta.agents.main?.costUSD).toBeCloseTo(0.0015, 6);
    expect(meta.agents.explore?.calls).toBe(1);
    expect(meta.totals.tokensIn).toBe(350);
    expect(meta.totals.tokensOut).toBe(70);
    expect(meta.totals.llmCalls).toBe(3);
  });
});

describe("SessionStore — todos / plan", () => {
  it("writeTodos persiste e readTodos relê", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    const items = [
      { content: "A", status: "pending" as const, activeForm: "Doing A" },
      { content: "B", status: "in_progress" as const, activeForm: "Doing B" },
    ];
    await store.writeTodos(id, items);
    const file = await store.readTodos(id);
    expect(file.todos).toEqual(items);
    expect(file.v).toBe(1);
  });

  it("readTodos sem ficheiro devolve TodosFile vazio", async () => {
    const { id, paths } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await fs.rm(paths.todos);
    const file = await store.readTodos(id);
    expect(file.todos).toEqual([]);
  });

  it("writePlan e readPlan round-trip", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.writePlan(id, "# Plano\n- passo 1");
    expect(await store.readPlan(id)).toBe("# Plano\n- passo 1");
  });
});

describe("SessionStore — listSessions", () => {
  it("lista sessões ordenadas por updatedAt desc", async () => {
    const a = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.createSession({ primaryModel: "m", workspaceRoot: null });

    await store.appendEvent(a.id, ev({ kind: "user:message", id: "u", content: "depois" }));

    const list = await store.listSessions();
    expect(list.map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it("ignora pastas sem session.json", async () => {
    const { id } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await fs.mkdir(path.join(tmpRoot, "lixo"), { recursive: true });
    const list = await store.listSessions();
    expect(list.map((s) => s.id)).toEqual([id]);
  });

  it("listSessions em root inexistente devolve array vazio", async () => {
    const empty = new SessionStore(path.join(tmpRoot, "missing"));
    expect(await empty.listSessions()).toEqual([]);
  });
});

describe("SessionStore — deleteSession", () => {
  it("remove a pasta inteira", async () => {
    const { id, paths } = await store.createSession({ primaryModel: "m", workspaceRoot: null });
    await store.deleteSession(id);
    await expect(fs.access(paths.dir)).rejects.toThrow();
  });
});
