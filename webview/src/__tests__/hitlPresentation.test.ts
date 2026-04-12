import { describe, it, expect } from "vitest";
import { isTerminalHitlPresentation } from "../lib/hitlPresentation";
import type { ToolCall } from "../lib/types";

function tc(name: string): ToolCall {
  return { id: "c1", name, arguments: {} };
}

describe("isTerminalHitlPresentation", () => {
  it("retorna true para 'bash'", () => {
    expect(isTerminalHitlPresentation(tc("bash"))).toBe(true);
  });

  it("retorna true para 'runTerminal'", () => {
    expect(isTerminalHitlPresentation(tc("runTerminal"))).toBe(true);
  });

  it("retorna true para 'run_terminal_cmd'", () => {
    expect(isTerminalHitlPresentation(tc("run_terminal_cmd"))).toBe(true);
  });

  it("é case-insensitive", () => {
    expect(isTerminalHitlPresentation(tc("BASH"))).toBe(true);
    expect(isTerminalHitlPresentation(tc("RunTerminal"))).toBe(true);
  });

  it("ignora espaços em torno do nome", () => {
    expect(isTerminalHitlPresentation({ id: "c1", name: "  bash  ", arguments: {} })).toBe(true);
  });

  it("retorna false para 'writeFile'", () => {
    expect(isTerminalHitlPresentation(tc("writeFile"))).toBe(false);
  });

  it("retorna false para 'readFile'", () => {
    expect(isTerminalHitlPresentation(tc("readFile"))).toBe(false);
  });

  it("retorna false para tool genérica", () => {
    expect(isTerminalHitlPresentation(tc("MyTool"))).toBe(false);
  });
});
