import { describe, it, expect } from "vitest";
import {
  estimateTextTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  getEffectiveInputBudgetTokens,
  isValidOpenAiMessageSequence,
  trimMessagesForBudget,
  pruneOldToolOutputs,
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  DEFAULT_RESERVED_OUTPUT_TOKENS,
  AUTOCOMPACT_BUFFER_TOKENS,
  PRUNE_PROTECT_TOKENS,
  PRUNE_MINIMUM_TOKENS,
  SYSTEM_PROMPT_OVERHEAD_TOKENS,
} from "../agent/contextBudget";
import type { Message } from "../agent/types";

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

  it("usa buffer customizado quando fornecido", () => {
    const customBuffer = 5_000;
    const result = getEffectiveInputBudgetTokens(128_000, 8_192, customBuffer);
    expect(result).toBe(128_000 - 8_192 - customBuffer);
  });

  it("buffer customizado de 0 remove toda a margem de segurança", () => {
    const result = getEffectiveInputBudgetTokens(128_000, 8_192, 0);
    expect(result).toBe(128_000 - 8_192);
  });

  it("verifica constantes exportadas", () => {
    expect(DEFAULT_CONTEXT_WINDOW_TOKENS).toBe(128_000);
    expect(DEFAULT_RESERVED_OUTPUT_TOKENS).toBe(8_192);
    expect(AUTOCOMPACT_BUFFER_TOKENS).toBe(13_000);
    expect(PRUNE_PROTECT_TOKENS).toBe(40_000);
    expect(PRUNE_MINIMUM_TOKENS).toBe(20_000);
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

  it("cobre o segundo loop (início não-user) quando primeiro loop falha", () => {
    // assistant com conteúdo pequeno — sequência válida que não começa em user
    const msgs: Message[] = [
      makeUser("mensagem user enorme " + "x".repeat(500)),
      makeAssistant("ok"),
    ];
    // budget suficiente para só o assistant
    const assistantTokens = estimateMessageTokens(msgs[1]!);
    const result = trimMessagesForBudget(msgs, assistantTokens);
    // Se encontrou uma fatia que cabe, droppedCount >= 0
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("aciona fallback final quando última mensagem não é user", () => {
    const msgs: Message[] = [
      makeUser("x"),
      makeAssistant("y"),
    ];
    // budget 0 — nada cabe, última mensagem é assistant
    const result = trimMessagesForBudget(msgs, 0);
    expect(result.messages.length).toBeGreaterThan(0);
  });
});

describe("pruneOldToolOutputs", () => {
  const makeTool = (content: string, id: string): Message => ({
    role: "tool",
    content,
    tool_call_id: id,
  });
  const makeAssistantWithCall = (id: string): Message => ({
    role: "assistant",
    content: "",
    tool_calls: [{ id, name: "readFile", arguments: { path: "/foo" } }],
  });
  const makeUser = (content: string): Message => ({ role: "user", content });

  it("devolve o array original quando não há tool messages suficientes", () => {
    const msgs: Message[] = [
      makeUser("oi"),
      makeAssistantWithCall("c1"),
      makeTool("resultado pequeno", "c1"),
    ];
    const result = pruneOldToolOutputs(msgs);
    expect(result).toBe(msgs);
  });

  it("não poda quando a economia está abaixo de PRUNE_MINIMUM_TOKENS", () => {
    // Cada tool tem ~10 tokens — muito abaixo de 20 000
    const msgs: Message[] = [
      makeUser("hi"),
      makeAssistantWithCall("c1"),
      makeTool("x".repeat(40), "c1"),
      makeUser("segunda"),
      makeAssistantWithCall("c2"),
      makeTool("y".repeat(40), "c2"),
    ];
    const result = pruneOldToolOutputs(msgs);
    expect(result).toBe(msgs);
  });

  it("poda tool outputs antigos quando total supera PRUNE_PROTECT + PRUNE_MINIMUM", () => {
    // PRUNE_PROTECT = 40 000 tokens; PRUNE_MINIMUM = 20 000 tokens
    // Precisamos que o "protegido" seja ~40k e o "antigo" seja >= 20k
    // Cada char ≈ 0.25 tokens → 40k tokens ≈ 160 000 chars
    const protectedContent = "p".repeat(160_000); // ~40k tokens — preenche a zona protegida
    const oldContent       = "o".repeat(80_000);  // ~20k tokens — deve ser podado

    const msgs: Message[] = [
      makeUser("inicio"),
      makeAssistantWithCall("old"),
      makeTool(oldContent, "old"),         // antigo — será podado
      makeUser("recente"),
      makeAssistantWithCall("new"),
      makeTool(protectedContent, "new"),   // recente — protegido
    ];

    const result = pruneOldToolOutputs(msgs);

    // Deve devolver novo array (não o original)
    expect(result).not.toBe(msgs);

    // Mensagem antiga deve ter o placeholder
    const oldTool = result.find((m) => m.role === "tool" && m.tool_call_id === "old");
    expect(oldTool?.content).toBe("[output de tool omitido por poda de contexto]");

    // Mensagem recente deve estar intacta
    const newTool = result.find((m) => m.role === "tool" && m.tool_call_id === "new");
    expect(newTool?.content).toBe(protectedContent);
  });

  it("preserva tool_call_id e demais campos das mensagens podadas", () => {
    const protectedContent = "p".repeat(160_000);
    const oldContent       = "o".repeat(80_000);

    const msgs: Message[] = [
      makeUser("a"),
      makeAssistantWithCall("old"),
      makeTool(oldContent, "old"),
      makeUser("b"),
      makeAssistantWithCall("new"),
      makeTool(protectedContent, "new"),
    ];

    const result = pruneOldToolOutputs(msgs);
    const podada = result.find((m) => m.role === "tool" && m.tool_call_id === "old");

    expect(podada?.role).toBe("tool");
    expect(podada?.tool_call_id).toBe("old");
  });

  it("não altera mensagens user e assistant durante a poda", () => {
    const protectedContent = "p".repeat(160_000);
    const oldContent       = "o".repeat(80_000);

    const msgs: Message[] = [
      makeUser("pergunta original"),
      makeAssistantWithCall("old"),
      makeTool(oldContent, "old"),
      makeUser("segunda pergunta"),
      makeAssistantWithCall("new"),
      makeTool(protectedContent, "new"),
    ];

    const result = pruneOldToolOutputs(msgs);

    const users = result.filter((m) => m.role === "user");
    expect(users[0]?.content).toBe("pergunta original");
    expect(users[1]?.content).toBe("segunda pergunta");

    const assistants = result.filter((m) => m.role === "assistant");
    expect(assistants).toHaveLength(2);
  });
});
