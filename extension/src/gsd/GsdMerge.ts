/**
 * GsdMerge — pure functions that combine spec + runtime into a unified view.
 */

import type {
  GsdMergedState,
  GsdMilestone,
  GsdPlanSpec,
  GsdRuntime,
  GsdSlice,
  GsdStatus,
  GsdTask,
} from "./types";

/**
 * Merges the committed spec with the local runtime state.
 * The result is a read-only view used by tools and the dispatcher.
 */
export function mergeState(spec: GsdPlanSpec, runtime: GsdRuntime): GsdMergedState {
  const milestones: GsdMilestone[] = spec.milestones.map((ms) => {
    const tasks: GsdTask[] = ms.tasks.map((ts): GsdTask => {
      const rt = runtime.tasks[ts.id];
      const status: GsdStatus = rt?.status ?? "pending";
      const slices: GsdSlice[] = ts.slices.map((sl): GsdSlice => ({
        id: sl.id,
        description: sl.description,
        status: "pending",
      }));

      return {
        id: ts.id,
        title: ts.title,
        description: ts.description,
        milestoneId: ms.id,
        slices,
        status,
        ...(ts.branch !== undefined ? { branch: ts.branch } : {}),
        ...(rt?.startedAt !== undefined ? { startedAt: rt.startedAt } : {}),
        ...(rt?.completedAt !== undefined ? { completedAt: rt.completedAt } : {}),
      };
    });

    return {
      id: ms.id,
      title: ms.title,
      description: ms.description,
      status: deriveMilestoneStatus(tasks),
      tasks,
    };
  });

  return { project: spec.project, milestones, decisions: spec.decisions };
}

/**
 * Returns the first pending or in_progress task across all milestones.
 * Skips completed milestones.
 */
export function findNextTask(state: GsdMergedState): { milestone: GsdMilestone; task: GsdTask } | null {
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

function deriveMilestoneStatus(tasks: GsdTask[]): GsdStatus {
  if (tasks.length === 0) return "pending";
  if (tasks.every((t) => t.status === "completed")) return "completed";
  if (tasks.some((t) => t.status === "in_progress")) return "in_progress";
  if (tasks.some((t) => t.status === "blocked")) return "in_progress";
  return "pending";
}
