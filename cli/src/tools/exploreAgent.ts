import { runExploreSubagent } from "../agent/exploreSubagentRunner";
import type { ExploreFocus } from "../agent/exploreSubagentRunner";
import type { ToolDefinition } from "./toolTypes";
import { getWorkspaceRoot } from "./workspacePath";

interface ExploreAgentParams {
  goal: string;
  /** Onde concentrar a pesquisa: repositório, web ou ambos. */
  focus?: ExploreFocus;
  /** Máximo de chamadas ao modelo (rodadas). Predefinido 12, máximo 32. */
  max_iterations?: number;
}

interface ExploreAgentResult {
  report: string;
  truncated: boolean;
  assistantTurns: number;
}

/**
 * Delega uma pesquisa profunda a um subagente só de leitura (Grep, Glob, Read, web).
 * Não escreve ficheiros nem executa shell; útil para varrer código e recolher dados públicos.
 */
export const exploreAgentTool: ToolDefinition<ExploreAgentParams, ExploreAgentResult> = {
  name: "ExploreAgent",
  description:
    "Spawns a read-only subagent to search the codebase (Grep, Glob, Read, searchCode) and/or the public web (WebSearch, WebFetch). " +
    "Use for broad exploration when a single Grep/WebSearch is not enough. Does not modify files or run shell commands.",
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description: "Clear objective: what to find, which area, expected output format.",
      },
      focus: {
        type: "string",
        enum: ["codebase", "web", "both"],
        description: "codebase = repo only; web = public URLs; both = balanced.",
      },
      max_iterations: {
        type: "number",
        description: "Max LLM rounds for the subagent (default 12, cap 32).",
      },
    },
    required: ["goal"],
    additionalProperties: false,
  },
  async execute(params) {
    const goal = params.goal?.trim() ?? "";
    if (goal.length === 0) {
      throw new Error("goal is required.");
    }
    const focus = (params.focus ?? "both") as ExploreFocus;
    const rawMax = params.max_iterations;
    const maxIterations = Math.min(32, Math.max(1, Number.isFinite(rawMax) ? Math.trunc(rawMax ?? 12) : 12));

    return runExploreSubagent({
      goal,
      focus,
      maxIterations,
      workspaceRoot: getWorkspaceRoot(),
    });
  },
};
