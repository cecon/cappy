/**
 * GsdDispatchBuilder — assembles the focused context prompt dispatched to each sub-agent.
 *
 * Core GSD2 principle: instead of inheriting a bloated conversation history,
 * each sub-agent starts with a clean context pre-loaded with exactly what it needs:
 *   - The task spec and its slices
 *   - Summaries of previously completed tasks IN THE SAME MILESTONE only
 *   - Architectural decisions from the decisions register
 *
 * Summaries are scoped to the current milestone to avoid loading irrelevant
 * context from past milestones.
 */

import type { GsdMergedState, GsdMilestone, GsdTask } from "./types";
import type { GsdRuntimeStore } from "./GsdRuntimeStore";

const MAX_SUMMARY_CHARS = 600;

export class GsdDispatchBuilder {
  constructor(private readonly runtimeStore: GsdRuntimeStore) {}

  async build(
    workspaceRoot: string,
    state: GsdMergedState,
    milestone: GsdMilestone,
    task: GsdTask,
  ): Promise<string> {
    // Load summaries ONLY from tasks in the same milestone that are already done.
    const completedInMilestone = milestone.tasks
      .filter((t) => t.status === "completed" && t.id !== task.id)
      .map((t) => t.id);
    const summaries = await this.runtimeStore.loadSummariesForTasks(workspaceRoot, completedInMilestone);

    const parts: string[] = [];

    parts.push(`# GSD Task Dispatch`);
    parts.push(`**Project:** ${state.project}`);
    parts.push(`**Milestone:** ${milestone.title}`);
    parts.push(``);

    parts.push(`## Your Task: ${task.title}`);
    parts.push(`**ID:** \`${task.id}\``);
    if (task.branch) {
      parts.push(`**Branch:** checkout or create \`${task.branch}\` before starting.`);
    }
    parts.push(``);
    if (task.description) {
      parts.push(task.description);
      parts.push(``);
    }

    if (task.slices.length > 0) {
      parts.push(`### Slices`);
      for (const slice of task.slices) {
        const check = slice.status === "completed" ? "[x]" : "[ ]";
        parts.push(`- ${check} \`${slice.id}\` ${slice.description}`);
      }
      parts.push(``);
    }

    if (state.decisions.length > 0) {
      parts.push(`## Architectural Decisions`);
      parts.push(`Respect these when implementing:`);
      parts.push(``);
      for (const d of state.decisions) {
        parts.push(`- **${d.title}:** ${d.decision}`);
        if (d.rationale) parts.push(`  _Rationale: ${d.rationale}_`);
      }
      parts.push(``);
    }

    const summaryEntries = Object.entries(summaries);
    if (summaryEntries.length > 0) {
      parts.push(`## Prior Work (same milestone)`);
      parts.push(``);
      for (const [taskId, summary] of summaryEntries) {
        const priorTask = milestone.tasks.find((t) => t.id === taskId);
        if (!priorTask) continue;
        parts.push(`### ${priorTask.title}`);
        const truncated = summary.length > MAX_SUMMARY_CHARS
          ? summary.slice(0, MAX_SUMMARY_CHARS) + "\n_(truncated)_"
          : summary;
        parts.push(truncated);
        parts.push(``);
      }
    }

    parts.push(`## Completion`);
    parts.push(
      `When the task is fully implemented:\n` +
      `1. Call \`GsdCompleteTask\` with \`task_id: "${task.id}"\` and a detailed \`summary\`.\n` +
      `2. Include in the summary: files changed, decisions made, issues found, what the next task needs to know.\n` +
      `3. Do NOT call GsdCompleteTask until the implementation is actually done.`,
    );

    return parts.join("\n");
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _builder: GsdDispatchBuilder | undefined;

export function setGsdDispatchBuilder(builder: GsdDispatchBuilder): void {
  _builder = builder;
}

export function getGsdDispatchBuilder(): GsdDispatchBuilder {
  if (_builder === undefined) {
    throw new Error("GsdDispatchBuilder not initialised. Call setGsdDispatchBuilder() first.");
  }
  return _builder;
}
