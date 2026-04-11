/**
 * Domain service: Human-in-the-Loop destructiveness policy.
 * Single source of truth — replaces duplicated lists in loop.ts and hitlClassify.ts.
 */

import type { HitlPolicy } from "../entities/AgentConfig";

/** Built-in tool names that require HITL confirmation. */
const BUILTIN_DESTRUCTIVE = new Set<string>([
  "Write", "writeFile",
  "Edit",
  "Bash", "runTerminal",
]);

/** Keywords that indicate a MCP tool is destructive. */
const MCP_DESTRUCTIVE_KEYWORDS = [
  "write", "delete", "remove", "create", "execute", "run",
  "truncate", "drop", "overwrite", "update", "patch",
  "destroy", "insert", "modify", "deploy", "push", "migrate",
];

export class HitlPolicyService {
  /**
   * Returns true if the tool has side effects and should trigger HITL confirmation.
   * @param isMcp Pass true for MCP-originated tools (name-based keyword heuristic).
   */
  isDestructive(toolName: string, isMcp = false): boolean {
    if (!isMcp) return BUILTIN_DESTRUCTIVE.has(toolName);
    const lower = toolName.toLowerCase();
    return MCP_DESTRUCTIVE_KEYWORDS.some((kw) => lower.includes(kw));
  }

  /**
   * Returns true if the agent loop should pause and await user confirmation.
   */
  shouldConfirm(
    toolName: string,
    policy: HitlPolicy,
    sessionAutoApprove: boolean,
    isMcp = false,
  ): boolean {
    if (!this.isDestructive(toolName, isMcp)) return false;
    return policy !== "allow_all" && !sessionAutoApprove;
  }

  /**
   * Builds the short policy block injected into the system prompt so the
   * model knows whether to ask for confirmation in text or proceed directly.
   */
  buildPromptBlock(policy: HitlPolicy): string {
    const policyNote =
      policy === "allow_all"
        ? "O utilizador definiu **allow_all**: invoca tools directamente sem pedir confirmação em texto."
        : "Cada execução destrutiva requer confirmação na UI antes de avançar.";
    return [
      "## Preferências do projeto",
      "",
      `Ficheiro: \`.cappy/agent-preferences.json\`.`,
      "",
      `- **HITL / tools destrutivas**: \`${policy}\`.`,
      policyNote,
      "",
    ].join("\n");
  }
}
