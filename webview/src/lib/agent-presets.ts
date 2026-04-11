import type { ActiveAgent } from "./types";

/** Identificadores de agente disponíveis no runtime Cappy. */
export const AGENT_OPTIONS: ActiveAgent[] = ["coder", "planner", "reviewer"];

/**
 * Rótulos curtos para UI (seletor no input do chat).
 */
export const AGENT_LABELS: Record<ActiveAgent, string> = {
  coder: "Coder",
  planner: "Planner",
  reviewer: "Reviewer",
};

/**
 * System prompts por agente (alinhados ao preset gravado em `~/.cappy/config.json`).
 */
export const AGENT_PROMPTS: Record<ActiveAgent, string> = {
  coder:
    "You are Cappy, an expert coding assistant. You write clean, well-typed TypeScript and follow best practices.",
  planner:
    "You are Cappy, a technical planning assistant. You break down complex tasks into clear steps, create structured plans, and document decisions.",
  reviewer:
    "You are Cappy, a code review assistant. You identify bugs, suggest improvements, enforce best practices, and explain your reasoning.",
};

/**
 * @param value Valor vindo de um `Select` ou similar.
 * @returns Agente válido ou `null`.
 */
export function parseActiveAgent(value: string | null): ActiveAgent | null {
  if (value === "coder" || value === "planner" || value === "reviewer") {
    return value;
  }
  return null;
}
