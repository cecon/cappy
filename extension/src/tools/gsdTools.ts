/**
 * GSD2 tools — spec-driven development state machine for Cappy.
 *
 * Tool surface:
 *   GsdPlan         — create/replace the full project plan (milestones + tasks)
 *   GsdStatus       — read current state (read-only)
 *   GsdStartTask    — mark a task as in_progress (manual mode)
 *   GsdCompleteTask — mark a task as completed and save its summary
 *   GsdDecision     — record an architectural decision
 *   GsdAutoMode     — autonomous loop: read state → dispatch sub-agent → advance
 */

import { randomUUID } from "node:crypto";
import type { ToolDefinition } from "./ToolDefinition";
import { getWorkspaceRoot } from "./workspacePath";
import {
  completeTask,
  createEmptyState,
  findNextTask,
  getGsdStateStore,
  startTask,
} from "../gsd/GsdStateStore";
import { getGsdDispatchBuilder } from "../gsd/GsdDispatchBuilder";
import type { GsdDecision, GsdMilestone, GsdSlice, GsdState, GsdTask } from "../gsd/types";
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

export const gsdPlanTool: ToolDefinition<GsdPlanParams, { ok: true; statePath: string; taskCount: number }> = {
  name: "GsdPlan",
  description:
    "Creates or replaces the GSD2 project plan. " +
    "Define the full hierarchy: project → milestones → tasks → slices. " +
    "Each task should be a self-contained unit of work that a sub-agent can execute in one session. " +
    "Slices are optional sub-steps within a task. " +
    "Assign a branch name to each task for git isolation. " +
    "Calling this resets any existing plan — use GsdStartTask / GsdCompleteTask to advance tasks.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      project: { type: "string", description: "Project name for this GSD plan." },
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
                  description: { type: "string", description: "Detailed description of what to implement." },
                  branch: { type: "string", description: "Git branch name for this task, e.g. 'feat/auth-service'." },
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
    const store = getGsdStateStore();

    const milestones: GsdMilestone[] = params.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? "",
      status: "pending",
      tasks: m.tasks.map((t): GsdTask => ({
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        status: "pending",
        milestoneId: m.id,
        ...(t.branch !== undefined ? { branch: t.branch } : {}),
        slices: (t.slices ?? []).map((s): GsdSlice => ({
          id: s.id,
          description: s.description,
          status: "pending",
        })),
      })),
    }));

    const state: GsdState = {
      ...createEmptyState(params.project),
      milestones,
    };

    await store.save(root, state);
    const taskCount = milestones.reduce((n, m) => n + m.tasks.length, 0);
    return { ok: true, statePath: ".cappy/gsd/STATE.md", taskCount };
  },
};

// ── GsdStatus ─────────────────────────────────────────────────────────────────

export const gsdStatusTool: ToolDefinition<Record<string, never>, { state: GsdState | null; nextTask: string | null }> = {
  name: "GsdStatus",
  description:
    "Reads the current GSD2 project state. " +
    "Returns the full state including milestone/task statuses and the next pending task. " +
    "Use this to inspect progress without modifying anything.",
  readOnly: true,
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  async execute() {
    const root = getWorkspaceRoot();
    const state = await getGsdStateStore().load(root);
    if (!state) return { state: null, nextTask: null };
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
    "Marks a task as in_progress and returns a focused dispatch context for the sub-agent. " +
    "Use this in manual mode before delegating the task to an Agent sub-worker. " +
    "Pass the returned dispatchContext as the 'context' param of the Agent tool.",
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
    const store = getGsdStateStore();
    const state = await store.load(root);
    if (!state) return { ok: false, dispatchContext: "No GSD plan found. Call GsdPlan first." };

    const ok = startTask(state, params.task_id);
    if (!ok) return { ok: false, dispatchContext: `Task '${params.task_id}' not found.` };

    await store.save(root, state);

    // Find the task and its milestone for dispatch context.
    let milestone: GsdMilestone | undefined;
    let task: GsdTask | undefined;
    for (const m of state.milestones) {
      const t = m.tasks.find((t) => t.id === params.task_id);
      if (t) { milestone = m; task = t; break; }
    }

    if (!milestone || !task) return { ok: true, dispatchContext: "Task started." };

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
    "Marks a task as completed and persists its summary for use as context in subsequent tasks. " +
    "Always call this when you finish a GSD task — the summary is pre-loaded into future sub-agents. " +
    "Include: files changed, decisions made, issues found, and what the next task needs to know.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task id being completed." },
      summary: {
        type: "string",
        description:
          "Detailed summary of the work done. Will be pre-loaded as context for subsequent tasks. " +
          "Include: files modified, key decisions, open issues, dependencies created.",
      },
    },
    required: ["task_id", "summary"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const store = getGsdStateStore();
    const state = await store.load(root);
    if (!state) return { ok: false, nextTask: null };

    const ok = completeTask(state, params.task_id);
    if (!ok) return { ok: false, nextTask: null };

    await store.saveTaskSummary(root, params.task_id, params.summary);
    await store.save(root, state);

    const next = findNextTask(state);
    const nextTask = next ? `${next.task.id}: ${next.task.title}` : null;
    return { ok: true, nextTask };
  },
};

// ── GsdDecision ───────────────────────────────────────────────────────────────

interface GsdDecisionParams {
  title: string;
  context: string;
  decision: string;
  rationale?: string;
}

export const gsdDecisionTool: ToolDefinition<GsdDecisionParams, { ok: true; id: string }> = {
  name: "GsdDecision",
  description:
    "Records an architectural decision in the GSD decisions register. " +
    "Decisions are pre-loaded into every subsequent sub-agent's context, " +
    "ensuring consistent choices across the entire project.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title for the decision, e.g. 'Use Postgres over SQLite'." },
      context: { type: "string", description: "Why this decision was needed." },
      decision: { type: "string", description: "What was decided." },
      rationale: { type: "string", description: "Why this option was chosen over alternatives." },
    },
    required: ["title", "context", "decision"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const store = getGsdStateStore();
    const state = await store.load(root) ?? createEmptyState("(unnamed)");

    const id = `d-${randomUUID().slice(0, 8)}`;
    const decision: GsdDecision = {
      id,
      title: params.title,
      context: params.context,
      decision: params.decision,
      rationale: params.rationale ?? "",
      createdAt: new Date().toISOString(),
    };
    state.decisions.push(decision);
    await store.save(root, state);
    return { ok: true, id };
  },
};

// ── GsdAutoMode ───────────────────────────────────────────────────────────────

interface GsdAutoModeParams {
  /** Max tasks to run before stopping (default: all pending). */
  max_tasks?: number;
  /** Max LLM rounds per sub-agent task (default: 30, cap: 80). */
  max_iterations_per_task?: number;
}

interface GsdAutoModeResult {
  tasksCompleted: number;
  tasksFailed: number;
  stoppedReason: "all_done" | "max_tasks_reached" | "no_plan" | "task_limit";
  log: string[];
}

/**
 * GsdAutoMode — the faithful GSD2 autonomous loop.
 *
 * Reads STATE.md → finds next pending task → builds focused dispatch prompt →
 * spawns fresh sub-agent via runForkSubagent → after completion reads updated
 * state → dispatches next task. Repeats until all tasks are done or max_tasks
 * is reached.
 *
 * Each sub-agent starts with a CLEAN 0-message history. Context is pre-loaded
 * via the dispatch prompt (task spec + prior summaries + decisions register).
 * This directly mirrors GSD2's "fresh 200k context per task" design.
 *
 * NOTE: This tool is excluded from fork sub-agents (FORK_EXCLUDED_TOOLS) to
 * prevent recursive auto-mode invocations.
 */
export const gsdAutoModeTool: ToolDefinition<GsdAutoModeParams, GsdAutoModeResult> = {
  name: "GsdAutoMode",
  description:
    "Starts the GSD2 autonomous development loop. " +
    "Reads the project plan, dispatches each pending task to a fresh sub-agent with pre-loaded context, " +
    "waits for completion, then advances to the next task — automatically, without human intervention. " +
    "Each sub-agent gets a clean context window (no history inheritance) with exactly the context it needs. " +
    "Requires GsdPlan to have been called first. " +
    "Sub-agents must call GsdCompleteTask when done; auto mode reads the updated state after each task.",
  parameters: {
    type: "object",
    properties: {
      max_tasks: {
        type: "number",
        description: "Maximum number of tasks to run before stopping (default: unlimited).",
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
    const store = getGsdStateStore();
    const builder = getGsdDispatchBuilder();

    const maxTasks = params.max_tasks ?? Number.MAX_SAFE_INTEGER;
    const maxIter = Math.min(80, Math.max(1, params.max_iterations_per_task ?? 30));

    const log: string[] = [];
    let tasksCompleted = 0;
    let tasksFailed = 0;

    let state = await store.load(root);
    if (!state) {
      return { tasksCompleted: 0, tasksFailed: 0, stoppedReason: "no_plan", log: ["No GSD plan found. Call GsdPlan first."] };
    }

    while (tasksCompleted + tasksFailed < maxTasks) {
      // Re-read state after each task to pick up GsdCompleteTask writes.
      state = (await store.load(root))!;
      const next = findNextTask(state);

      if (!next) {
        log.push("All tasks completed.");
        return { tasksCompleted, tasksFailed, stoppedReason: "all_done", log };
      }

      const { milestone, task } = next;
      log.push(`[START] ${task.id}: ${task.title}`);

      // Mark task as in_progress before dispatch.
      startTask(state, task.id);
      await store.save(root, state);

      // Build fresh, focused dispatch prompt — no history inheritance.
      const dispatchPrompt = await builder.build(root, state, milestone, task);

      try {
        const result = await runForkSubagent({
          agentId: `gsd-${task.id}-${randomUUID().slice(0, 6)}`,
          task: `Execute GSD task: ${task.title}`,
          context: dispatchPrompt,
          parentHistory: [], // FRESH CONTEXT — core of GSD2
          workspaceRoot: root,
          maxIterations: maxIter,
        });

        // Re-read state to see if sub-agent called GsdCompleteTask.
        state = (await store.load(root))!;
        const taskAfter = state.milestones
          .flatMap((m) => m.tasks)
          .find((t) => t.id === task.id);

        if (taskAfter?.status !== "completed") {
          // Sub-agent didn't call GsdCompleteTask — mark completed with its result as summary.
          log.push(`[WARN] ${task.id}: sub-agent did not call GsdCompleteTask — auto-completing.`);
          completeTask(state, task.id);
          await store.saveTaskSummary(root, task.id, result.result.slice(0, 2000));
          await store.save(root, state);
        }

        tasksCompleted++;
        log.push(`[DONE] ${task.id} — ${result.assistantTurns} turns${result.truncated ? " (truncated)" : ""}`);
      } catch (err) {
        tasksFailed++;
        log.push(`[FAIL] ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
        // Mark blocked so the loop can continue with remaining tasks.
        state = (await store.load(root))!;
        const failedTask = state.milestones.flatMap((m) => m.tasks).find((t) => t.id === task.id);
        if (failedTask) failedTask.status = "blocked";
        await store.save(root, state);
      }
    }

    return { tasksCompleted, tasksFailed, stoppedReason: "max_tasks_reached", log };
  },
};
