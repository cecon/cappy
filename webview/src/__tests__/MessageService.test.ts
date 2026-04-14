import { describe, it, expect } from "vitest";
import {
  appendAssistantToken,
  appendToolLogMessage,
  appendToolSlotMessage,
  getToolLogDetail,
  summarizeToolResult,
} from "../domain/services/MessageService";
import type { Message, ToolCall } from "../lib/types";

describe("appendAssistantToken", () => {
  it("cria nova mensagem assistant quando lista vazia", () => {
    const result = appendAssistantToken([], "hello");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "assistant", content: "hello" });
  });

  it("cria nova mensagem assistant quando última não é assistant", () => {
    const msgs: Message[] = [{ role: "user", content: "hi" }];
    const result = appendAssistantToken(msgs, " world");
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ role: "assistant", content: " world" });
  });

  it("acrescenta ao último assistant", () => {
    const msgs: Message[] = [{ role: "assistant", content: "hel" }];
    const result = appendAssistantToken(msgs, "lo");
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("hello");
  });

  it("preserva outras propriedades da mensagem assistant", () => {
    const msgs: Message[] = [{ role: "assistant", content: "x", tool_calls: [{ id: "c1", name: "T", arguments: {} }] }];
    const result = appendAssistantToken(msgs, "y");
    expect(result[0]!.tool_calls).toHaveLength(1);
  });

  it("retorna mesma lista quando token é string vazia", () => {
    const msgs: Message[] = [{ role: "user", content: "hi" }];
    expect(appendAssistantToken(msgs, "")).toBe(msgs);
  });

  it("retorna nova referência quando adiciona token", () => {
    const msgs: Message[] = [{ role: "assistant", content: "x" }];
    const result = appendAssistantToken(msgs, "y");
    expect(result).not.toBe(msgs);
  });
});

describe("appendToolLogMessage", () => {
  it("adiciona mensagem tool com title e detail", () => {
    const result = appendToolLogMessage([], "Executando", "detalhe");
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("tool");
    expect(result[0]!.content).toBe("Executando\ndetalhe");
  });

  it("adiciona mensagem tool sem detail", () => {
    const result = appendToolLogMessage([], "Título", null);
    expect(result[0]!.content).toBe("Título");
  });

  it("não duplica mensagem idêntica consecutiva sem fileDiff", () => {
    const msgs = appendToolLogMessage([], "Título", "detalhe");
    const result = appendToolLogMessage(msgs, "Título", "detalhe");
    expect(result).toHaveLength(1);
  });

  it("adiciona mensagem diferente mesmo depois de idêntica", () => {
    const msgs = appendToolLogMessage([], "Título", "a");
    const result = appendToolLogMessage(msgs, "Outro", "b");
    expect(result).toHaveLength(2);
  });

  it("inclui fileDiff quando fornecido", () => {
    const fileDiff = { path: "/foo.ts", additions: 1, deletions: 0, hunks: [] };
    const result = appendToolLogMessage([], "Editado", "detail", fileDiff);
    expect(result[0]!.fileDiff).toBeDefined();
  });

  it("não deduplica quando fileDiff está presente", () => {
    const fileDiff = { path: "/foo.ts", additions: 1, deletions: 0, hunks: [] };
    const msgs = appendToolLogMessage([], "Título", "detail", fileDiff);
    const result = appendToolLogMessage(msgs, "Título", "detail", fileDiff);
    expect(result).toHaveLength(2);
  });
});

describe("getToolLogDetail", () => {
  it("retorna detalhe de query quando presente", () => {
    const call: ToolCall = { id: "c1", name: "Grep", arguments: { query: "myFunction" } };
    expect(getToolLogDetail(call)).toContain("myFunction");
  });

  it("retorna detalhe de pattern quando presente", () => {
    const call: ToolCall = { id: "c1", name: "Grep", arguments: { pattern: "*.ts" } };
    expect(getToolLogDetail(call)).toContain("*.ts");
  });

  it("retorna detalhe de command quando presente", () => {
    const call: ToolCall = { id: "c1", name: "Bash", arguments: { command: "ls -la" } };
    expect(getToolLogDetail(call)).toContain("ls -la");
  });

  it("retorna detalhe de path quando presente", () => {
    const call: ToolCall = { id: "c1", name: "ReadFile", arguments: { path: "/foo.ts" } };
    expect(getToolLogDetail(call)).toContain("/foo.ts");
  });

  it("retorna null quando nenhum argumento conhecido", () => {
    const call: ToolCall = { id: "c1", name: "Tool", arguments: {} };
    expect(getToolLogDetail(call)).toBeNull();
  });

  it("prefere query sobre path", () => {
    const call: ToolCall = { id: "c1", name: "Tool", arguments: { query: "foo", path: "/bar" } };
    const detail = getToolLogDetail(call);
    expect(detail).toContain("foo");
    expect(detail).not.toContain("/bar");
  });

  it("clipa valores longos", () => {
    const longQuery = "x".repeat(200);
    const call: ToolCall = { id: "c1", name: "Grep", arguments: { query: longQuery } };
    const detail = getToolLogDetail(call)!;
    expect(detail.length).toBeLessThanOrEqual(130);
  });
});

describe("appendToolSlotMessage", () => {
  const toolCall: ToolCall = { id: "tc1", name: "bash", arguments: { command: "ls" } };

  it("adiciona mensagem tool com tool_call_id e role tool", () => {
    const result = appendToolSlotMessage([], toolCall);
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("tool");
    expect(result[0]!.tool_call_id).toBe("tc1");
    expect(result[0]!.content).toBe("bash");
  });

  it("é idempotente: não duplica slot com mesmo tool_call_id", () => {
    const first = appendToolSlotMessage([], toolCall);
    const second = appendToolSlotMessage(first, toolCall);
    expect(second).toHaveLength(1);
    expect(second).toBe(first);
  });

  it("adiciona slot diferente mesmo que outro slot já exista", () => {
    const tc2: ToolCall = { id: "tc2", name: "read_file", arguments: { path: "/foo.ts" } };
    const first = appendToolSlotMessage([], toolCall);
    const result = appendToolSlotMessage(first, tc2);
    expect(result).toHaveLength(2);
    expect(result[1]!.tool_call_id).toBe("tc2");
  });

  it("preserva mensagens existentes antes do slot", () => {
    const msgs: Message[] = [{ role: "user", content: "hi" }, { role: "assistant", content: "ok" }];
    const result = appendToolSlotMessage(msgs, toolCall);
    expect(result).toHaveLength(3);
    expect(result[0]!.role).toBe("user");
    expect(result[1]!.role).toBe("assistant");
  });
});

describe("summarizeToolResult", () => {
  it("retorna mensagem para resultado vazio", () => {
    expect(summarizeToolResult("")).toBe("Tool sem retorno textual");
    expect(summarizeToolResult("   ")).toBe("Tool sem retorno textual");
  });

  it("inclui retorno truncado para resultado longo", () => {
    const long = "x".repeat(200);
    const summary = summarizeToolResult(long);
    expect(summary.startsWith("Retorno:")).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(160);
  });

  it("colapsa espaços em branco no resultado", () => {
    const result = summarizeToolResult("linha 1\nlinha 2\t linha 3");
    expect(result).not.toContain("\n");
  });

  it("retorna resultado curto completo", () => {
    const summary = summarizeToolResult("ok");
    expect(summary).toBe("Retorno: ok");
  });
});
