import { describe, it, expect } from "vitest";
import { classifyHitl, RISK_COLOR } from "../lib/hitlClassify";
import type { ToolCall } from "../lib/types";

function tc(name: string): ToolCall {
  return { id: "c1", name, arguments: {} };
}

describe("classifyHitl — terminal tools", () => {
  it("classifica 'bash' como shell/high", () => {
    const r = classifyHitl(tc("bash"));
    expect(r.category).toBe("shell");
    expect(r.risk).toBe("high");
    expect(r.label).toBe("Terminal");
  });

  it("classifica 'runTerminal' (case insensitive) como shell", () => {
    const r = classifyHitl(tc("RunTerminal"));
    expect(r.category).toBe("shell");
  });

  it("classifica 'run_terminal_cmd' como shell", () => {
    const r = classifyHitl(tc("run_terminal_cmd"));
    expect(r.category).toBe("shell");
  });
});

describe("classifyHitl — file write/edit tools", () => {
  it("classifica 'write' como file-write/medium", () => {
    const r = classifyHitl(tc("write"));
    expect(r.category).toBe("file-write");
    expect(r.risk).toBe("medium");
  });

  it("classifica 'writeFile' como file-write", () => {
    expect(classifyHitl(tc("writeFile")).category).toBe("file-write");
  });

  it("classifica 'edit' como file-edit", () => {
    const r = classifyHitl(tc("edit"));
    expect(r.category).toBe("file-edit");
    expect(r.risk).toBe("medium");
  });

  it("classifica 'createSkill' como file-write", () => {
    expect(classifyHitl(tc("createSkill")).category).toBe("file-write");
  });
});

describe("classifyHitl — special categories", () => {
  it("classifica 'deploy' como deploy/critical", () => {
    const r = classifyHitl(tc("deploy"));
    expect(r.category).toBe("deploy");
    expect(r.risk).toBe("critical");
  });

  it("classifica 'dbMutate' como database", () => {
    expect(classifyHitl(tc("dbMutate")).category).toBe("database");
  });

  it("classifica 'secretAccess' como secret", () => {
    expect(classifyHitl(tc("secretAccess")).category).toBe("secret");
  });

  it("classifica 'webFetch' como external/low", () => {
    const r = classifyHitl(tc("webFetch"));
    expect(r.category).toBe("external");
    expect(r.risk).toBe("low");
  });

  it("classifica 'webSearch' como external/low", () => {
    const r = classifyHitl(tc("webSearch"));
    expect(r.category).toBe("external");
    expect(r.risk).toBe("low");
  });
});

describe("classifyHitl — fallback", () => {
  it("usa label do nome da tool para tools desconhecidas", () => {
    const r = classifyHitl(tc("MyCustomTool"));
    expect(r.category).toBe("generic");
    expect(r.risk).toBe("medium");
    expect(r.label).toBe("MyCustomTool");
  });

  it("normaliza espaços em torno do nome", () => {
    const r = classifyHitl({ id: "c1", name: "  bash  ", arguments: {} });
    expect(r.category).toBe("shell");
  });
});

describe("RISK_COLOR", () => {
  it("tem cores para todos os níveis de risco", () => {
    expect(RISK_COLOR.low).toBeTruthy();
    expect(RISK_COLOR.medium).toBeTruthy();
    expect(RISK_COLOR.high).toBeTruthy();
    expect(RISK_COLOR.critical).toBeTruthy();
  });
});
