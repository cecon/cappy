/**
 * Tool names that represent spawned sub-agents (coordinator pattern).
 * Used by WorkersPanel and PipelineDAGView to detect parallel work.
 */
export const AGENT_TOOL_NAMES = new Set(["Agent", "agentTool", "ExploreAgent", "TeamCreate"]);

/**
 * Extracts a short human-readable task description from an agent tool's input.
 * Falls back through common argument names; truncates to the first line.
 */
export function extractAgentTask(
  input: Record<string, unknown>,
  maxLength = 80,
): string {
  const raw =
    (input["task"] as string | undefined) ??
    (input["description"] as string | undefined) ??
    (input["prompt"] as string | undefined) ??
    (input["message"] as string | undefined) ??
    "";
  const first = raw.split("\n")[0]?.trim() ?? "";
  return first.length > maxLength ? `${first.slice(0, maxLength - 3)}…` : first;
}
