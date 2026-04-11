/**
 * Domain service: HITL classification and presentation routing.
 * Merges hitlClassify.ts + hitlPresentation.ts into a single source of truth.
 */

import type { ToolCall } from "../../lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type HITLRisk = "low" | "medium" | "high" | "critical";

export type HitlCategory =
  | "shell"
  | "file-write"
  | "file-edit"
  | "deploy"
  | "database"
  | "secret"
  | "external"
  | "generic";

export interface HitlClassification {
  category: HitlCategory;
  risk: HITLRisk;
  /** Short label for the HITL card header. */
  label: string;
}

/** Maps risk level to Mantine color name for UI rendering. */
export const RISK_COLOR: Record<HITLRisk, string> = {
  low: "teal",
  medium: "yellow",
  high: "orange",
  critical: "red",
};

// ── Classification map ─────────────────────────────────────────────────────

const CLASSIFICATION_MAP: Record<string, HitlClassification> = {
  // Shell / Terminal
  bash:             { category: "shell",      risk: "high",     label: "Terminal" },
  runterminal:      { category: "shell",      risk: "high",     label: "Terminal" },
  run_terminal_cmd: { category: "shell",      risk: "high",     label: "Terminal" },

  // File write / edit
  write:            { category: "file-write", risk: "medium",   label: "Escrita em arquivo" },
  writefile:        { category: "file-write", risk: "medium",   label: "Escrita em arquivo" },
  edit:             { category: "file-edit",  risk: "medium",   label: "Code diff" },
  createskill:      { category: "file-write", risk: "medium",   label: "Escrita em arquivo" },

  // Deploy / DB / Secret (future tools)
  deploy:           { category: "deploy",     risk: "critical", label: "Deploy" },
  dbmutate:         { category: "database",   risk: "high",     label: "Mutação no banco" },
  secretaccess:     { category: "secret",     risk: "high",     label: "Acesso a credencial" },

  // External (read-only side-effects)
  webfetch:         { category: "external",   risk: "low",      label: "Ação externa" },
  websearch:        { category: "external",   risk: "low",      label: "Ação externa" },
};

const FALLBACK_CLASSIFICATION: HitlClassification = {
  category: "generic",
  risk: "medium",
  label: "Tool",
};

// ── Service functions ──────────────────────────────────────────────────────

/**
 * Classifies a ToolCall to determine its visual variant and risk level.
 */
export function classifyHitl(toolCall: ToolCall): HitlClassification {
  const key = toolCall.name.trim().toLowerCase();
  return CLASSIFICATION_MAP[key] ?? { ...FALLBACK_CLASSIFICATION, label: toolCall.name };
}

/** Tool names whose HITL should appear inside the Terminal panel (not generic card). */
const TERMINAL_HITL_NAMES = new Set(["bash", "runterminal", "run_terminal_cmd"]);

/**
 * Returns true if this tool's HITL should appear in the ChatTerminal panel.
 * Returns false → use generic ToolConfirmCard.
 */
export function isTerminalHitlPresentation(toolCall: ToolCall): boolean {
  return TERMINAL_HITL_NAMES.has(toolCall.name.trim().toLowerCase());
}
