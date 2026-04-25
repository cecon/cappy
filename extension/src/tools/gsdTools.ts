/**
 * GSD2 tools — spec-driven development state machine for Cappy.
 *
 * Tool surface:
 *   GsdPlan         — create/replace the spec in gsd-plan.json (committed to git)
 *   GsdStatus       — read merged view of spec + runtime (read-only)
 *   GsdStartTask    — mark a task as in_progress, get its dispatch context
 *   GsdCompleteTask — mark a task as completed, persist its summary
 *   GsdDecision     — record an architectural decision in gsd-plan.json
 *   GsdAutoMode     — autonomous loop: read state → fresh sub-agent → advance
 */

import { randomUUID } from "node:crypto";
import type { ToolDefinition } from "./ToolDefinition";
import { getWorkspaceRoot } from "./workspacePath";
import { getGsdPlanStore } from "../gsd/GsdPlanStore";
import { getGsdRuntimeStore } from "../gsd/GsdRuntimeStore";
import { findNextTask, mergeState } from "../gsd/GsdMerge";
import { getGsdDispatchBuilder } from "../gsd/GsdDispatchBuilder";
import type { GsdDecision, GsdMilestoneSpec, GsdPlanSpec, GsdSliceSpec, GsdTaskSpec } from "../gsd/types";
import { runForkSubagent } from "../agent/forkSubagent";

// ── GsdPlan ───────────────────────────────────────────────────────────────────

interface GsdPlanMilestoneInput {
  id: string;
  title: string;
  description?: string;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    branch?: string;
    slices?: Array<{ id: string; description: string }>;
  }>;
}

interface GsdPlanParams {
  project: string;
  milestones: GsdPlanMilestoneInput[];
}

export const gsdPlanTool: ToolDefinition<GsdPlanParams, { ok: true; planPath: string; taskCount: number }> = {
  name: "GsdPlan",
  description:
    "Creates or replaces the GSD2 project plan. " +
    "Writes `gsd-plan.json` at the workspace root — commit this file to share the spec with the team. " +
    "Define the full hierarchy: project → milestones → tasks → slices. " +
    "Each task should be a self-contained unit of work a sub-agent can execute in one session. " +
    "Assign a branch to each task for git isolation. " +
    "This only writes the spec; runtime state (who is working on what) is stored separately in ~/.cappy/gsd/.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      project: { type: "string", description: "Project name." },
      milestones: {
        type: "array",
        description: "Ordered list of milestones.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Short unique id, e.g. 'm1'." },
            title: { type: "string", description: "Milestone title." },
            description: { type: "string", description: "What this milestone achieves." },
            tasks: {
              type: "array",
              description: "Ordered tasks within this milestone.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Short unique id, e.g. 't1'." },
                  title: { type: "string", description: "Task title." },
                  description: { type: "string", description: "What to implement in detail." },
                  branch: { type: "string", description: "Git branch, e.g. 'feat/auth-service'." },
                  slices: {
                    type: "array",
                    description: "Optional sub-steps.",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["id", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["id", "title"],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "title", "tasks"],
          additionalProperties: false,
        },
      },
    },
    required: ["project", "milestones"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();

    const milestones: GsdMilestoneSpec[] = params.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? "",
      tasks: m.tasks.map((t): GsdTaskSpec => ({
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        ...(t.branch !== undefined ? { branch: t.branch } : {}),
        slices: (t.slices ?? []).map((s): GsdSliceSpec => ({
          id: s.id,
          description: s.description,
        })),
      })),
    }));

    const plan: GsdPlanSpec = {
      version: 1,
      project: params.project,
      createdAt: new Date().toISOString(),
      milestones,
      decisions: [],
    };

    await getGsdPlanStore().save(root, plan);
    const taskCount = milestones.reduce((n, m) => n + m.tasks.length, 0);
    return { ok: true, planPath: "gsd-plan.json", taskCount };
  },
};

// ── GsdStatus ─────────────────────────────────────────────────────────────────

export const gsdStatusTool: ToolDefinition<Record<string, never>, { state: object | null; nextTask: string | null }> = {
  name: "GsdStatus",
  description:
    "Reads the current GSD2 project state — merges the committed spec with the local runtime. " +
    "Returns milestone/task statuses and the next pending task. Read-only.",
  readOnly: true,
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  async execute() {
    const root = getWorkspaceRoot();
    const plan = await getGsdPlanStore().load(root);
    if (!plan) return { state: null, nextTask: "No plan found. Call GsdPlan first." };

    const runtime = await getGsdRuntimeStore().load(root);
    const state = mergeState(plan, runtime);
    const next = findNextTask(state);
    const nextTask = next ? `${next.task.id}: ${next.task.title} (milestone: ${next.milestone.title})` : null;
    return { state, nextTask };
  },
};

// ── GsdStartTask ──────────────────────────────────────────────────────────────

interface GsdStartTaskParams {
  task_id: string;
}

export const gsdStartTaskTool: ToolDefinition<GsdStartTaskParams, { ok: boolean; dispatchContext: string }> = {
  name: "GsdStartTask",
  description:
    "Marks a task as in_progress and returns a focused dispatch context for manual delegation. " +
    "Pass the returned dispatchContext as the 'context' param of the Agent tool when delegating manually. " +
    "In autonomous mode, GsdAutoMode handles this automatically.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task id to start, e.g. 't1'." },
    },
    required: ["task_id"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const plan = await getGsdPlanStore().load(root);
    if (!plan) return { ok: false, dispatchContext: "No plan found. Call GsdPlan first." };

    await getGsdRuntimeStore().startTask(root, params.task_id);
    const runtime = await getGsdRuntimeStore().load(root);
    const state = mergeState(plan, runtime);

    let milestone = null;
    let task = null;
    for (const m of state.milestones) {
      const t = m.tasks.find((t) => t.id === params.task_id);
      if (t) { milestone = m; task = t; break; }
    }

    if (!milestone || !task) return { ok: false, dispatchContext: `Task '${params.task_id}' not found.` };

    const dispatchContext = await getGsdDispatchBuilder().build(root, state, milestone, task);
    return { ok: true, dispatchContext };
  },
};

// ── GsdCompleteTask ───────────────────────────────────────────────────────────

interface GsdCompleteTaskParams {
  task_id: string;
  summary: string;
}

export const gsdCompleteTaskTool: ToolDefinition<GsdCompleteTaskParams, { ok: boolean; nextTask: string | null }> = {
  name: "GsdCompleteTask",
  description:
    "Marks a task as completed and persists its summary as context for subsequent tasks in the same milestone. " +
    "Always call this when you finish a GSD task. " +
    "The summary is pre-loaded into future sub-agents' dispatch prompts. " +
    "Include: files changed, decisions made, issues found, what the next task needs to know.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task id being completed." },
      summary: {
        type: "string",
        description: "Detailed summary of the work done. Will be pre-loaded into subsequent sub-agents.",
      },
    },
    required: ["task_id", "summary"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const runtimeStore = getGsdRuntimeStore();

    await runtimeStore.completeTask(root, params.task_id);
    await runtimeStore.saveTaskSummary(root, params.task_id, params.summary);

    const plan = await getGsdPlanStore().load(root);
    if (!plan) return { ok: true, nextTask: null };

    const runtime = await runtimeStore.load(root);
    const state = mergeState(plan, runtime);
    const next = findNextTask(state);
    return { ok: true, nextTask: next ? `${next.task.id}: ${next.task.title}` : null };
  },
};

// ── GsdDecision ───────────────────────────────────────────────────────────────

interface GsdDecisionParams {
  title: string;
  context: string;
  decision: string;
  rationale?: string;
}

export const gsdDecisionTool: ToolDefinition<GsdDecisionParams, { ok: boolean; id: string }> = {
  name: "GsdDecision",
  description:
    "Records an architectural decision in gsd-plan.json (committed to git). " +
    "Decisions are pre-loaded into every sub-agent's dispatch context to ensure " +
    "consistent choices throughout the project.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title, e.g. 'Use Postgres over SQLite'." },
      context: { type: "string", description: "Why this decision was needed." },
      decision: { type: "string", description: "What was decided." },
      rationale: { type: "string", description: "Why this option over alternatives." },
    },
    required: ["title", "context", "decision"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const id = `d-${randomUUID().slice(0, 8)}`;
    const decision: GsdDecision = {
      id,
      title: params.title,
      context: params.context,
      decision: params.decision,
      rationale: params.rationale ?? "",
      createdAt: new Date().toISOString(),
    };
    const updated = await getGsdPlanStore().addDecision(root, decision);
    return { ok: updated !== null, id };
  },
};

// ── GsdAutoMode ───────────────────────────────────────────────────────────────

interface GsdAutoModeParams {
  max_tasks?: number;
  max_iterations_per_task?: number;
}

interface GsdAutoModeResult {
  tasksCompleted: number;
  tasksFailed: number;
  stoppedReason: "all_done" | "max_tasks_reached" | "no_plan";
  log: string[];
}

/**
 * GsdAutoMode — the faithful GSD2 autonomous development loop.
 *
 * For each pending task:
 *   1. Reads gsd-plan.json (spec) + ~/.cappy/gsd/<hash>/state.json (runtime)
 *   2. Marks the task as in_progress in the runtime
 *   3. Builds a focused dispatch prompt (spec + same-milestone summaries + decisions)
 *   4. Spawns a fresh sub-agent via runForkSubagent with parentHistory: []
 *      — this is the core of GSD2: every task starts with a clean 200k-token context
 *   5. After the sub-agent finishes, re-reads the runtime
 *   6. If the sub-agent called GsdCompleteTask, the task is already marked done
 *   7. If not, auto-completes with the sub-agent's final message as the summary
 *   8. Advances to the next task
 *
 * NOTE: excluded from fork sub-agents (FORK_EXCLUDED_TOOLS) to prevent recursion.
 */
export const gsdAutoModeTool: ToolDefinition<GsdAutoModeParams, GsdAutoModeResult> = {
  name: "GsdAutoMode",
  description:
    "Starts the GSD2 autonomous development loop. " +
    "Each task gets a fresh sub-agent with a clean context window (no history inheritance) " +
    "pre-loaded with exactly the context it needs. " +
    "Reads gsd-plan.json for the spec; runtime state is in ~/.cappy/gsd/ (not committed). " +
    "Requires GsdPlan to have been called first.",
  parameters: {
    type: "object",
    properties: {
      max_tasks: {
        type: "number",
        description: "Maximum tasks to run before stopping (default: all pending).",
      },
      max_iterations_per_task: {
        type: "number",
        description: "Max LLM rounds per sub-agent (default: 30, cap: 80).",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const planStore = getGsdPlanStore();
    const runtimeStore = getGsdRuntimeStore();
    const builder = getGsdDispatchBuilder();

    const maxTasks = params.max_tasks ?? Number.MAX_SAFE_INTEGER;
    const maxIter = Math.min(80, Math.max(1, params.max_iterations_per_task ?? 30));
    const log: string[] = [];
    let tasksCompleted = 0;
    let tasksFailed = 0;

    const plan = await planStore.load(root);
    if (!plan) {
      return { tasksCompleted: 0, tasksFailed: 0, stoppedReason: "no_plan", log: ["No gsd-plan.json found. Call GsdPlan first."] };
    }

    while (tasksCompleted + tasksFailed < maxTasks) {
      const runtime = await runtimeStore.load(root);
      const state = mergeState(plan, runtime);
      const next = findNextTask(state);

      if (!next) {
        log.push("All tasks completed.");
        return { tasksCompleted, tasksFailed, stoppedReason: "all_done", log };
      }

      const { milestone, task } = next;
      log.push(`[START] ${task.id}: ${task.title}`);

      await runtimeStore.startTask(root, task.id);

      const dispatchContext = await builder.build(
        root,
        mergeState(plan, await runtimeStore.load(root)),
        milestone,
        task,
      );

      try {
        const result = await runForkSubagent({
          agentId: `gsd-${task.id}-${randomUUID().slice(0, 6)}`,
          task: `Execute GSD task: ${task.title}`,
          context: dispatchContext,
          parentHistory: [], // FRESH CONTEXT — core of GSD2
          workspaceRoot: root,
          maxIterations: maxIter,
        });

        // Re-read runtime to check if sub-agent called GsdCompleteTask.
        const runtimeAfter = await runtimeStore.load(root);
        const taskStatus = runtimeAfter.tasks[task.id]?.status;

        if (taskStatus !== "completed") {
          log.push(`[WARN] ${task.id}: sub-agent did not call GsdCompleteTask — auto-completing.`);
          await runtimeStore.completeTask(root, task.id);
          await runtimeStore.saveTaskSummary(root, task.id, result.result.slice(0, 2000));
        }

        tasksCompleted++;
        log.push(`[DONE] ${task.id} — ${result.assistantTurns} turns${result.truncated ? " (truncated)" : ""}`);
      } catch (err) {
        tasksFailed++;
        log.push(`[FAIL] ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
        await runtimeStore.blockTask(root, task.id);
      }
    }

    return { tasksCompleted, tasksFailed, stoppedReason: "max_tasks_reached", log };
  },
};
