import type { ToolCall } from "./types";

/**
 * Nomes de tools cujo HITL usa o formato do painel Terminal (`$ comando`, Enter).
 * Alinhado a `Bash` / `runTerminal` na extension (`extension/src/tools/runTerminal.ts`).
 */
const TERMINAL_HITL_NAMES = new Set(["bash", "runterminal", "run_terminal_cmd"]);

/**
 * @returns `true` se o HITL desta tool deve aparecer no miolo do Terminal; `false` para a caixa genérica (`ToolConfirmCard`).
 */
export function isTerminalHitlPresentation(toolCall: ToolCall): boolean {
  return TERMINAL_HITL_NAMES.has(toolCall.name.trim().toLowerCase());
}
