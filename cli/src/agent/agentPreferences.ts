import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Caminho relativo à raiz do workspace. */
export const AGENT_PREFERENCES_RELATIVE = path.join(".cappy", "agent-preferences.json");

/**
 * Preferências do projeto consultáveis pelo agente (ficheiro em `.cappy/agent-preferences.json`).
 */
export interface AgentPreferences {
  version: 1;
  hitl: {
    /**
     * `confirm_each` — pedir confirmação para cada tool destrutiva (predefinição).
     * `allow_all` — não bloquear no HITL para tools destrutivas (definido pelo utilizador na UI).
     */
    destructiveTools: "confirm_each" | "allow_all";
  };
}

const DEFAULT_PREFERENCES: AgentPreferences = {
  version: 1,
  hitl: {
    destructiveTools: "confirm_each",
  },
};

function preferencesPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, AGENT_PREFERENCES_RELATIVE);
}

/**
 * Lê preferências do disco; devolve `null` se o ficheiro não existir ou for inválido.
 */
export async function loadAgentPreferences(workspaceRoot: string): Promise<AgentPreferences | null> {
  const filePath = preferencesPath(workspaceRoot);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!isAgentPreferences(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Grava preferências no workspace (cria `.cappy` se necessário).
 */
export async function saveAgentPreferences(workspaceRoot: string, prefs: AgentPreferences): Promise<void> {
  const dir = path.join(workspaceRoot, ".cappy");
  await fs.mkdir(dir, { recursive: true });
  const filePath = preferencesPath(workspaceRoot);
  const body = `${JSON.stringify(prefs, null, 2)}\n`;
  await fs.writeFile(filePath, body, "utf-8");
}

/**
 * Garante um ficheiro predefinição quando não existe (para o agente e o utilizador verem o formato).
 */
export async function ensureDefaultAgentPreferencesFile(workspaceRoot: string): Promise<void> {
  const filePath = preferencesPath(workspaceRoot);
  try {
    await fs.access(filePath);
  } catch {
    await saveAgentPreferences(workspaceRoot, DEFAULT_PREFERENCES);
  }
}

/**
 * Bloco curto injectado no system prompt para o modelo respeitar preferências explícitas.
 */
export function formatAgentPreferencesPromptBlock(prefs: AgentPreferences | null): string {
  const effective = prefs ?? DEFAULT_PREFERENCES;
  const policy = effective.hitl.destructiveTools;
  const lines = [
    "## Preferências do projeto",
    "",
    `Ficheiro: \`${AGENT_PREFERENCES_RELATIVE.replace(/\\/g, "/")}\` (JSON).`,
    "",
    `- **HITL / tools destrutivas** (shell Bash/runTerminal, escrita em ficheiros, etc.): \`${policy}\`.`,
    policy === "allow_all"
      ? [
          "O utilizador definiu **allow_all** neste projeto: a UI **não** bloqueia execuções destrutivas (inclui terminal).",
          "Não peças confirmação ao utilizador em texto (ex.: «posso executar?», «confirma?»); invoca as tools directamente quando fizer sentido. Continua cuidadoso e alinhado ao pedido.",
        ].join(" ")
      : "Cada execução destrutiva requer confirmação na UI até o utilizador aprovar ou alterar preferências.",
    "",
  ];
  return lines.join("\n");
}

function isAgentPreferences(value: unknown): value is AgentPreferences {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  if (rec.version !== 1) {
    return false;
  }
  const hitl = rec.hitl;
  if (hitl === null || typeof hitl !== "object" || Array.isArray(hitl)) {
    return false;
  }
  const h = hitl as Record<string, unknown>;
  return h.destructiveTools === "confirm_each" || h.destructiveTools === "allow_all";
}
