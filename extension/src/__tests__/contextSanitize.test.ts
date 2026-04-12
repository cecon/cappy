import { describe, it, expect } from "vitest";
import {
  serializeMessagesForSummary,
  MIN_DROPPED_TOKENS_TO_SUMMARIZE,
  MAX_CONTEXT_SANITIZE_ITERATIONS,
} from "../../agent/contextSanitize";
import type { Message } from "../../agent/types";

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
