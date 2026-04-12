import { randomUUID } from "node:crypto";

import { getCurrentRunHistory } from "../agent/agentRunContext";
import {
  registerBackgroundAgent,
  registerMailbox,
  unregisterMailbox,
} from "../agent/agentMailbox";
import { runForkSubagent } from "../agent/forkSubagent";
import type { ToolDefinition } from "./toolTypes";
import { getWorkspaceRoot } from "./workspacePath";

interface AgentParams {
  task: string;
  /** Optional context string forwarded to the worker. */
  context?: string;
  /**
   * When true, the worker starts with the full parent conversation history.
   * Default: false (worker starts with a clean slate).
   */
  inherit_history?: boolean;
  /**
   * When true, the tool returns immediately with an agentId and the worker
   * runs concurrently. Multiple Agent calls in a single response therefore
   * execute in parallel via Node.js Promise concurrency.
   * Default: false (tool blocks until the worker finishes).
   */
  run_in_background?: boolean;
  /** Maximum LLM rounds for the worker (default 20, cap 50). */
  max_iterations?: number;
}

interface AgentResultRunning {
  agentId: string;
  status: "running";
}

interface AgentResultDone {
  agentId: string;
  status: "done";
  result: string;
  assistantTurns: number;
  truncated: boolean;
}

type AgentResult = AgentResultRunning | AgentResultDone;

/**
 * Spawns a full-capability worker agent to execute an independent task.
 *
 * - The worker has the same tool set as the coordinator MINUS the Agent /
 *   TeamCreate / SendMessage tools (anti-recursion guard).
 * - When `run_in_background: true`, multiple Agent calls in a single model
 *   response run as concurrent Promises in the Node.js event loop.
 * - When `inherit_history: true`, the worker receives the parent's full
 *   conversation history for context.
 */
export const agentTool: ToolDefinition<AgentParams, AgentResult> = {
  name: "Agent",
  description:
    "Spawns a full-capability worker agent to execute a task autonomously. " +
    "Set run_in_background: true to launch without blocking — multiple Agent calls " +
    "in a single response run concurrently. " +
    "Workers cannot spawn further workers (anti-recursion). " +
    "Use inherit_history: true to give the worker the full conversation context.",
  parameters: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "Clear, self-contained description of what the worker must do.",
      },
      context: {
        type: "string",
        description: "Optional extra context the worker should know (architecture notes, constraints, etc.).",
      },
      inherit_history: {
        type: "boolean",
        description: "If true, the worker starts with the full parent conversation history. Default: false.",
      },
      run_in_background: {
        type: "boolean",
        description:
          "If true, returns immediately with agentId and runs the worker concurrently. " +
          "If false (default), blocks until the worker completes and returns the result.",
      },
      max_iterations: {
        type: "number",
        description: "Maximum LLM rounds for the worker (default 20, cap 50).",
      },
    },
    required: ["task"],
    additionalProperties: false,
  },

  async execute(params) {
    const agentId = randomUUID();
    const runInBackground = params.run_in_background ?? false;
    const maxIterations = Math.min(50, Math.max(1, Number.isFinite(params.max_iterations) ? Math.trunc(params.max_iterations ?? 20) : 20));
    const parentHistory = (params.inherit_history ?? false) ? getCurrentRunHistory() : [];

    registerMailbox(agentId);

    const forkParams: Parameters<typeof runForkSubagent>[0] = {
      agentId,
      task: params.task,
      parentHistory,
      workspaceRoot: getWorkspaceRoot(),
      maxIterations,
    };
    if (params.context !== undefined) {
      forkParams.context = params.context;
    }
    const promise = runForkSubagent(forkParams);

    if (runInBackground) {
      registerBackgroundAgent(agentId, promise);
      return { agentId, status: "running" } satisfies AgentResultRunning;
    }

    const forkResult = await promise;
    unregisterMailbox(agentId);
    return {
      agentId,
      status: "done",
      result: forkResult.result,
      assistantTurns: forkResult.assistantTurns,
      truncated: forkResult.truncated,
    } satisfies AgentResultDone;
  },
};
