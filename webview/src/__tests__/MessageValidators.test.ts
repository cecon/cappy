import { describe, it, expect } from "vitest";
import { isIncomingMessage } from "../bridge/MessageValidators";
import type { CappyConfig } from "../lib/types";

const validConfig: CappyConfig = {
  openrouter: { apiKey: "key", model: "gpt-4", visionModel: "gpt-4v" },
  agent: { activeAgent: "coder", systemPrompt: "You are a coder", maxIterations: 10 },
  mcp: { servers: [] },
};

const validToolCall = { id: "c1", name: "ReadFile", arguments: { path: "/foo.ts" } };

describe("isIncomingMessage — stream:token", () => {
  it("aceita payload válido", () => {
    expect(isIncomingMessage({ type: "stream:token", token: "hello" })).toBe(true);
  });
  it("rejeita token não-string", () => {
    expect(isIncomingMessage({ type: "stream:token", token: 42 })).toBe(false);
  });
  it("rejeita sem token", () => {
    expect(isIncomingMessage({ type: "stream:token" })).toBe(false);
  });
});

describe("isIncomingMessage — stream:done / session:cleared / config:saved", () => {
  it("stream:done aceita sem campos extras", () => {
    expect(isIncomingMessage({ type: "stream:done" })).toBe(true);
  });
  it("config:saved aceita sem campos extras", () => {
    expect(isIncomingMessage({ type: "config:saved" })).toBe(true);
  });
});

describe("isIncomingMessage — stream:system", () => {
  it("aceita message string", () => {
    expect(isIncomingMessage({ type: "stream:system", message: "aviso" })).toBe(true);
  });
  it("rejeita message não-string", () => {
    expect(isIncomingMessage({ type: "stream:system", message: 1 })).toBe(false);
  });
});

describe("isIncomingMessage — tool:confirm / tool:executing / tool:rejected", () => {
  for (const type of ["tool:confirm", "tool:executing", "tool:rejected"] as const) {
    it(`${type} aceita toolCall válido`, () => {
      expect(isIncomingMessage({ type, toolCall: validToolCall })).toBe(true);
    });
    it(`${type} rejeita sem toolCall`, () => {
      expect(isIncomingMessage({ type })).toBe(false);
    });
    it(`${type} rejeita toolCall sem id`, () => {
      expect(isIncomingMessage({ type, toolCall: { name: "X", arguments: {} } })).toBe(false);
    });
  }
});

describe("isIncomingMessage — tool:result", () => {
  it("aceita sem fileDiff", () => {
    expect(isIncomingMessage({ type: "tool:result", toolCall: validToolCall, result: "ok" })).toBe(true);
  });
  it("aceita com fileDiff válido", () => {
    const fileDiff = {
      path: "/foo.ts",
      additions: 1,
      deletions: 0,
      hunks: [{ lines: [{ type: "add", text: "+foo" }] }],
    };
    expect(isIncomingMessage({ type: "tool:result", toolCall: validToolCall, result: "ok", fileDiff })).toBe(true);
  });
  it("rejeita fileDiff com hunk inválido", () => {
    const badDiff = { path: "/x", additions: 1, deletions: 0, hunks: [{ lines: [{ type: "BAD", text: "x" }] }] };
    expect(isIncomingMessage({ type: "tool:result", toolCall: validToolCall, result: "ok", fileDiff: badDiff })).toBe(false);
  });
  it("rejeita result não-string", () => {
    expect(isIncomingMessage({ type: "tool:result", toolCall: validToolCall, result: 42 })).toBe(false);
  });
});

describe("isIncomingMessage — error", () => {
  it("aceita message string", () => {
    expect(isIncomingMessage({ type: "error", message: "algo correu mal" })).toBe(true);
  });
  it("rejeita message não-string", () => {
    expect(isIncomingMessage({ type: "error", message: null })).toBe(false);
  });
});

describe("isIncomingMessage — config:loaded", () => {
  it("aceita config válida", () => {
    expect(isIncomingMessage({ type: "config:loaded", config: validConfig })).toBe(true);
  });
  it("aceita config com contextWindowTokens válido", () => {
    const cfg = { ...validConfig, openrouter: { ...validConfig.openrouter, contextWindowTokens: 8192 } };
    expect(isIncomingMessage({ type: "config:loaded", config: cfg })).toBe(true);
  });
  it("rejeita contextWindowTokens < 4096", () => {
    const cfg = { ...validConfig, openrouter: { ...validConfig.openrouter, contextWindowTokens: 100 } };
    expect(isIncomingMessage({ type: "config:loaded", config: cfg })).toBe(false);
  });
  it("rejeita config sem openrouter", () => {
    expect(isIncomingMessage({ type: "config:loaded", config: { agent: {}, mcp: { servers: [] } } })).toBe(false);
  });
});

describe("isIncomingMessage — mcp:tools", () => {
  it("aceita lista vazia", () => {
    expect(isIncomingMessage({ type: "mcp:tools", tools: [] })).toBe(true);
  });
  it("aceita lista com MCP tool válida", () => {
    const tools = [{ serverName: "srv", name: "tool1", description: "desc" }];
    expect(isIncomingMessage({ type: "mcp:tools", tools })).toBe(true);
  });
  it("rejeita tools com item inválido", () => {
    const tools = [{ serverName: "srv", name: 42, description: "desc" }];
    expect(isIncomingMessage({ type: "mcp:tools", tools })).toBe(false);
  });
});

describe("isIncomingMessage — context:usage", () => {
  const valid = {
    type: "context:usage",
    usedTokens: 100,
    limitTokens: 1000,
    effectiveInputBudgetTokens: 800,
    didTrimForApi: false,
    droppedMessageCount: 0,
  };
  it("aceita payload válido", () => {
    expect(isIncomingMessage(valid)).toBe(true);
  });
  it("rejeita didTrimForApi não-boolean", () => {
    expect(isIncomingMessage({ ...valid, didTrimForApi: "no" })).toBe(false);
  });
  it("rejeita campo numérico ausente", () => {
    const { usedTokens: _, ...rest } = valid;
    expect(isIncomingMessage(rest)).toBe(false);
  });
});

describe("isIncomingMessage — agent:shell:start", () => {
  it("aceita command sem cwd", () => {
    expect(isIncomingMessage({ type: "agent:shell:start", command: "ls" })).toBe(true);
  });
  it("aceita com cwd string", () => {
    expect(isIncomingMessage({ type: "agent:shell:start", command: "ls", cwd: "/tmp" })).toBe(true);
  });
  it("rejeita cwd não-string", () => {
    expect(isIncomingMessage({ type: "agent:shell:start", command: "ls", cwd: 42 })).toBe(false);
  });
  it("rejeita sem command", () => {
    expect(isIncomingMessage({ type: "agent:shell:start" })).toBe(false);
  });
});

describe("isIncomingMessage — agent:shell:complete", () => {
  const base = { type: "agent:shell:complete", command: "ls", stdout: "file.ts", stderr: "" };
  it("aceita sem errorText", () => {
    expect(isIncomingMessage(base)).toBe(true);
  });
  it("aceita com errorText string", () => {
    expect(isIncomingMessage({ ...base, errorText: "failed" })).toBe(true);
  });
  it("rejeita errorText não-string", () => {
    expect(isIncomingMessage({ ...base, errorText: 42 })).toBe(false);
  });
  it("rejeita sem stdout", () => {
    const { stdout: _, ...rest } = base;
    expect(isIncomingMessage(rest)).toBe(false);
  });
});

describe("isIncomingMessage — hitl:policy", () => {
  it("aceita payload confirm_each", () => {
    expect(isIncomingMessage({
      type: "hitl:policy",
      destructiveTools: "confirm_each",
      sessionAutoApproveDestructive: false,
    })).toBe(true);
  });
  it("aceita allow_all", () => {
    expect(isIncomingMessage({
      type: "hitl:policy",
      destructiveTools: "allow_all",
      sessionAutoApproveDestructive: true,
    })).toBe(true);
  });
  it("rejeita valor inválido de destructiveTools", () => {
    expect(isIncomingMessage({
      type: "hitl:policy",
      destructiveTools: "invalid",
      sessionAutoApproveDestructive: false,
    })).toBe(false);
  });
  it("rejeita sessionAutoApproveDestructive não-boolean", () => {
    expect(isIncomingMessage({
      type: "hitl:policy",
      destructiveTools: "confirm_each",
      sessionAutoApproveDestructive: "yes",
    })).toBe(false);
  });
});

describe("isIncomingMessage — valores inválidos gerais", () => {
  it("rejeita null", () => {
    expect(isIncomingMessage(null)).toBe(false);
  });
  it("rejeita string", () => {
    expect(isIncomingMessage("stream:done")).toBe(false);
  });
  it("rejeita type desconhecido", () => {
    expect(isIncomingMessage({ type: "unknown:event" })).toBe(false);
  });
  it("rejeita sem type", () => {
    expect(isIncomingMessage({ token: "x" })).toBe(false);
  });
  it("rejeita type não-string", () => {
    expect(isIncomingMessage({ type: 42 })).toBe(false);
  });
});
