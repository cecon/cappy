import { describe, it, expect } from "vitest";
import {
  estimateTextTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  getEffectiveInputBudgetTokens,
  isValidOpenAiMessageSequence,
  trimMessagesForBudget,
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  DEFAULT_RESERVED_OUTPUT_TOKENS,
  AUTOCOMPACT_BUFFER_TOKENS,
  SYSTEM_PROMPT_OVERHEAD_TOKENS,
} from "../../agent/contextBudget";
import type { Message } from "../../agent/types";

describe("estimateTextTokens", () => {
  it("retorna 0 para string vazia", () => {
    expect(estimateTextTokens("")).toBe(0);
  });

  it("estima corretamente com CHARS_PER_TOKEN=4", () => {
    expect(estimateTextTokens("abcd")).toBe(1);
    expect(estimateTextTokens("abcde")).toBe(2);
    expect(estimateTextTokens("a".repeat(100))).toBe(25);
  });

  it("usa Math.ceil para arredondamento", () => {
    expect(estimateTextTokens("abc")).toBe(1);
    expect(estimateTextTokens("abcde")).toBe(2);
  });
});

describe("estimateMessageTokens", () => {
  it("conta tokens do role e content", () => {
    const msg: Message = { role: "user", content: "hello" };
    const tokens = estimateMessageTokens(msg);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(
      estimateTextTokens("user") + estimateTextTokens("hello")
    );
  });

  it("inclui tool_calls quando presentes", () => {
    const msg: Message = {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "id1", name: "ReadFile", arguments: { path: "/foo" } }],
    };
    const base = estimateMessageTokens({ role: "assistant", content: "" });
    const withCalls = estimateMessageTokens(msg);
    expect(withCalls).toBeGreaterThan(base);
  });

  it("inclui tool_call_id quando presente", () => {
    const withId: Message = { role: "tool", content: "result", tool_call_id: "call_abc" };
    const withoutId: Message = { role: "tool", content: "result" };
    expect(estimateMessageTokens(withId)).toBeGreaterThan(estimateMessageTokens(withoutId));
  });

  it("inclui imagens quando presentes", () => {
    const dataUrl = "data:image/png;base64," + "A".repeat(500);
    const msg: Message = {
      role: "user",
      content: "look at this",
      images: [{ dataUrl, mimeType: "image/png" }],
    };
    const base: Message = { role: "user", content: "look at this" };
    expect(estimateMessageTokens(msg)).toBeGreaterThan(estimateMessageTokens(base));
  });

  it("limita imagens grandes a 16000 tokens", () => {
    const hugeUrl = "A".repeat(120 * 20_000);
    const msg: Message = {
      role: "user",
      content: "",
      images: [{ dataUrl: hugeUrl, mimeType: "image/png" }],
    };
    const imgTokens = estimateMessageTokens(msg) - estimateTextTokens("user");
    expect(imgTokens).toBeLessThanOrEqual(16_000);
  });
});

describe("estimateMessagesTokens", () => {
  it("retorna 0 para lista vazia", () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it("soma tokens de todas as mensagens", () => {
    const msgs: Message[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ];
    const expected =
      estimateMessageTokens(msgs[0]!) + estimateMessageTokens(msgs[1]!);
    expect(estimateMessagesTokens(msgs)).toBe(expected);
  });
});

describe("getEffectiveInputBudgetTokens", () => {
  it("calcula orçamento corretamente", () => {
    const result = getEffectiveInputBudgetTokens(128_000, 8_192);
    expect(result).toBe(128_000 - 8_192 - AUTOCOMPACT_BUFFER_TOKENS);
  });

  it("retorna no mínimo 4096 para janelas pequenas", () => {
    expect(getEffectiveInputBudgetTokens(1_000, 900)).toBe(4096);
  });

  it("verifica constantes exportadas", () => {
    expect(DEFAULT_CONTEXT_WINDOW_TOKENS).toBe(128_000);
    expect(DEFAULT_RESERVED_OUTPUT_TOKENS).toBe(8_192);
    expect(AUTOCOMPACT_BUFFER_TOKENS).toBe(13_000);
    expect(SYSTEM_PROMPT_OVERHEAD_TOKENS).toBe(2_000);
  });
});

describe("isValidOpenAiMessageSequence", () => {
  it("retorna false para lista vazia", () => {
    expect(isValidOpenAiMessageSequence([])).toBe(false);
  });

  it("aceita mensagem user única", () => {
    expect(isValidOpenAiMessageSequence([{ role: "user", content: "hi" }])).toBe(true);
  });

  it("aceita sequência user → assistant", () => {
    const msgs: Message[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    expect(isValidOpenAiMessageSequence(msgs)).toBe(true);
  });

  it("aceita sequência user → assistant (com tool_calls) → tool", () => {
    const msgs: Message[] = [
      { role: "user", content: "run it" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "c1", name: "bash", arguments: { command: "ls" } }],
      },
      { role: "tool", content: "file1.txt", tool_call_id: "c1" },
    ];
    expect(isValidOpenAiMessageSequence(msgs)).toBe(true);
  });

  it("rejeita tool sem assistant anterior", () => {
    const msgs: Message[] = [
      { role: "user", content: "hi" },
      { role: "tool", content: "result", tool_call_id: "c1" },
    ];
    expect(isValidOpenAiMessageSequence(msgs)).toBe(false);
  });

  it("rejeita tool_call_id errado", () => {
    const msgs: Message[] = [
      { role: "user", content: "run it" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "c1", name: "bash", arguments: {} }],
      },
      { role: "tool", content: "result", tool_call_id: "WRONG" },
    ];
    expect(isValidOpenAiMessageSequence(msgs)).toBe(false);
  });

  it("rejeita tool_call sem tool response seguinte", () => {
    const msgs: Message[] = [
      { role: "user", content: "run it" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "c1", name: "bash", arguments: {} }],
      },
    ];
    expect(isValidOpenAiMessageSequence(msgs)).toBe(false);
  });

  it("rejeita role desconhecido", () => {
    const msgs = [{ role: "system" as "user", content: "hi" }];
    expect(isValidOpenAiMessageSequence(msgs)).toBe(false);
  });

  it("aceita múltiplos tool_calls respondidos em ordem", () => {
    const msgs: Message[] = [
      { role: "user", content: "run both" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "c1", name: "bash", arguments: {} },
          { id: "c2", name: "read", arguments: {} },
        ],
      },
      { role: "tool", content: "ok1", tool_call_id: "c1" },
      { role: "tool", content: "ok2", tool_call_id: "c2" },
    ];
    expect(isValidOpenAiMessageSequence(msgs)).toBe(true);
  });
});

describe("trimMessagesForBudget", () => {
  const makeUser = (content: string): Message => ({ role: "user", content });
  const makeAssistant = (content: string): Message => ({ role: "assistant", content });

  it("não corta se já está dentro do orçamento", () => {
    const msgs = [makeUser("hi"), makeAssistant("hello")];
    const result = trimMessagesForBudget(msgs, 999_999);
    expect(result.droppedCount).toBe(0);
    expect(result.messages).toHaveLength(2);
  });

  it("corta mensagens antigas para caber no orçamento", () => {
    const msgs: Message[] = [
      makeUser("mensagem antiga muito longa " + "x".repeat(200)),
      makeAssistant("resposta antiga " + "x".repeat(200)),
      makeUser("nova pergunta"),
    ];
    const result = trimMessagesForBudget(msgs, 10);
    expect(result.droppedCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(msgs.length);
  });

  it("preserva ao menos a última mensagem user quando tudo é muito grande", () => {
    const msgs = [
      makeUser("antiga"),
      makeAssistant("resposta"),
      makeUser("ultima pergunta"),
    ];
    const result = trimMessagesForBudget(msgs, 1);
    expect(result.messages.at(-1)?.content).toBe("ultima pergunta");
  });

  it("retorna droppedTokenEstimate > 0 quando corta", () => {
    const msgs: Message[] = [
      makeUser("conteudo antigo com bastante texto"),
      makeUser("mais texto antigo aqui"),
      makeUser("novo"),
    ];
    const result = trimMessagesForBudget(msgs, 2);
    if (result.droppedCount > 0) {
      expect(result.droppedTokenEstimate).toBeGreaterThan(0);
    }
  });
});
