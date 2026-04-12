import { describe, it, expect } from "vitest";
import { mergeFileDiffsForDisplay } from "../lib/mergeFileDiffs";
import type { FileDiffPayload } from "../lib/types";

function makeDiff(path: string, adds: number, dels: number, lineCount = 2): FileDiffPayload {
  return {
    path,
    additions: adds,
    deletions: dels,
    hunks: [
      {
        lines: Array.from({ length: lineCount }, (_, i) => ({
          type: i % 2 === 0 ? ("add" as const) : ("del" as const),
          text: `line ${String(i)}`,
        })),
      },
    ],
  };
}

describe("mergeFileDiffsForDisplay", () => {
  it("retorna lista vazia para entrada vazia", () => {
    expect(mergeFileDiffsForDisplay([])).toEqual([]);
  });

  it("retorna diff único sem modificação", () => {
    const diff = makeDiff("/foo.ts", 3, 1);
    const result = mergeFileDiffsForDisplay([diff]);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe("/foo.ts");
    expect(result[0]!.additions).toBe(3);
    expect(result[0]!.deletions).toBe(1);
  });

  it("agrupa múltiplos diffs do mesmo arquivo", () => {
    const d1 = makeDiff("/foo.ts", 2, 0);
    const d2 = makeDiff("/foo.ts", 3, 1);
    const result = mergeFileDiffsForDisplay([d1, d2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.additions).toBe(5);
    expect(result[0]!.deletions).toBe(1);
  });

  it("mantém arquivos diferentes separados", () => {
    const d1 = makeDiff("/foo.ts", 1, 0);
    const d2 = makeDiff("/bar.ts", 2, 1);
    const result = mergeFileDiffsForDisplay([d1, d2]);
    expect(result).toHaveLength(2);
    const paths = result.map((d) => d.path).sort();
    expect(paths).toEqual(["/bar.ts", "/foo.ts"]);
  });

  it("limita hunks ao máximo de 96 linhas por arquivo", () => {
    const d1 = makeDiff("/big.ts", 50, 0, 60);
    const d2 = makeDiff("/big.ts", 50, 0, 60);
    const result = mergeFileDiffsForDisplay([d1, d2]);
    const totalLines = result[0]!.hunks.reduce((acc, h) => acc + h.lines.length, 0);
    expect(totalLines).toBeLessThanOrEqual(96);
  });

  it("inclui todas as linhas quando abaixo do limite", () => {
    const d1 = makeDiff("/small.ts", 2, 1, 4);
    const d2 = makeDiff("/small.ts", 1, 0, 3);
    const result = mergeFileDiffsForDisplay([d1, d2]);
    const totalLines = result[0]!.hunks.reduce((acc, h) => acc + h.lines.length, 0);
    expect(totalLines).toBe(7);
  });

  it("soma additions e deletions corretamente em múltiplos arquivos", () => {
    const diffs = [
      makeDiff("/a.ts", 1, 2),
      makeDiff("/b.ts", 3, 4),
      makeDiff("/a.ts", 5, 6),
    ];
    const result = mergeFileDiffsForDisplay(diffs);
    const a = result.find((d) => d.path === "/a.ts")!;
    const b = result.find((d) => d.path === "/b.ts")!;
    expect(a.additions).toBe(6);
    expect(a.deletions).toBe(8);
    expect(b.additions).toBe(3);
    expect(b.deletions).toBe(4);
  });

  it("preserva linhas de contexto (type=context)", () => {
    const diff: FileDiffPayload = {
      path: "/ctx.ts",
      additions: 1,
      deletions: 0,
      hunks: [{ lines: [{ type: "context", text: "ctx line" }, { type: "add", text: "+new" }] }],
    };
    const result = mergeFileDiffsForDisplay([diff]);
    expect(result[0]!.hunks[0]!.lines[0]!.type).toBe("context");
  });
});
