import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * OpenRouter configuration block.
 */
interface OpenRouterConfig {
  apiKey: string;
  model: string;
  visionModel: string;
  /** Janela de contexto em tokens (estimativa UI + orçamento de compactação). */
  contextWindowTokens?: number | undefined;
  /** Tokens reservados para a resposta do modelo. */
  reservedOutputTokens?: number | undefined;
}

/**
 * Agent runtime configuration block.
 */
export type ActiveAgent = "coder" | "planner" | "reviewer" | "strategist" | "tdd" | "sdd";

/**
 * Agent runtime configuration block.
 */
interface AgentConfig {
  activeAgent: ActiveAgent;
  systemPrompt: string;
  maxIterations: number;
  /**
   * Se `true` (omissão), após falha de parse dos argumentos de uma tool tenta um pedido LLM curto para corrigir o JSON antes de reportar erro ao modelo principal.
   */
  recoverToolArgumentsWithLlm?: boolean | undefined;
}

/**
 * MCP server entry persisted in config.
 */
export interface McpServerConfig {
  name: string;
  url: string;
}

/**
 * RAG subsystem configuration block.
 */
export interface RagConfig {
  enabled: boolean;
  embeddingModel: string;
  dimensions: number;
  chunkMaxChars: number;
  chunkOverlapChars: number;
  embeddingBatchSize: number;
  ignorePatterns: string[];
  includeExtensions: string[];
}

/**
 * Controlo do comportamento de compactação automática do contexto.
 * Inspirado no bloco `compaction` do Kilo.
 */
export interface CompactionConfig {
  /**
   * Se `false`, desativa o loop de sanitização LLM (trim sem resumo).
   * Útil para modelos com janelas de contexto muito grandes ou em testes.
   * Padrão: `true`.
   */
  auto?: boolean | undefined;
  /**
   * Buffer de segurança em tokens subtraído da janela antes de calcular o orçamento útil.
   * Sobrescreve `AUTOCOMPACT_BUFFER_TOKENS` (padrão 13 000).
   */
  bufferTokens?: number | undefined;
}

/**
 * Full Cappy runtime configuration.
 */
export interface CappyConfig {
  openrouter: OpenRouterConfig;
  agent: AgentConfig;
  mcp: {
    servers: McpServerConfig[];
  };
  rag?: RagConfig;
  /** Controlo da compactação automática de contexto. */
  compaction?: CompactionConfig | undefined;
  /** Habilita logs verbosos no Output Channel do Cappy. */
  debug?: boolean | undefined;
}

/**
 * Returns the default configuration values.
 */
export function defaultConfig(): CappyConfig {
  return {
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
    mcp: {
      servers: [],
    },
    rag: {
      enabled: true,
      embeddingModel: "text-embedding-3-small",
      dimensions: 512,
      chunkMaxChars: 1500,
      chunkOverlapChars: 150,
      embeddingBatchSize: 20,
      ignorePatterns: [
        "**/node_modules/**", "**/dist/**", "**/build/**", "**/out/**",
        "**/coverage/**", "**/.git/**", "**/*.min.js", "**/*.d.ts", "**/*.map",
      ],
      includeExtensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".cs", ".rs", ".md"],
    },
    debug: false,
  };
}

/**
 * Loads `~/.cappy/config.json` from the user home directory.
 * If it does not exist, creates it with defaults.
 */
export async function loadConfig(): Promise<CappyConfig> {
  const { configPath } = getConfigPaths();

  try {
    const rawFile = await readFile(configPath, "utf8");
    const parsed = JSON.parse(rawFile) as unknown;
    const config = mergeWithDefaults(parsed);
    await saveConfig(config);
    return config;
  } catch (error) {
    if (!isNodeErrorCode(error, "ENOENT")) {
      const config = defaultConfig();
      await saveConfig(config);
      return config;
    }

    const config = defaultConfig();
    await saveConfig(config);
    return config;
  }
}

/**
 * Saves `~/.cappy/config.json` to the user home directory.
 */
export async function saveConfig(config: CappyConfig): Promise<void> {
  const { configDirectoryPath, configPath } = getConfigPaths();
  await mkdir(configDirectoryPath, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/**
 * Returns the global config directory path (`~/.cappy`).
 */
export function getConfigDirectoryPath(): string {
  return path.join(homedir(), ".cappy");
}

/**
 * Returns absolute filesystem paths for config directory and file.
 */
function getConfigPaths(): {
  configDirectoryPath: string;
  configPath: string;
} {
  const configDirectoryPath = getConfigDirectoryPath();
  const configPath = path.join(configDirectoryPath, "config.json");
  return { configDirectoryPath, configPath };
}

/**
 * Merges a runtime value with defaults and normalizes invalid shapes.
 */
function mergeWithDefaults(raw: unknown): CappyConfig {
  const defaults = defaultConfig();
  if (!isRecord(raw)) {
    return defaults;
  }

  const rawOpenRouter = isRecord(raw.openrouter) ? raw.openrouter : {};
  const rawAgent = isRecord(raw.agent) ? raw.agent : {};
  const rawMcp = isRecord(raw.mcp) ? raw.mcp : {};
  const rawServers = Array.isArray(rawMcp.servers) ? rawMcp.servers : [];

  return {
    openrouter: {
      apiKey: typeof rawOpenRouter.apiKey === "string" ? rawOpenRouter.apiKey : defaults.openrouter.apiKey,
      model: typeof rawOpenRouter.model === "string" ? rawOpenRouter.model : defaults.openrouter.model,
      visionModel: typeof rawOpenRouter.visionModel === "string" ? rawOpenRouter.visionModel : defaults.openrouter.visionModel,
      contextWindowTokens:
        typeof rawOpenRouter.contextWindowTokens === "number" && rawOpenRouter.contextWindowTokens >= 4096
          ? rawOpenRouter.contextWindowTokens
          : defaults.openrouter.contextWindowTokens,
      reservedOutputTokens:
        typeof rawOpenRouter.reservedOutputTokens === "number" && rawOpenRouter.reservedOutputTokens >= 512
          ? rawOpenRouter.reservedOutputTokens
          : defaults.openrouter.reservedOutputTokens,
    },
    agent: {
      activeAgent: isActiveAgent(rawAgent.activeAgent) ? rawAgent.activeAgent : defaults.agent.activeAgent,
      systemPrompt:
        typeof rawAgent.systemPrompt === "string" ? rawAgent.systemPrompt : defaults.agent.systemPrompt,
      maxIterations:
        typeof rawAgent.maxIterations === "number"
          ? rawAgent.maxIterations
          : defaults.agent.maxIterations,
      recoverToolArgumentsWithLlm:
        typeof rawAgent.recoverToolArgumentsWithLlm === "boolean"
          ? rawAgent.recoverToolArgumentsWithLlm
          : defaults.agent.recoverToolArgumentsWithLlm,
    },
    mcp: {
      servers: rawServers
        .filter(isRecord)
        .map((server) => ({
          name: typeof server.name === "string" ? server.name : "",
          url: typeof server.url === "string" ? server.url : "",
        }))
        .filter((server) => server.name.length > 0 && server.url.length > 0),
    },
    rag: mergeRagConfig(raw.rag, defaults.rag!),
    compaction: mergeCompactionConfig(raw.compaction),
    debug: typeof raw.debug === "boolean" ? raw.debug : defaults.debug,
  };
}

function mergeRagConfig(raw: unknown, defaults: RagConfig): RagConfig {
  if (!isRecord(raw)) return defaults;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
    embeddingModel: typeof raw.embeddingModel === "string" ? raw.embeddingModel : defaults.embeddingModel,
    dimensions: typeof raw.dimensions === "number" && raw.dimensions > 0 ? raw.dimensions : defaults.dimensions,
    chunkMaxChars: typeof raw.chunkMaxChars === "number" && raw.chunkMaxChars > 0 ? raw.chunkMaxChars : defaults.chunkMaxChars,
    chunkOverlapChars: typeof raw.chunkOverlapChars === "number" ? raw.chunkOverlapChars : defaults.chunkOverlapChars,
    embeddingBatchSize: typeof raw.embeddingBatchSize === "number" && raw.embeddingBatchSize > 0 ? raw.embeddingBatchSize : defaults.embeddingBatchSize,
    ignorePatterns: Array.isArray(raw.ignorePatterns) ? (raw.ignorePatterns as string[]).filter((p) => typeof p === "string") : defaults.ignorePatterns,
    includeExtensions: Array.isArray(raw.includeExtensions) ? (raw.includeExtensions as string[]).filter((p) => typeof p === "string") : defaults.includeExtensions,
  };
}

function mergeCompactionConfig(raw: unknown): CompactionConfig | undefined {
  if (!isRecord(raw)) return undefined;
  const result: CompactionConfig = {};
  if (typeof raw.auto === "boolean") result.auto = raw.auto;
  if (typeof raw.bufferTokens === "number" && raw.bufferTokens >= 0) result.bufferTokens = raw.bufferTokens;
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Narrows unknown values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Checks whether an unknown error has a specific Node.js error code.
 */
function isNodeErrorCode(error: unknown, code: string): boolean {
  return isRecord(error) && typeof error.code === "string" && error.code === code;
}

/**
 * Narrows unknown values to one supported active agent id.
 */
function isActiveAgent(value: unknown): value is ActiveAgent {
  return (
    value === "coder" ||
    value === "planner" ||
    value === "reviewer" ||
    value === "strategist" ||
    value === "tdd" ||
    value === "sdd"
  );
}
