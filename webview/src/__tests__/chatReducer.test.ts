import { describe, it, expect } from "vitest";
import { chatReducer, type ChatAction } from "../hooks/useChatReducer";
import { INITIAL_CHAT_STATE, type ChatState } from "../domain/entities/ChatState";
import type { ToolCall, CappyConfig } from "../lib/types";

const initialState: ChatState = INITIAL_CHAT_STATE;

function tc(id: string, name: string): ToolCall {
  return { id, name, arguments: { path: "/foo.ts" } };
}

const baseConfig: CappyConfig = {
  openrouter: { apiKey: "key", model: "gpt-4", visionModel: "gpt-4v" },
  agent: { activeAgent: "coder", systemPrompt: "You", maxIterations: 10 },
  mcp: { servers: [] },
};

describe("chatReducer — SEND_START", () => {
  it("inicia streaming e limpa erro", () => {
    const state = { ...initialState, errorMessage: "prev error", isStreaming: false };
    const action: ChatAction = { type: "SEND_START", messages: [{ role: "user", content: "go" }], mode: "agent" };
    const next = chatReducer(state, action);
    expect(next.isStreaming).toBe(true);
    expect(next.errorMessage).toBeNull();
    expect(next.messages).toHaveLength(1);
    expect(next.activity).not.toBeNull();
  });
});

describe("chatReducer — STOP", () => {
  it("para streaming e limpa activity", () => {
    const state = { ...initialState, isStreaming: true };
    const next = chatReducer(state, { type: "STOP" });
    expect(next.isStreaming).toBe(false);
    expect(next.activity).toBeNull();
  });
});

describe("chatReducer — SESSION_RESET", () => {
  it("restaura estado inicial mas incrementa draftSessionKey", () => {
    const state = {
      ...initialState,
      messages: [{ role: "user" as const, content: "hi" }],
      isStreaming: true,
      draftSessionKey: 3,
    };
    const next = chatReducer(state, { type: "SESSION_RESET" });
    expect(next.messages).toHaveLength(0);
    expect(next.isStreaming).toBe(false);
    expect(next.draftSessionKey).toBe(4);
  });

  it("preserva runtimeConfig", () => {
    const state = { ...initialState, runtimeConfig: baseConfig };
    const next = chatReducer(state, { type: "SESSION_RESET" });
    expect(next.runtimeConfig).toBe(baseConfig);
  });

  it("limpa toolRows", () => {
    const toolCall = tc("c1", "bash");
    let state = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    state = chatReducer(state, { type: "SESSION_RESET" });
    expect(state.toolRows).toHaveLength(0);
  });
});

describe("chatReducer — STREAM_TOKEN", () => {
  it("acrescenta token à mensagem assistant", () => {
    const next = chatReducer(initialState, { type: "STREAM_TOKEN", token: "hello" });
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]!.content).toBe("hello");
    expect(next.isStreaming).toBe(true);
  });

  it("concatena múltiplos tokens", () => {
    let state = chatReducer(initialState, { type: "STREAM_TOKEN", token: "hel" });
    state = chatReducer(state, { type: "STREAM_TOKEN", token: "lo" });
    expect(state.messages[0]!.content).toBe("hello");
  });
});

describe("chatReducer — STREAM_DONE", () => {
  it("para streaming e limpa activity", () => {
    const state = { ...initialState, isStreaming: true };
    const next = chatReducer(state, { type: "STREAM_DONE" });
    expect(next.isStreaming).toBe(false);
    expect(next.activity).toBeNull();
  });
});

describe("chatReducer — STREAM_SYSTEM", () => {
  it("adiciona mensagem de aviso", () => {
    const next = chatReducer(initialState, { type: "STREAM_SYSTEM", message: "rate limit" });
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]!.role).toBe("tool");
    expect(next.messages[0]!.content).toContain("rate limit");
  });
});

describe("chatReducer — TOOL_CONFIRM", () => {
  it("adiciona toolCall a pendingConfirms", () => {
    const toolCall = tc("c1", "bash");
    const next = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    expect(next.pendingConfirms).toHaveLength(1);
    expect(next.pendingConfirms[0]!.id).toBe("c1");
  });

  it("não duplica toolCall já presente", () => {
    const toolCall = tc("c1", "bash");
    let state = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    state = chatReducer(state, { type: "TOOL_CONFIRM", toolCall });
    expect(state.pendingConfirms).toHaveLength(1);
  });

  it("adiciona ToolRowItem com status pending", () => {
    const toolCall = tc("c1", "bash");
    const next = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    expect(next.toolRows).toHaveLength(1);
    expect(next.toolRows[0]!.id).toBe("c1");
    expect(next.toolRows[0]!.status).toBe("pending");
  });

  it("adiciona placeholder tool slot na lista de mensagens", () => {
    const toolCall = tc("c1", "bash");
    const next = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    const slot = next.messages.find((m) => m.tool_call_id === "c1");
    expect(slot).toBeDefined();
    expect(slot!.role).toBe("tool");
  });
});

describe("chatReducer — TOOL_EXECUTING", () => {
  it("cria toolRow com status running", () => {
    const toolCall = tc("c1", "readFile");
    const next = chatReducer(initialState, { type: "TOOL_EXECUTING", toolCall });
    expect(next.toolRows).toHaveLength(1);
    expect(next.toolRows[0]!.status).toBe("running");
  });

  it("atualiza status para running se toolRow já existe", () => {
    const toolCall = tc("c1", "bash");
    let state = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    state = chatReducer(state, { type: "TOOL_EXECUTING", toolCall });
    expect(state.toolRows).toHaveLength(1);
    expect(state.toolRows[0]!.status).toBe("running");
  });

  it("atualiza activity", () => {
    const toolCall = tc("c1", "readFile");
    const next = chatReducer(initialState, { type: "TOOL_EXECUTING", toolCall });
    expect(next.activity).not.toBeNull();
  });
});

describe("chatReducer — TOOL_RESULT", () => {
  it("remove toolCall de pendingConfirms", () => {
    const toolCall = tc("c1", "bash");
    let state = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    state = chatReducer(state, { type: "TOOL_RESULT", toolCall, result: "ok" });
    expect(state.pendingConfirms).toHaveLength(0);
  });

  it("atualiza toolRow status para done com output", () => {
    const toolCall = tc("c1", "readFile");
    let state = chatReducer(initialState, { type: "TOOL_EXECUTING", toolCall });
    state = chatReducer(state, { type: "TOOL_RESULT", toolCall, result: "file content" });
    expect(state.toolRows[0]!.status).toBe("done");
    expect(state.toolRows[0]!.output).toBe("file content");
  });

  it("inclui fileDiff no toolRow quando fornecido", () => {
    const toolCall = tc("c1", "writeFile");
    const fileDiff = { path: "/foo.ts", additions: 1, deletions: 0, hunks: [] };
    let state = chatReducer(initialState, { type: "TOOL_EXECUTING", toolCall });
    state = chatReducer(state, { type: "TOOL_RESULT", toolCall, result: "done", fileDiff });
    expect(state.toolRows[0]!.fileDiff).toBeDefined();
    expect(state.toolRows[0]!.fileDiff!.path).toBe("/foo.ts");
  });
});

describe("chatReducer — TOOL_REJECTED", () => {
  it("remove toolCall de pendingConfirms", () => {
    const toolCall = tc("c1", "bash");
    let state = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    state = chatReducer(state, { type: "TOOL_REJECTED", toolCall });
    expect(state.pendingConfirms).toHaveLength(0);
  });

  it("atualiza toolRow status para rejected", () => {
    const toolCall = tc("c1", "bash");
    let state = chatReducer(initialState, { type: "TOOL_CONFIRM", toolCall });
    state = chatReducer(state, { type: "TOOL_REJECTED", toolCall });
    expect(state.toolRows[0]!.status).toBe("rejected");
  });
});

describe("chatReducer — CONFIG_LOADED", () => {
  it("atualiza runtimeConfig", () => {
    const next = chatReducer(initialState, { type: "CONFIG_LOADED", config: baseConfig });
    expect(next.runtimeConfig).toBe(baseConfig);
  });
});

describe("chatReducer — CONTEXT_USAGE", () => {
  it("atualiza contextUsage", () => {
    const snapshot = { usedTokens: 100, limitTokens: 1000, effectiveInputBudgetTokens: 800, didTrimForApi: false, droppedMessageCount: 0 };
    const next = chatReducer(initialState, { type: "CONTEXT_USAGE", snapshot });
    expect(next.contextUsage).toBe(snapshot);
  });
});

describe("chatReducer — ERROR", () => {
  it("para streaming, salva erro e atualiza activityTone", () => {
    const state = { ...initialState, isStreaming: true };
    const next = chatReducer(state, { type: "ERROR", message: "algo falhou" });
    expect(next.isStreaming).toBe(false);
    expect(next.errorMessage).toBe("algo falhou");
    expect(next.activityTone).toBe("error");
    expect(next.activity?.secondary).toContain("algo falhou");
  });
});

describe("chatReducer — HITL_POLICY", () => {
  it("atualiza hitlPolicy", () => {
    const policy = { destructiveTools: "allow_all" as const, sessionAutoApproveDestructive: true };
    const next = chatReducer(initialState, { type: "HITL_POLICY", policy });
    expect(next.hitlPolicy).toBe(policy);
  });
});

describe("chatReducer — MODEL_CHANGE", () => {
  it("não altera estado quando runtimeConfig é null", () => {
    const next = chatReducer(initialState, { type: "MODEL_CHANGE", modelId: "new-model" });
    expect(next).toBe(initialState);
  });

  it("atualiza model quando runtimeConfig está presente", () => {
    const state = { ...initialState, runtimeConfig: baseConfig };
    const next = chatReducer(state, { type: "MODEL_CHANGE", modelId: "gpt-3.5-turbo" });
    expect(next.runtimeConfig!.openrouter.model).toBe("gpt-3.5-turbo");
  });
});

describe("chatReducer — ADD_CONTEXT_FILE / REMOVE_CONTEXT_FILE", () => {
  it("ADD_CONTEXT_FILE adiciona arquivo", () => {
    const file = { path: "/foo.ts", content: "code", name: "foo.ts" };
    const next = chatReducer(initialState, { type: "ADD_CONTEXT_FILE", file });
    expect(next.contextFiles).toHaveLength(1);
  });

  it("ADD_CONTEXT_FILE não duplica arquivo com mesmo path", () => {
    const file = { path: "/foo.ts", content: "code", name: "foo.ts" };
    let state = chatReducer(initialState, { type: "ADD_CONTEXT_FILE", file });
    state = chatReducer(state, { type: "ADD_CONTEXT_FILE", file });
    expect(state.contextFiles).toHaveLength(1);
  });

  it("REMOVE_CONTEXT_FILE remove arquivo pelo path", () => {
    const file = { path: "/foo.ts", content: "code", name: "foo.ts" };
    let state = chatReducer(initialState, { type: "ADD_CONTEXT_FILE", file });
    state = chatReducer(state, { type: "REMOVE_CONTEXT_FILE", path: "/foo.ts" });
    expect(state.contextFiles).toHaveLength(0);
  });
});

describe("chatReducer — ação desconhecida", () => {
  it("retorna estado inalterado para ação não tratada", () => {
    const next = chatReducer(initialState, { type: "UNKN0WN" } as unknown as ChatAction);
    expect(next).toBe(initialState);
  });
});
