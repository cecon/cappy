import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Mock fs to avoid real disk I/O in unit tests
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockRejectedValue(new Error("not found")),
}));

// Import after mocking
import {
  resetSessionContext,
  getSessionId,
  getPlanMode,
  setPlanMode,
  getPlanFilePath,
  getPlanContent,
  setPlanFilePath,
  setPlanContent,
  getSessionPlanPath,
  initSessionPlanFile,
  writeSessionPlan,
} from "../agent/sessionContext";

describe("sessionContext — sessionId", () => {
  it("getSessionId retorna uma string não vazia", () => {
    const id = getSessionId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("resetSessionContext gera novo sessionId", () => {
    const id1 = getSessionId();
    resetSessionContext();
    const id2 = getSessionId();
    expect(id2).not.toBe(id1);
  });
});

describe("sessionContext — planMode", () => {
  beforeEach(() => resetSessionContext());

  it("começa como false", () => {
    expect(getPlanMode()).toBe(false);
  });

  it("setPlanMode(true) activa plan mode", () => {
    setPlanMode(true);
    expect(getPlanMode()).toBe(true);
  });

  it("resetSessionContext repõe planMode a false", () => {
    setPlanMode(true);
    resetSessionContext();
    expect(getPlanMode()).toBe(false);
  });
});

describe("sessionContext — planFilePath e planContent", () => {
  beforeEach(() => resetSessionContext());

  it("começa como null", () => {
    expect(getPlanFilePath()).toBeNull();
    expect(getPlanContent()).toBeNull();
  });

  it("setPlanFilePath e setPlanContent actualizam os valores", () => {
    setPlanFilePath("/some/path/plan.md");
    setPlanContent("# Plano");
    expect(getPlanFilePath()).toBe("/some/path/plan.md");
    expect(getPlanContent()).toBe("# Plano");
  });

  it("resetSessionContext limpa planFilePath e planContent", () => {
    setPlanFilePath("/some/path/plan.md");
    setPlanContent("# Plano");
    resetSessionContext();
    expect(getPlanFilePath()).toBeNull();
    expect(getPlanContent()).toBeNull();
  });
});

describe("sessionContext — getSessionPlanPath", () => {
  it("retorna caminho dentro de ~/.cappy/sessions/<id>/plan.md", () => {
    const id = "test123";
    const p = getSessionPlanPath(id);
    expect(p).toBe(path.join(os.homedir(), ".cappy", "sessions", id, "plan.md"));
  });
});

describe("sessionContext — initSessionPlanFile", () => {
  beforeEach(() => {
    resetSessionContext();
    vi.clearAllMocks();
    // access rejects by default (file doesn't exist) → writeFile is called
    vi.mocked(fs.access).mockRejectedValue(new Error("not found"));
  });

  it("cria directório e ficheiro, devolve path", async () => {
    const p = await initSessionPlanFile();
    expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(p), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(p, "", "utf-8");
    expect(p).toContain("plan.md");
    expect(getPlanFilePath()).toBe(p);
  });

  it("não sobrescreve ficheiro existente (access resolve)", async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.clearAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    await initSessionPlanFile();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});

describe("sessionContext — writeSessionPlan", () => {
  beforeEach(() => {
    resetSessionContext();
    vi.clearAllMocks();
    vi.mocked(fs.access).mockRejectedValue(new Error("not found"));
  });

  it("escreve conteúdo no ficheiro e actualiza planContent", async () => {
    const content = "# Plano\n- Passo 1\n- Passo 2";
    const p = await writeSessionPlan(content);
    expect(fs.writeFile).toHaveBeenCalledWith(p, content, "utf-8");
    expect(getPlanContent()).toBe(content);
    expect(getPlanFilePath()).toBe(p);
  });

  it("actualiza conteúdo em chamadas sucessivas (PlanWrite progressivo)", async () => {
    await writeSessionPlan("v1");
    await writeSessionPlan("v2 com mais detalhe");
    expect(getPlanContent()).toBe("v2 com mais detalhe");
  });
});
