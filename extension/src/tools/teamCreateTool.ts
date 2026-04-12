import { randomUUID } from "node:crypto";

import { listRegisteredAgents, registerMailbox } from "../agent/agentMailbox";
import type { ToolDefinition } from "./toolTypes";

interface TeamCreateParams {
  name: string;
  /** Number of worker slots to pre-allocate (default 2, max 8). */
  worker_count?: number;
  /** Optional description of the team's overall mission. */
  mission?: string;
}

interface TeamCreateResult {
  teamId: string;
  name: string;
  coordinatorId: string;
  workerIds: string[];
  mission: string;
  /** Hint for the coordinator about how to use the IDs. */
  usage: string;
}

/**
 * Creates a named agent team with a coordinator slot and N worker slots.
 * Each member gets a registered mailbox that can be targeted by SendMessage.
 *
 * The returned IDs are opaque handles — pass them to SendMessage's `to` field
 * to route messages, or use `to: "*"` to broadcast to all registered agents.
 */
export const teamCreateTool: ToolDefinition<TeamCreateParams, TeamCreateResult> = {
  name: "TeamCreate",
  description:
    "Creates a named team of agents with pre-allocated mailboxes for swarm communication. " +
    "Returns a coordinatorId and workerIds that can be used with SendMessage. " +
    "Use to: \"*\" in SendMessage to broadcast to all team members at once.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Human-readable name for this team (e.g. \"refactor-team\").",
      },
      worker_count: {
        type: "number",
        description: "Number of worker slots to create (default 2, max 8).",
      },
      mission: {
        type: "string",
        description: "Optional description of the team's overall goal or mission.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },

  async execute(params) {
    const count = Math.min(8, Math.max(1, Number.isFinite(params.worker_count) ? Math.trunc(params.worker_count ?? 2) : 2));
    const teamId = randomUUID();
    const coordinatorId = randomUUID();
    const workerIds = Array.from({ length: count }, () => randomUUID());

    registerMailbox(coordinatorId);
    for (const wId of workerIds) {
      registerMailbox(wId);
    }

    const allRegistered = listRegisteredAgents().length;

    return {
      teamId,
      name: params.name,
      coordinatorId,
      workerIds,
      mission: params.mission?.trim() ?? "",
      usage: [
        `Team "${params.name}" ready with ${count} worker(s). ${allRegistered} total mailboxes registered.`,
        `Coordinator: ${coordinatorId}`,
        `Workers: ${workerIds.join(", ")}`,
        "Use SendMessage with to: <agentId> for direct messages, or to: \"*\" to broadcast to all agents.",
      ].join("\n"),
    };
  },
};
