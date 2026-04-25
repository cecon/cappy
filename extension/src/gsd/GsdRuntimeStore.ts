/**
 * GsdRuntimeStore — manages execution state in `~/.cappy/gsd/<hash>/`.
 *
 * This directory is NEVER committed to git. It stores who is running what,
 * when tasks started/completed, and per-task summaries used as context
 * for subsequent sub-agents.
 *
 * The directory is keyed by a hash of the workspace path, so multiple
 * projects coexist cleanly without interfering with each other.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GsdRuntime, GsdStatus, GsdTaskRuntime } from "./types";

function runtimeDir(workspaceRoot: string): string {
  const hash = createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 16);
  return path.join(os.homedir(), ".cappy", "gsd", hash);
}

export class GsdRuntimeStore {
  private async ensureDir(workspaceRoot: string): Promise<string> {
    const dir = runtimeDir(workspaceRoot);
    await mkdir(path.join(dir, "summaries"), { recursive: true });
    return dir;
  }

  async load(workspaceRoot: string): Promise<GsdRuntime> {
    try {
      const fp = path.join(runtimeDir(workspaceRoot), "state.json");
      const raw = await readFile(fp, "utf8");
      return JSON.parse(raw) as GsdRuntime;
    } catch {
      return emptyRuntime(workspaceRoot);
    }
  }

  async save(workspaceRoot: string, runtime: GsdRuntime): Promise<void> {
    runtime.updatedAt = new Date().toISOString();
    const dir = await this.ensureDir(workspaceRoot);
    await writeFile(path.join(dir, "state.json"), JSON.stringify(runtime, null, 2) + "\n", "utf8");
  }

  /** Marks a task as in_progress. Creates the task entry if missing. */
  async startTask(workspaceRoot: string, taskId: string): Promise<void> {
    const runtime = await this.load(workspaceRoot);
    runtime.tasks[taskId] = {
      ...(runtime.tasks[taskId] ?? {}),
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };
    await this.save(workspaceRoot, runtime);
  }

  /** Marks a task as completed. */
  async completeTask(workspaceRoot: string, taskId: string): Promise<void> {
    const runtime = await this.load(workspaceRoot);
    const prev = runtime.tasks[taskId];
    runtime.tasks[taskId] = {
      status: "completed",
      completedAt: new Date().toISOString(),
      ...(prev?.startedAt !== undefined ? { startedAt: prev.startedAt } : {}),
    };
    await this.save(workspaceRoot, runtime);
  }

  /** Marks a task as blocked. */
  async blockTask(workspaceRoot: string, taskId: string): Promise<void> {
    const runtime = await this.load(workspaceRoot);
    const prev = runtime.tasks[taskId];
    runtime.tasks[taskId] = {
      status: "blocked",
      ...(prev?.startedAt !== undefined ? { startedAt: prev.startedAt } : {}),
    };
    await this.save(workspaceRoot, runtime);
  }

  async saveTaskSummary(workspaceRoot: string, taskId: string, summary: string): Promise<void> {
    const dir = await this.ensureDir(workspaceRoot);
    await writeFile(path.join(dir, "summaries", `${taskId}.md`), summary, "utf8");
  }

  async loadTaskSummary(workspaceRoot: string, taskId: string): Promise<string | null> {
    try {
      const fp = path.join(runtimeDir(workspaceRoot), "summaries", `${taskId}.md`);
      return await readFile(fp, "utf8");
    } catch {
      return null;
    }
  }

  /** Loads summaries only for the given task IDs (scoped to a milestone). */
  async loadSummariesForTasks(workspaceRoot: string, taskIds: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const id of taskIds) {
      const s = await this.loadTaskSummary(workspaceRoot, id);
      if (s !== null) result[id] = s;
    }
    return result;
  }
}

function emptyRuntime(workspaceRoot: string): GsdRuntime {
  return {
    version: 1,
    workspaceRoot,
    updatedAt: new Date().toISOString(),
    tasks: {},
  };
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _store: GsdRuntimeStore | undefined;

export function setGsdRuntimeStore(store: GsdRuntimeStore): void {
  _store = store;
}

export function getGsdRuntimeStore(): GsdRuntimeStore {
  if (_store === undefined) _store = new GsdRuntimeStore();
  return _store;
}
