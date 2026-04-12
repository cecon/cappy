import { describe, it, expect } from "vitest";
import {
  mergeNestedPatternArgs,
  coerceSearchPattern,
} from "../../tools/coercePattern";

describe("mergeNestedPatternArgs", () => {
  it("retorna cópia do objeto quando não há chaves aninhadas", () => {
    const input = { pattern: "foo", path: "/bar" };
    const result = mergeNestedPatternArgs(input);
    expect(result).toEqual(input);
  });

  it("promove campos de 'arguments' para o nível superior", () => {
    const input = { arguments: { pattern: "foo", path: "/bar" } };
    const result = mergeNestedPatternArgs(input);
    expect(result.pattern).toBe("foo");
    expect(result.path).toBe("/bar");
  });

  it("promove campos de 'params' para o nível superior", () => {
    const input = { params: { pattern: "test" } };
    const result = mergeNestedPatternArgs(input);
    expect(result.pattern).toBe("test");
  });

  it("não sobrescreve chaves já definidas no nível superior", () => {
    const input = { pattern: "original", arguments: { pattern: "nested" } };
    const result = mergeNestedPatternArgs(input);
    expect(result.pattern).toBe("original");
  });

  it("substitui pattern vazio pela chave do nível aninhado", () => {
    const input = { pattern: "   ", arguments: { pattern: "from-nested" } };
    const result = mergeNestedPatternArgs(input);
    expect(result.pattern).toBe("from-nested");
  });

  it("ignora chaves aninhadas que não são objetos planos", () => {
    const input = { arguments: "string-nao-objeto" as unknown as Record<string, unknown> };
    const result = mergeNestedPatternArgs(input);
    expect(result.arguments).toBe("string-nao-objeto");
  });

  it("ignora chaves aninhadas null", () => {
    const input = { input: null as unknown as Record<string, unknown> };
    expect(() => mergeNestedPatternArgs(input)).not.toThrow();
  });

  it("ignora chaves aninhadas array", () => {
    const input = { data: [1, 2, 3] as unknown as Record<string, unknown> };
    expect(() => mergeNestedPatternArgs(input)).not.toThrow();
  });

  it("promove de 'tool_input' se definido", () => {
    const input = { tool_input: { query: "busca" } };
    const result = mergeNestedPatternArgs(input);
    expect(result.query).toBe("busca");
  });
});

describe("coerceSearchPattern — grep", () => {
  it("extrai 'pattern' string", () => {
    expect(coerceSearchPattern({ pattern: "foo" }, "grep")).toBe("foo");
  });

  it("extrai 'Pattern' (uppercase inicial)", () => {
    expect(coerceSearchPattern({ Pattern: "bar" }, "grep")).toBe("bar");
  });

  it("extrai 'regex'", () => {
    expect(coerceSearchPattern({ regex: "\\d+" }, "grep")).toBe("\\d+");
  });

  it("extrai 'query'", () => {
    expect(coerceSearchPattern({ query: "myFunc" }, "grep")).toBe("myFunc");
  });

  it("extrai 'search'", () => {
    expect(coerceSearchPattern({ search: "look for this" }, "grep")).toBe("look for this");
  });

  it("extrai 'q'", () => {
    expect(coerceSearchPattern({ q: "shorthand" }, "grep")).toBe("shorthand");
  });

  it("junta array de padrões com |", () => {
    expect(coerceSearchPattern({ pattern: ["foo", "bar"] }, "grep")).toBe("foo|bar");
  });

  it("filtra entradas vazias em arrays", () => {
    expect(coerceSearchPattern({ pattern: ["foo", "", "  ", "bar"] }, "grep")).toBe("foo|bar");
  });

  it("converte número para string", () => {
    expect(coerceSearchPattern({ pattern: 42 }, "grep")).toBe("42");
  });

  it("retorna string vazia quando não há padrão", () => {
    expect(coerceSearchPattern({}, "grep")).toBe("");
  });

  it("ignora padrão apenas com espaços", () => {
    expect(coerceSearchPattern({ pattern: "   " }, "grep")).toBe("");
  });

  it("extrai pattern de objeto aninhado em arguments", () => {
    const input = { arguments: { pattern: "nested-pattern" } };
    expect(coerceSearchPattern(input, "grep")).toBe("nested-pattern");
  });
});

describe("coerceSearchPattern — glob", () => {
  it("extrai 'pattern' para glob", () => {
    expect(coerceSearchPattern({ pattern: "*.ts" }, "glob")).toBe("*.ts");
  });

  it("extrai 'glob' para glob", () => {
    expect(coerceSearchPattern({ glob: "**/*.test.ts" }, "glob")).toBe("**/*.test.ts");
  });

  it("extrai 'query' para glob", () => {
    expect(coerceSearchPattern({ query: "src/**" }, "glob")).toBe("src/**");
  });

  it("não usa 'regex' para glob (não é chave glob)", () => {
    expect(coerceSearchPattern({ regex: ".*\\.ts" }, "glob")).toBe("");
  });

  it("retorna string vazia quando sem padrão", () => {
    expect(coerceSearchPattern({}, "glob")).toBe("");
  });
});
