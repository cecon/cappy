import { describe, it, expect } from "vitest";
import {
  createActivity,
  mergeActivity,
  buildToolActivity,
  extractPathArg,
  extractStringArg,
} from "../domain/services/ActivityService";
import type { ToolCall } from "../lib/types";

function tc(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id: "c1", name, arguments: args };
}

describe("createActivity", () => {
  it("cria ActivityState com primary e secondary", () => {
    const a = createActivity("Lendo", "arquivo.ts");
    expect(a.primary).toBe("Lendo");
    expect(a.secondary).toBe("arquivo.ts");
    expect(a.repeats).toBe(1);
    expect(a.startedAtMs).toBeGreaterThan(0);
  });

  it("cria signature correta", () => {
    const a = createActivity("A", "B");
    expect(a.signature).toBe("A::B");
  });

  it("aceita secondary null", () => {
    const a = createActivity("A", null);
    expect(a.secondary).toBeNull();
    expect(a.signature).toBe("A::");
  });
});

describe("mergeActivity", () => {
  it("retorna next quando previous é null", () => {
    const next = createActivity("A", null);
    expect(mergeActivity(null, next)).toBe(next);
  });

  it("retorna next quando signatures diferem", () => {
    const prev = createActivity("A", null);
    const next = createActivity("B", null);
    expect(mergeActivity(prev, next)).toBe(next);
  });

  it("incrementa repeats quando signatures iguais", () => {
    const prev = createActivity("A", "x");
    const next = createActivity("A", "x");
    const merged = mergeActivity(prev, next);
    expect(merged.repeats).toBe(2);
    expect(merged.startedAtMs).toBe(prev.startedAtMs);
  });

  it("preserva startedAtMs original após merge", () => {
    const prev = createActivity("A", null);
    const next = createActivity("A", null);
    const merged = mergeActivity(prev, next);
    expect(merged.startedAtMs).toBe(prev.startedAtMs);
  });
});

describe("buildToolActivity", () => {
  it("detecta tool de leitura por nome", () => {
    const a = buildToolActivity(tc("readFile", { path: "/foo.ts" }));
    expect(a.primary).toContain("Lendo");
  });

  it("detecta tool de busca", () => {
    const a = buildToolActivity(tc("searchCode", { query: "myFunc" }));
    expect(a.primary).toContain("Procurando");
  });

  it("detecta grep", () => {
    const a = buildToolActivity(tc("Grep", { query: "pattern" }));
    expect(a.primary).toContain("Procurando");
  });

  it("detecta listDir", () => {
    const a = buildToolActivity(tc("listDir", { path: "/src" }));
    expect(a.primary).toContain("Explorando");
  });

  it("detecta writeFile", () => {
    const a = buildToolActivity(tc("writeFile", { path: "/src/x.ts" }));
    expect(a.primary).toContain("Editando");
  });

  it("detecta runTerminal com command", () => {
    const a = buildToolActivity(tc("runTerminal", { command: "npm test" }));
    expect(a.primary).toContain("Executando");
    expect(a.secondary).toContain("npm test");
  });

  it("usa fallback para tool desconhecida", () => {
    const a = buildToolActivity(tc("MyTool", {}));
    expect(a.primary).toContain("MyTool");
  });

  it("leitura sem path usa texto genérico", () => {
    const a = buildToolActivity(tc("readFile"));
    expect(a.primary).toContain("Lendo");
    expect(a.secondary).not.toBeNull();
  });

  it("listDir sem path usa texto genérico", () => {
    const a = buildToolActivity(tc("listDir"));
    expect(a.primary).toContain("Explorando");
  });

  it("terminal sem command usa fallback", () => {
    const a = buildToolActivity(tc("runTerminal"));
    expect(a.primary).toContain("Executando");
  });
});

describe("extractPathArg", () => {
  it("extrai 'path'", () => {
    expect(extractPathArg({ path: "/foo.ts" })).toBe("/foo.ts");
  });

  it("extrai 'targetPath'", () => {
    expect(extractPathArg({ targetPath: "/bar.ts" })).toBe("/bar.ts");
  });

  it("extrai 'filePath'", () => {
    expect(extractPathArg({ filePath: "/baz.ts" })).toBe("/baz.ts");
  });

  it("extrai 'cwd'", () => {
    expect(extractPathArg({ cwd: "/workspace" })).toBe("/workspace");
  });

  it("retorna null quando nenhuma chave de path está presente", () => {
    expect(extractPathArg({ query: "foo" })).toBeNull();
  });

  it("retorna null quando valor é string vazia", () => {
    expect(extractPathArg({ path: "" })).toBeNull();
  });
});

describe("extractStringArg", () => {
  it("extrai primeira chave encontrada", () => {
    expect(extractStringArg({ query: "foo", pattern: "bar" }, ["query", "pattern"])).toBe("foo");
  });

  it("tenta próxima chave quando primeira está ausente", () => {
    expect(extractStringArg({ pattern: "*.ts" }, ["query", "pattern"])).toBe("*.ts");
  });

  it("retorna null quando nenhuma chave encontrada", () => {
    expect(extractStringArg({}, ["query", "pattern"])).toBeNull();
  });

  it("retorna null quando valor é string vazia", () => {
    expect(extractStringArg({ query: "" }, ["query"])).toBeNull();
  });
});
