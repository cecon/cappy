import type { ToolCall } from "./types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type HITLStatus = "pending" | "allowed" | "denied";
export type HITLRisk   = "low" | "medium" | "high" | "critical";

export type HitlCategory =
  | "shell"
  | "file-write"
  | "file-edit"
  | "code-diff"
  | "deploy"
  | "database"
  | "secret"
  | "external"
  | "generic";

export interface HitlClassification {
  category: HitlCategory;
  risk: HITLRisk;
  /** Etiqueta curta para o header (ex.: "Terminal", "Escrita em arquivo"). */
  label: string;
}

export const RISK_COLOR: Record<HITLRisk, string> = {
  low:      "teal",
  medium:   "yellow",
  high:     "orange",
  critical: "red",
};

// ─────────────────────────────────────────────
// Classification map
// ─────────────────────────────────────────────

const TOOL_CLASSIFICATION: Record<string, HitlClassification> = {
  // Shell / Terminal
  bash:             { category: "shell",      risk: "high",     label: "Terminal" },
  runterminal:      { category: "shell",      risk: "high",     label: "Terminal" },
  run_terminal_cmd: { category: "shell",      risk: "high",     label: "Terminal" },

  // File Write / Edit
  write:            { category: "file-write", risk: "medium",   label: "Escrita em arquivo" },
  writefile:        { category: "file-write", risk: "medium",   label: "Escrita em arquivo" },
  edit:             { category: "file-edit",  risk: "medium",   label: "Code diff" },

  // Skills
  createskill:      { category: "file-write", risk: "medium",   label: "Escrita em arquivo" },

  // Deploy (futuro)
  deploy:           { category: "deploy",     risk: "critical",  label: "Deploy" },

  // Database (futuro)
  dbmutate:         { category: "database",   risk: "high",     label: "Mutação no banco" },

  // Secrets (futuro)
  secretaccess:     { category: "secret",     risk: "high",     label: "Acesso a credencial" },

  // External
  webfetch:         { category: "external",   risk: "low",      label: "Ação externa" },
  websearch:        { category: "external",   risk: "low",      label: "Ação externa" },
};

const FALLBACK: HitlClassification = {
  category: "generic",
  risk: "medium",
  label: "Tool",
};

/**
 * Classifica um `ToolCall` para determinar variante visual e nível de risco.
 */
export function classifyHitl(toolCall: ToolCall): HitlClassification {
  const key = toolCall.name.trim().toLowerCase();
  return TOOL_CLASSIFICATION[key] ?? { ...FALLBACK, label: toolCall.name };
}
