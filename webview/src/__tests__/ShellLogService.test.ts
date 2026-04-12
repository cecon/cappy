import { describe, it, expect } from "vitest";
import { formatShellStart, formatShellComplete } from "../domain/services/ShellLogService";

describe("formatShellStart", () => {
  it("formata comando sem cwd", () => {
    expect(formatShellStart("ls -la")).toBe("$ ls -la\n");
  });

  it("formata comando com cwd", () => {
    expect(formatShellStart("npm test", "/workspace")).toBe("# cwd: /workspace\n$ npm test\n");
  });

  it("cwd undefined não adiciona linha de cwd", () => {
    const result = formatShellStart("pwd", undefined);
    expect(result).not.toContain("cwd:");
    expect(result).toBe("$ pwd\n");
  });
});

describe("formatShellComplete", () => {
  it("retorna errorText quando definido e não vazio", () => {
    const result = formatShellComplete({ stdout: "out", stderr: "err", errorText: "FALHOU" });
    expect(result).toBe("FALHOU\n");
    expect(result).not.toContain("out");
    expect(result).not.toContain("err");
  });

  it("ignora errorText quando é string vazia", () => {
    const result = formatShellComplete({ stdout: "output", stderr: "", errorText: "" });
    expect(result).toContain("output");
  });

  it("formata apenas stdout quando stderr é vazio", () => {
    const result = formatShellComplete({ stdout: "output\n", stderr: "" });
    expect(result).toBe("output\n");
  });

  it("adiciona newline ao stdout que não termina com \\n", () => {
    const result = formatShellComplete({ stdout: "output", stderr: "" });
    expect(result).toBe("output\n");
  });

  it("formata stdout e stderr", () => {
    const result = formatShellComplete({ stdout: "out", stderr: "err" });
    expect(result).toContain("out");
    expect(result).toContain("# stderr");
    expect(result).toContain("err");
  });

  it("adiciona newline ao stderr que não termina com \\n", () => {
    const result = formatShellComplete({ stdout: "", stderr: "error msg" });
    expect(result).toContain("error msg\n");
  });

  it("retorna string vazia quando stdout e stderr são vazios", () => {
    const result = formatShellComplete({ stdout: "", stderr: "" });
    expect(result).toBe("");
  });

  it("mantém newline do stdout quando já existe", () => {
    const result = formatShellComplete({ stdout: "line1\nline2\n", stderr: "" });
    expect(result).toBe("line1\nline2\n");
  });
});
