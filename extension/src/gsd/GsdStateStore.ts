/**
 * GsdStateStore — persists GSD2 state to `.cappy/gsd/`.
 *
 * Files:
 *   .cappy/gsd/state.json      — machine-readable source of truth
 *   .cappy/gsd/STATE.md        — human-readable view (generated)
 *   .cappy/gsd/summaries/<id>.md — per-task completion summaries
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GsdDecision, GsdMilestone, GsdState, GsdTask } from "./types";

const GSD_DIR = ".cappy/gsd";
const STATE_JSON = "state.json";
const STATE_MD = "STATE.md";
const SUMMARIES_DIR = "summaries";

const STATUS_ICON: Record<string, string> = {
  pending: " ",
  in_progress: "~",
  completed: "x",
  blocked: "!",
};

export class GsdStateStore {
  private dir(root: string): string {
    return path.join(root, GSD_DIR);
  }

  async ensureDir(root: string): Promise<void> {
    await mkdir(path.join(this.dir(root), SUMMARIES_DIR), { recursive: true });
  }

  async load(root: string): Promise<GsdState | null> {
    try {
      const raw = await readFile(path.join(this.dir(root), STATE_JSON), "utf8");
      return JSON.parse(raw) as GsdState;
    } catch {
      return null;
    }
  }

  async save(root: string, state: GsdState): Promise<void> {
    await this.ensureDir(root);
    state.updatedAt = new Date().toISOString();
    const dir = this.dir(root);
    await writeFile(path.join(dir, STATE_JSON), JSON.stringify(state, null, 2), "utf8");
    await writeFile(path.join(dir, STATE_MD), renderStateMd(state), "utf8");
  }

  async saveTaskSummary(root: string, taskId: string, summary: string): Promise<void> {
    await this.ensureDir(root);
    const fp = path.join(this.dir(root), SUMMARIES_DIR, `${taskId}.md`);
    await writeFile(fp, summary, "utf8");
  }

  async loadTaskSummary(root: string, taskId: string): Promise<string | null> {
    try {
      return await readFile(path.join(this.dir(root), SUMMARIES_DIR, `${taskId}.md`), "utf8");
    } catch {
      return null;
    }
  }

  /** Loads summaries for all completed tasks across all milestones. */
  async loadCompletedSummaries(root: string, state: GsdState): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const milestone of state.milestones) {
      for (const task of milestone.tasks) {
        if (task.status === "completed") {
          const s = await this.loadTaskSummary(root, task.id);
          if (s) result[task.id] = s;
        }
      }
    }
    return result;
  }
}

// ── State query helpers ─────────────────────────────────────────────────────

/** Returns the next task that should run (first pending or in_progress). */
export function findNextTask(state: GsdState): { milestone: GsdMilestone; task: GsdTask } | null {
  for (const milestone of state.milestones) {
    if (milestone.status === "completed") continue;
    for (const task of milestone.tasks) {
      if (task.status === "pending" || task.status === "in_progress") {
        return { milestone, task };
      }
    }
  }
  return null;
}

/** Marks a task as in_progress and updates milestone status. Mutates state in place. */
export function startTask(state: GsdState, taskId: string): boolean {
  for (const milestone of state.milestones) {
    for (const task of milestone.tasks) {
      if (task.id === taskId) {
        task.status = "in_progress";
        task.startedAt = new Date().toISOString();
        if (milestone.status === "pending") milestone.status = "in_progress";
        return true;
      }
    }
  }
  return false;
}

/** Marks a task as completed and updates milestone status. Mutates state in place. */
export function completeTask(state: GsdState, taskId: string): boolean {
  for (const milestone of state.milestones) {
    for (const task of milestone.tasks) {
      if (task.id === taskId) {
        task.status = "completed";
        task.completedAt = new Date().toISOString();
        // Auto-complete milestone when all tasks are done.
        if (milestone.tasks.every((t) => t.status === "completed")) {
          milestone.status = "completed";
        }
        return true;
      }
    }
  }
  return false;
}

/** Creates an empty GsdState with the given project name. */
export function createEmptyState(project: string): GsdState {
  return {
    version: 1,
    project,
    updatedAt: new Date().toISOString(),
    milestones: [],
    decisions: [],
  };
}

// ── Markdown renderer ────────────────────────────────────────────────────────

function renderStateMd(state: GsdState): string {
  const lines: string[] = [
    `# GSD State — ${state.project}`,
    ``,
    `> Last updated: ${state.updatedAt}`,
    ``,
    `---`,
    ``,
  ];

  const overallPending = state.milestones.filter((m) => m.status === "pending").length;
  const overallDone = state.milestones.filter((m) => m.status === "completed").length;
  lines.push(`**Milestones:** ${overallDone}/${state.milestones.length} completed`, ``);

  for (const milestone of state.milestones) {
    const icon = STATUS_ICON[milestone.status] ?? " ";
    lines.push(`## [${icon}] ${milestone.title}`);
    if (milestone.description) lines.push(``, `> ${milestone.description}`);
    lines.push(``);

    const tasksDone = milestone.tasks.filter((t) => t.status === "completed").length;
    lines.push(`Tasks: ${tasksDone}/${milestone.tasks.length}`, ``);

    for (const task of milestone.tasks) {
      const tIcon = STATUS_ICON[task.status] ?? " ";
      lines.push(`### [${tIcon}] \`${task.id}\` — ${task.title}`);
      if (task.branch) lines.push(`**Branch:** \`${task.branch}\``);
      if (task.description) lines.push(``, task.description);
      lines.push(``);

      for (const slice of task.slices) {
        const sIcon = STATUS_ICON[slice.status] ?? " ";
        lines.push(`  - [${sIcon}] \`${slice.id}\` ${slice.description}`);
      }
      if (task.slices.length > 0) lines.push(``);
    }
  }

  if (state.decisions.length > 0) {
    lines.push(`---`, ``, `## Architectural Decisions`, ``);
    for (const d of state.decisions) {
      lines.push(`### ${d.title}`);
      lines.push(`**Date:** ${d.createdAt}`);
      lines.push(`**Decision:** ${d.decision}`);
      if (d.rationale) lines.push(`**Rationale:** ${d.rationale}`);
      lines.push(``);
    }
  }

  return lines.join("\n");
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _store: GsdStateStore | undefined;

export function setGsdStateStore(store: GsdStateStore): void {
  _store = store;
}

export function getGsdStateStore(): GsdStateStore {
  if (_store === undefined) {
    _store = new GsdStateStore();
  }
  return _store;
}
