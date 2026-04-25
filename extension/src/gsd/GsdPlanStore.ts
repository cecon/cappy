/**
 * GsdPlanStore — manages `gsd-plan.json` at the workspace root.
 *
 * This file IS committed to git. It is the shared spec: milestones, tasks,
 * slices, and architectural decisions. It contains NO runtime state.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GsdDecision, GsdPlanSpec } from "./types";

const PLAN_FILE = "gsd-plan.json";

export class GsdPlanStore {
  planPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, PLAN_FILE);
  }

  async load(workspaceRoot: string): Promise<GsdPlanSpec | null> {
    try {
      const raw = await readFile(this.planPath(workspaceRoot), "utf8");
      return JSON.parse(raw) as GsdPlanSpec;
    } catch {
      return null;
    }
  }

  async save(workspaceRoot: string, plan: GsdPlanSpec): Promise<void> {
    await writeFile(this.planPath(workspaceRoot), JSON.stringify(plan, null, 2) + "\n", "utf8");
  }

  async addDecision(workspaceRoot: string, decision: GsdDecision): Promise<GsdPlanSpec | null> {
    const plan = await this.load(workspaceRoot);
    if (!plan) return null;
    plan.decisions.push(decision);
    await this.save(workspaceRoot, plan);
    return plan;
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _store: GsdPlanStore | undefined;

export function setGsdPlanStore(store: GsdPlanStore): void {
  _store = store;
}

export function getGsdPlanStore(): GsdPlanStore {
  if (_store === undefined) _store = new GsdPlanStore();
  return _store;
}
