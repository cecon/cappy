import { describe, it, expect, vi } from "vitest";
import { recoverToolArgumentsWithLlm } from "../agent/toolArgumentRecovery";
import type OpenAI from "openai";

function makeClient(responseContent: string | null): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: { content: responseContent },
            },
          ],
        }),
      },
    },
  } as unknown as OpenAI;
}

describe("recoverToolArgumentsWithLlm", () => {
  const schema = {
    type: "object" as const,
    properties: { path: { type: "string" } },
    required: ["path"],
  };

  it("retorna JSON válido quando o modelo devolve objeto correto", async () => {
    const client = makeClient('{"path": "/foo/bar.ts"}');
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      '{ path: "/foo/bar.ts" }',
      "Unexpected token ':'",
      schema,
    );
    expect(result).toBe('{"path": "/foo/bar.ts"}');
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it("extrai JSON de dentro de markdown fence", async () => {
    const client = makeClient('```json\n{"path": "/foo.ts"}\n```');
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      "broken",
      "parse error",
      schema,
    );
    expect(result).not.toBeNull();
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it("extrai JSON com texto antes do objeto", async () => {
    const client = makeClient('Here is the fixed JSON: {"path": "/x.ts"} done');
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      "broken",
      "parse error",
      schema,
    );
    expect(result).not.toBeNull();
  });

  it("retorna null quando resposta não contém objeto JSON válido", async () => {
    const client = makeClient("Não consigo corrigir isso");
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      "broken",
      "parse error",
      schema,
    );
    expect(result).toBeNull();
  });

  it("retorna null quando resposta é string vazia", async () => {
    const client = makeClient("");
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      "broken",
      "parse error",
      schema,
    );
    expect(result).toBeNull();
  });

  it("retorna null quando resposta é null", async () => {
    const client = makeClient(null);
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      "broken",
      "parse error",
      schema,
    );
    expect(result).toBeNull();
  });

  it("retorna null quando modelo devolve JSON inválido mesmo após extração", async () => {
    const client = makeClient("{invalid: true}");
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      "broken",
      "parse error",
      schema,
    );
    expect(result).toBeNull();
  });

  it("retorna null quando a API lança erro", async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("Network error")),
        },
      },
    } as unknown as OpenAI;
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      "broken",
      "parse error",
      schema,
    );
    expect(result).toBeNull();
  });

  it("trunca rawArgumentsText muito longo", async () => {
    const client = makeClient('{"path": "/x.ts"}');
    const hugeRaw = "x".repeat(10_000);
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "ReadFile",
      hugeRaw,
      "parse error",
      schema,
    );
    const callArgs = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const userMessage = callArgs.messages[1].content;
    expect(userMessage.length).toBeLessThan(hugeRaw.length + 500);
  });

  it("trata schema sem propriedades", async () => {
    const client = makeClient('{"x": 1}');
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "MyTool",
      "broken",
      "parse error",
      undefined,
    );
    expect(result).not.toBeNull();
  });

  it("trunca schema grande com hint", async () => {
    const bigSchema = {
      type: "object" as const,
      properties: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`field${String(i)}`, { type: "string" }])
      ),
    };
    const client = makeClient('{"field0": "val"}');
    const result = await recoverToolArgumentsWithLlm(
      client,
      "gpt-4o",
      "BigTool",
      "broken",
      "parse error",
      bigSchema,
    );
    expect(result).not.toBeNull();
  });
});
