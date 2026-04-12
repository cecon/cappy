/**
 * Adapter: persists CappyConfig and AgentPreferences as JSON files.
 * Implements IConfigRepository. All I/O is isolated here.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { IConfigRepository } from "../../domain/ports/IConfigRepository";
import type { AgentPreferences, CappyConfig } from "../../domain/entities/AgentConfig";

const CAPPY_DIR = ".cappy";
const CONFIG_FILE = "config.json";
const PREFS_FILE = "agent-preferences.json";

const DEFAULT_CONFIG: CappyConfig = {
  openrouter: {
    apiKey: "",
    model: "openai/gpt-oss-120b",
    visionModel: "meta-llama/llama-3.2-11b-vision-instruct:free",
    contextWindowTokens: 128_000,
    reservedOutputTokens: 8192,
  },
  agent: {
    activeAgent: "coder",
    systemPrompt: "You are Cappy, an expert coding assistant.",
    maxIterations: 20,
    recoverToolArgumentsWithLlm: true,
  },
  mcp: { servers: [] },
  debug: false,
};

const DEFAULT_PREFS: AgentPreferences = {
  version: 1,
  hitl: { destructiveTools: "confirm_each" },
};

export class JsonConfigAdapter implements IConfigRepository {
  private readonly configDir: string;
  private readonly configPath: string;

  constructor() {
    this.configDir = path.join(homedir(), CAPPY_DIR);
    this.configPath = path.join(this.configDir, CONFIG_FILE);
  }

  async loadConfig(): Promise<CappyConfig> {
    try {
      const raw = await readFile(this.configPath, "utf8");
      const config = mergeConfig(JSON.parse(raw) as unknown);
      await this.saveConfig(config);
      return config;
    } catch {
      const config = structuredClone(DEFAULT_CONFIG);
      await this.saveConfig(config);
      return config;
    }
  }

  async saveConfig(config: CappyConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  async loadPreferences(workspaceRoot: string): Promise<AgentPreferences | null> {
    try {
      const raw = await readFile(prefsPath(workspaceRoot), "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      return isAgentPreferences(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async savePreferences(workspaceRoot: string, prefs: AgentPreferences): Promise<void> {
    await mkdir(path.join(workspaceRoot, CAPPY_DIR), { recursive: true });
    await writeFile(prefsPath(workspaceRoot), `${JSON.stringify(prefs, null, 2)}\n`, "utf-8");
  }

  async ensurePreferencesFile(workspaceRoot: string): Promise<void> {
    try {
      await access(prefsPath(workspaceRoot));
    } catch {
      await this.savePreferences(workspaceRoot, DEFAULT_PREFS);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function prefsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, CAPPY_DIR, PREFS_FILE);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAgentPreferences(v: unknown): v is AgentPreferences {
  if (!isRecord(v) || v.version !== 1) return false;
  const h = v.hitl;
  return isRecord(h) && (h.destructiveTools === "confirm_each" || h.destructiveTools === "allow_all");
}

function isActiveAgent(v: unknown): v is CappyConfig["agent"]["activeAgent"] {
  return v === "coder" || v === "planner" || v === "reviewer";
}

function mergeConfig(raw: unknown): CappyConfig {
  if (!isRecord(raw)) return structuredClone(DEFAULT_CONFIG);
  const or = isRecord(raw.openrouter) ? raw.openrouter : {};
  const ag = isRecord(raw.agent) ? raw.agent : {};
  const mcp = isRecord(raw.mcp) ? raw.mcp : {};
  const servers = Array.isArray(mcp.servers) ? mcp.servers : [];
  return {
    openrouter: {
      apiKey: typeof or.apiKey === "string" ? or.apiKey : DEFAULT_CONFIG.openrouter.apiKey,
      model: typeof or.model === "string" ? or.model : DEFAULT_CONFIG.openrouter.model,
      visionModel: typeof or.visionModel === "string" ? or.visionModel : DEFAULT_CONFIG.openrouter.visionModel,
      ...(typeof or.contextWindowTokens === "number" && or.contextWindowTokens >= 4096
        ? { contextWindowTokens: or.contextWindowTokens }
        : DEFAULT_CONFIG.openrouter.contextWindowTokens !== undefined
          ? { contextWindowTokens: DEFAULT_CONFIG.openrouter.contextWindowTokens }
          : {}),
      ...(typeof or.reservedOutputTokens === "number" && or.reservedOutputTokens >= 512
        ? { reservedOutputTokens: or.reservedOutputTokens }
        : DEFAULT_CONFIG.openrouter.reservedOutputTokens !== undefined
          ? { reservedOutputTokens: DEFAULT_CONFIG.openrouter.reservedOutputTokens }
          : {}),
    },
    agent: {
      activeAgent: isActiveAgent(ag.activeAgent) ? ag.activeAgent : DEFAULT_CONFIG.agent.activeAgent,
      systemPrompt: typeof ag.systemPrompt === "string" ? ag.systemPrompt : DEFAULT_CONFIG.agent.systemPrompt,
      maxIterations: typeof ag.maxIterations === "number" ? ag.maxIterations : DEFAULT_CONFIG.agent.maxIterations,
      ...(typeof ag.recoverToolArgumentsWithLlm === "boolean"
        ? { recoverToolArgumentsWithLlm: ag.recoverToolArgumentsWithLlm }
        : DEFAULT_CONFIG.agent.recoverToolArgumentsWithLlm !== undefined
          ? { recoverToolArgumentsWithLlm: DEFAULT_CONFIG.agent.recoverToolArgumentsWithLlm }
          : {}),
    },
    mcp: {
      servers: servers
        .filter(isRecord)
        .map((s) => ({ name: typeof s.name === "string" ? s.name : "", url: typeof s.url === "string" ? s.url : "" }))
        .filter((s) => s.name && s.url),
    },
    ...(typeof raw.debug === "boolean"
      ? { debug: raw.debug }
      : DEFAULT_CONFIG.debug !== undefined
        ? { debug: DEFAULT_CONFIG.debug }
        : {}),
  };
}
