/**
 * GsdDispatchBuilder — assembles the focused context prompt for a sub-agent task.
 *
 * This is the core of GSD2's context pre-loading: instead of inheriting a
 * bloated conversation history, each sub-agent starts fresh with exactly the
 * information it needs — task spec, prior summaries, decisions register, and
 * relevant architecture notes.
 */

import type { GsdDecision, GsdMilestone, GsdState, GsdTask } from "./types";
import type { GsdStateStore } from "./GsdStateStore";

/** Max chars per prior-task summary to include in dispatch (avoids context bloat). */
const MAX_SUMMARY_CHARS = 600;

export class GsdDispatchBuilder {
  constructor(private readonly store: GsdStateStore) {}

  /**
   * Builds the dispatch prompt for a specific task.
   * Called by GsdAutoMode before spawning the sub-agent.
   */
  async build(
    workspaceRoot: string,
    state: GsdState,
    milestone: GsdMilestone,
    task: GsdTask,
  ): Promise<string> {
    const summaries = await this.store.loadCompletedSummaries(workspaceRoot, state);
    const parts: string[] = [];

    // ── Project ──────────────────────────────────────────────────────────────
    parts.push(`# GSD Task Dispatch`);
    parts.push(`**Project:** ${state.project}`);
    parts.push(`**Milestone:** ${milestone.title}`);
    parts.push(``);

    // ── Task ─────────────────────────────────────────────────────────────────
    parts.push(`## Your Task: ${task.title}`);
    parts.push(`**ID:** \`${task.id}\``);
    if (task.branch) {
      parts.push(`**Branch:** \`${task.branch}\` — create or checkout this branch before starting.`);
    }
    parts.push(``);
    if (task.description) {
      parts.push(task.description);
      parts.push(``);
    }

    // ── Slices ────────────────────────────────────────────────────────────────
    if (task.slices.length > 0) {
      parts.push(`### Slices (units of work)`);
      for (const slice of task.slices) {
        const check = slice.status === "completed" ? "[x]" : "[ ]";
        parts.push(`- ${check} \`${slice.id}\` ${slice.description}`);
      }
      parts.push(``);
    }

    // ── Decisions register ────────────────────────────────────────────────────
    if (state.decisions.length > 0) {
      parts.push(`## Architectural Decisions`);
      parts.push(`Respect these decisions when implementing:`);
      parts.push(``);
      for (const d of state.decisions) {
        parts.push(`- **${d.title}:** ${d.decision}`);
        if (d.rationale) parts.push(`  _Rationale: ${d.rationale}_`);
      }
      parts.push(``);
    }

    // ── Prior task summaries ──────────────────────────────────────────────────
    const priorSummaries = buildPriorSummaries(state, summaries);
    if (priorSummaries.length > 0) {
      parts.push(`## Prior Work (completed tasks)`);
      parts.push(`Context from work already done in this milestone:`);
      parts.push(``);
      for (const { title, summary } of priorSummaries) {
        parts.push(`### ${title}`);
        const truncated = summary.length > MAX_SUMMARY_CHARS
          ? summary.slice(0, MAX_SUMMARY_CHARS) + "\n_(truncated)_"
          : summary;
        parts.push(truncated);
        parts.push(``);
      }
    }

    // ── Completion instructions ───────────────────────────────────────────────
    parts.push(`## Completion`);
    parts.push(
      `When the task is fully implemented:\n` +
      `1. Call \`GsdCompleteTask\` with \`task_id: "${task.id}"\` and a detailed \`summary\`.\n` +
      `2. The summary should cover: what was changed, decisions made, issues encountered, and what the next task should know.\n` +
      `3. Do NOT call GsdCompleteTask until the implementation is actually done.`,
    );

    return parts.join("\n");
  }
}

function buildPriorSummaries(
  state: GsdState,
  summaries: Record<string, string>,
): Array<{ title: string; summary: string }> {
  const result: Array<{ title: string; summary: string }> = [];
  for (const milestone of state.milestones) {
    for (const task of milestone.tasks) {
      const summary = summaries[task.id];
      if (task.status === "completed" && summary) {
        result.push({ title: task.title, summary });
      }
    }
  }
  return result;
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
