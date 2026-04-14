import { describe, it, expect, vi } from "vitest";
import {
  serializeMessagesForSummary,
  summarizeDroppedMessagesForMainAgent,
  MIN_DROPPED_TOKENS_TO_SUMMARIZE,
  MAX_CONTEXT_SANITIZE_ITERATIONS,
} from "../agent/contextSanitize";
import type { Message } from "../agent/types";
import type OpenAI from "openai";

describe("serializeMessagesForSummary", () => {
  it("serializa mensagem user", () => {
    const msgs: Message[] = [{ role: "user", content: "ola mundo" }];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("### user");
    expect(result).toContain("ola mundo");
  });

  it("serializa mensagem assistant sem tool_calls", () => {
    const msgs: Message[] = [{ role: "assistant", content: "resposta do modelo" }];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("### assistant");
    expect(result).toContain("resposta do modelo");
  });

  it("serializa assistant com tool_calls", () => {
    const msgs: Message[] = [
      {
        role: "assistant",
        content: "vou ler",
        tool_calls: [{ id: "c1", name: "readFile", arguments: { path: "/foo.ts" } }],
      },
    ];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("### tool_calls");
    expect(result).toContain("readFile");
  });

  it("serializa mensagem tool", () => {
    const msgs: Message[] = [
      { role: "tool", content: "conteúdo do arquivo", tool_call_id: "c1" },
    ];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("### tool (c1)");
    expect(result).toContain("conteúdo do arquivo");
  });

  it("usa '?' quando tool_call_id está ausente", () => {
    const msgs: Message[] = [{ role: "tool", content: "resultado" }];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("### tool (?)");
  });

  it("trunca conteúdo muito longo", () => {
    const longContent = "x".repeat(20_000);
    const msgs: Message[] = [{ role: "user", content: longContent }];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("truncado");
  });

  it("inclui nota de imagens na mensagem user", () => {
    const msgs: Message[] = [
      {
        role: "user",
        content: "veja a imagem",
        images: [
          { dataUrl: "data:image/png;base64,abc", mimeType: "image/png" },
          { dataUrl: "data:image/png;base64,def", mimeType: "image/png" },
        ],
      },
    ];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("2 anexo(s) de imagem omitidos");
  });

  it("separa múltiplas mensagens com ---", () => {
    const msgs: Message[] = [
      { role: "user", content: "pergunta" },
      { role: "assistant", content: "resposta" },
    ];
    const result = serializeMessagesForSummary(msgs);
    expect(result).toContain("---");
  });

  it("retorna string vazia para lista vazia", () => {
    expect(serializeMessagesForSummary([])).toBe("");
  });
});

describe("constantes exportadas", () => {
  it("MIN_DROPPED_TOKENS_TO_SUMMARIZE é > 0", () => {
    expect(MIN_DROPPED_TOKENS_TO_SUMMARIZE).toBeGreaterThan(0);
  });

  it("MAX_CONTEXT_SANITIZE_ITERATIONS é > 0", () => {
    expect(MAX_CONTEXT_SANITIZE_ITERATIONS).toBeGreaterThan(0);
  });
});

describe("template estruturado de compactação", () => {
  const longContent = "conteúdo relevante de código e comentários explicativos ".repeat(35);

  it("o prompt de sistema pede as 5 secções do template Kilo", async () => {
    // Capturamos o argumento passado ao modelo via mock do cliente
    let capturedMessages: Array<{ role: string; content: string }> = [];
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation((params: { messages: Array<{ role: string; content: string }> }) => {
            capturedMessages = params.messages;
            return Promise.resolve({ choices: [{ message: { content: "resumo" } }] });
          }),
        },
      },
    } as unknown as OpenAI;

    const msgs: Message[] = [{ role: "user", content: longContent }];
    await summarizeDroppedMessagesForMainAgent(client, "gpt-4o", msgs);

    const systemMsg = capturedMessages.find((m) => m.role === "system");
    expect(systemMsg).toBeDefined();
    expect(systemMsg!.content).toContain("Objectivo");
    expect(systemMsg!.content).toContain("Instruções Importantes");
    expect(systemMsg!.content).toContain("Descobertas");
    expect(systemMsg!.content).toContain("Trabalho Realizado");
    expect(systemMsg!.content).toContain("Ficheiros");
  });
});

function makeClient(content: string): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  } as unknown as OpenAI;
}

describe("summarizeDroppedMessagesForMainAgent", () => {
  const longContent = "conteúdo relevante de código e comentários explicativos ".repeat(35);

  it("retorna string vazia para lista vazia", async () => {
    const client = makeClient("resumo");
    const result = await summarizeDroppedMessagesForMainAgent(client, "gpt-4o", []);
    expect(result).toBe("");
  });

  it("retorna string vazia quando serialização é muito curta", async () => {
    const client = makeClient("resumo");
    const msgs: Message[] = [{ role: "user", content: "oi" }];
    const result = await summarizeDroppedMessagesForMainAgent(client, "gpt-4o", msgs);
    expect(result).toBe("");
  });

  it("retorna string vazia quando tokens estimados abaixo do mínimo", async () => {
    const client = makeClient("resumo");
    const msgs: Message[] = [{ role: "user", content: "x".repeat(100) }];
    // 100 chars = 25 tokens < MIN_DROPPED_TOKENS_TO_SUMMARIZE (400)
    const result = await summarizeDroppedMessagesForMainAgent(client, "gpt-4o", msgs);
    expect(result).toBe("");
  });

  it("chama o modelo e retorna resumo quando há conteúdo suficiente", async () => {
    const expected = "# Resumo\n\nObjectivos: refatorar o módulo X.";
    const client = makeClient(expected);
    const msgs: Message[] = [{ role: "user", content: longContent }];
    const result = await summarizeDroppedMessagesForMainAgent(client, "gpt-4o", msgs);
    expect(result).toBe(expected);
  });

  it("trunca resumo muito longo retornado pelo modelo", async () => {
    const hugeContent = "x".repeat(30_000);
    const client = makeClient(hugeContent);
    const msgs: Message[] = [{ role: "user", content: longContent }];
    const result = await summarizeDroppedMessagesForMainAgent(client, "gpt-4o", msgs);
    expect(result.length).toBeLessThanOrEqual(28_020);
    expect(result).toContain("truncado");
  });

  it("retorna string vazia quando modelo retorna conteúdo vazio", async () => {
    const client = makeClient("   ");
    const msgs: Message[] = [{ role: "user", content: longContent }];
    const result = await summarizeDroppedMessagesForMainAgent(client, "gpt-4o", msgs);
    expect(result).toBe("");
  });
});
