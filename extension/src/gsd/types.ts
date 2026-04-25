/**
 * GSD2 domain types — spec-driven development state machine.
 *
 * Split into three layers:
 *
 *   GsdPlanSpec   — what lives in `gsd-plan.json` at the workspace root (committed to git)
 *   GsdRuntime    — what lives in `~/.cappy/gsd/<hash>/` (local, never committed)
 *   GsdMergedState — spec + runtime merged into a unified read-only view
 */

export type GsdStatus = "pending" | "in_progress" | "completed" | "blocked";

// ── Spec (gsd-plan.json — committed to git, shared with the team) ─────────────

export interface GsdSliceSpec {
  id: string;
  description: string;
}

export interface GsdTaskSpec {
  id: string;
  title: string;
  description: string;
  branch?: string;
  slices: GsdSliceSpec[];
}

export interface GsdMilestoneSpec {
  id: string;
  title: string;
  description: string;
  tasks: GsdTaskSpec[];
}

export interface GsdDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  createdAt: string;
}

export interface GsdPlanSpec {
  version: 1;
  project: string;
  createdAt: string;
  milestones: GsdMilestoneSpec[];
  decisions: GsdDecision[];
}

// ── Runtime (~/.cappy/gsd/<hash>/ — local, never committed) ──────────────────

export interface GsdTaskRuntime {
  status: GsdStatus;
  startedAt?: string;
  completedAt?: string;
}

export interface GsdRuntime {
  version: 1;
  workspaceRoot: string;
  updatedAt: string;
  tasks: Record<string, GsdTaskRuntime>;
}

// ── Merged view (spec + runtime — used by tools and dispatcher) ───────────────

export interface GsdSlice {
  id: string;
  description: string;
  status: GsdStatus;
}

export interface GsdTask {
  id: string;
  title: string;
  description: string;
  branch?: string;
  milestoneId: string;
  slices: GsdSlice[];
  status: GsdStatus;
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

export interface GsdMergedState {
  project: string;
  milestones: GsdMilestone[];
  decisions: GsdDecision[];
}
