/**
 * GSD2 domain types — spec-driven development state machine.
 *
 * Hierarchy: State → Milestone → Task → Slice
 *
 * The state is persisted as JSON in `.cappy/gsd/state.json` with a
 * human-readable view at `.cappy/gsd/STATE.md`.
 */

export type GsdStatus = "pending" | "in_progress" | "completed" | "blocked";

export interface GsdSlice {
  id: string;
  description: string;
  status: GsdStatus;
}

export interface GsdTask {
  id: string;
  title: string;
  description: string;
  status: GsdStatus;
  milestoneId: string;
  /** Git branch name for this task (optional but recommended). */
  branch?: string;
  slices: GsdSlice[];
  startedAt?: string;
  completedAt?: string;
}

export interface GsdMilestone {
  id: string;
  title: string;
  description: string;
  status: GsdStatus;
  tasks: GsdTask[];
}

export interface GsdDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  createdAt: string;
}

export interface GsdState {
  version: 1;
  project: string;
  updatedAt: string;
  milestones: GsdMilestone[];
  decisions: GsdDecision[];
}
