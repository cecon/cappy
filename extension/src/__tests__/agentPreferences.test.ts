import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadAgentPreferences,
  saveAgentPreferences,
  ensureDefaultAgentPreferencesFile,
  formatAgentPreferencesPromptBlock,
  AGENT_PREFERENCES_RELATIVE,
  type AgentPreferences,
} from "../agent/agentPreferences";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cappy-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const validPrefs: AgentPreferences = {
  version: 1,
  hitl: { destructiveTools: "confirm_each" },
};

describe("loadAgentPreferences", () => {
  it("retorna null quando o arquivo não existe", async () => {
    const result = await loadAgentPreferences(tmpDir);
    expect(result).toBeNull();
  });

  it("carrega preferências válidas do disco", async () => {
    await saveAgentPreferences(tmpDir, validPrefs);
    const loaded = await loadAgentPreferences(tmpDir);
    expect(loaded).toEqual(validPrefs);
  });

  it("retorna null para JSON inválido", async () => {
    const filePath = path.join(tmpDir, ".cappy", "agent-preferences.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "{ invalid json }", "utf-8");
    expect(await loadAgentPreferences(tmpDir)).toBeNull();
  });

  it("retorna null para objeto com version errada", async () => {
    const filePath = path.join(tmpDir, ".cappy", "agent-preferences.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ version: 2, hitl: { destructiveTools: "confirm_each" } }), "utf-8");
    expect(await loadAgentPreferences(tmpDir)).toBeNull();
  });

  it("retorna null para destructiveTools inválido", async () => {
    const filePath = path.join(tmpDir, ".cappy", "agent-preferences.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ version: 1, hitl: { destructiveTools: "bad_value" } }), "utf-8");
    expect(await loadAgentPreferences(tmpDir)).toBeNull();
  });

  it("carrega preferências com allow_all", async () => {
    const prefs: AgentPreferences = { version: 1, hitl: { destructiveTools: "allow_all" } };
    await saveAgentPreferences(tmpDir, prefs);
    const loaded = await loadAgentPreferences(tmpDir);
    expect(loaded?.hitl.destructiveTools).toBe("allow_all");
  });
});

describe("saveAgentPreferences", () => {
  it("cria o diretório .cappy se não existir", async () => {
    await saveAgentPreferences(tmpDir, validPrefs);
    const filePath = path.join(tmpDir, ".cappy", "agent-preferences.json");
    const content = await fs.readFile(filePath, "utf-8");
    expect(JSON.parse(content)).toEqual(validPrefs);
  });

  it("grava JSON com formatação legível", async () => {
    await saveAgentPreferences(tmpDir, validPrefs);
    const filePath = path.join(tmpDir, ".cappy", "agent-preferences.json");
    const raw = await fs.readFile(filePath, "utf-8");
    expect(raw).toContain("\n");
    expect(raw.trimEnd().endsWith("}")).toBe(true);
  });
});

describe("ensureDefaultAgentPreferencesFile", () => {
  it("cria o arquivo se não existir", async () => {
    await ensureDefaultAgentPreferencesFile(tmpDir);
    const loaded = await loadAgentPreferences(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
  });

  it("não sobrescreve arquivo existente", async () => {
    const custom: AgentPreferences = { version: 1, hitl: { destructiveTools: "allow_all" } };
    await saveAgentPreferences(tmpDir, custom);
    await ensureDefaultAgentPreferencesFile(tmpDir);
    const loaded = await loadAgentPreferences(tmpDir);
    expect(loaded?.hitl.destructiveTools).toBe("allow_all");
  });
});

describe("formatAgentPreferencesPromptBlock", () => {
  it("inclui o caminho relativo do arquivo", () => {
    const block = formatAgentPreferencesPromptBlock(validPrefs);
    expect(block).toContain(AGENT_PREFERENCES_RELATIVE.replace(/\\/g, "/"));
  });

  it("inclui política confirm_each", () => {
    const block = formatAgentPreferencesPromptBlock(validPrefs);
    expect(block).toContain("confirm_each");
    expect(block).toContain("confirmação");
  });

  it("inclui política allow_all e instrução específica", () => {
    const prefs: AgentPreferences = { version: 1, hitl: { destructiveTools: "allow_all" } };
    const block = formatAgentPreferencesPromptBlock(prefs);
    expect(block).toContain("allow_all");
    expect(block).toContain("allow_all");
    expect(block).not.toContain("Cada execução destrutiva requer confirmação");
  });

  it("usa preferências padrão quando recebe null", () => {
    const block = formatAgentPreferencesPromptBlock(null);
    expect(block).toContain("confirm_each");
  });

  it("retorna string não vazia", () => {
    expect(formatAgentPreferencesPromptBlock(validPrefs).length).toBeGreaterThan(0);
  });
});
