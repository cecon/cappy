import { randomUUID } from "node:crypto";

/**
 * Message types used in the swarm communication protocol.
 */
export type SwarmMessageType =
  | "message"
  | "plan_approval_request"
  | "plan_approval_response"
  | "shutdown_request"
  | "shutdown_response";

/**
 * A message exchanged between agents in the swarm.
 * `to` can be an agentId for direct delivery or "*" for broadcast.
 */
export interface SwarmMessage {
  id: string;
  from: string;
  to: string;
  payload: string;
  type: SwarmMessageType;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Mailbox registry (in-process, module-level singleton)
// ---------------------------------------------------------------------------

const mailboxes = new Map<string, SwarmMessage[]>();

/**
 * Registers a new mailbox for the given agentId.
 * Safe to call multiple times — does nothing if already registered.
 */
export function registerMailbox(agentId: string): void {
  if (!mailboxes.has(agentId)) {
    mailboxes.set(agentId, []);
  }
}

/**
 * Removes the mailbox for the given agentId and discards pending messages.
 */
export function unregisterMailbox(agentId: string): void {
  mailboxes.delete(agentId);
}

/**
 * Sends a swarm message.
 * - If `to` is "*", the message is delivered to every registered mailbox except the sender.
 * - Otherwise the message is delivered only to the target mailbox (if registered).
 * Returns the number of mailboxes the message was delivered to.
 */
export function sendSwarmMessage(msg: Omit<SwarmMessage, "id" | "timestamp">): number {
  const full: SwarmMessage = {
    ...msg,
    id: randomUUID(),
    timestamp: Date.now(),
  };

  let delivered = 0;
  if (full.to === "*") {
    for (const [agentId, queue] of mailboxes) {
      if (agentId !== full.from) {
        queue.push(full);
        delivered++;
      }
    }
  } else {
    const queue = mailboxes.get(full.to);
    if (queue !== undefined) {
      queue.push(full);
      delivered = 1;
    }
  }
  return delivered;
}

/**
 * Drains and returns all pending messages for the given agentId.
 * Returns an empty array if the mailbox is not registered.
 */
export function receiveMessages(agentId: string): SwarmMessage[] {
  const queue = mailboxes.get(agentId);
  if (queue === undefined) {
    return [];
  }
  const messages = queue.splice(0);
  return messages;
}

/**
 * Returns all currently registered agent IDs (useful for broadcast introspection).
 */
export function listRegisteredAgents(): string[] {
  return Array.from(mailboxes.keys());
}

// ---------------------------------------------------------------------------
// Background agent registry (tracks running async agent Promises)
// ---------------------------------------------------------------------------

export interface BackgroundAgentEntry {
  agentId: string;
  status: "running" | "done" | "error";
  result?: { agentId: string; result: string; truncated: boolean; assistantTurns: number };
  error?: Error;
}

const agentRegistry = new Map<string, BackgroundAgentEntry>();

/**
 * Registers a background agent Promise. Updates the entry when the Promise settles.
 */
export function registerBackgroundAgent(
  agentId: string,
  promise: Promise<{ agentId: string; result: string; truncated: boolean; assistantTurns: number }>,
): void {
  const entry: BackgroundAgentEntry = { agentId, status: "running" };
  agentRegistry.set(agentId, entry);

  promise.then(
    (result) => {
      entry.status = "done";
      entry.result = result;
    },
    (err: unknown) => {
      entry.status = "error";
      entry.error = err instanceof Error ? err : new Error(String(err));
    },
  );
}

/**
 * Returns the current status of a background agent.
 */
export function getAgentStatus(agentId: string): "running" | "done" | "error" | "unknown" {
  return agentRegistry.get(agentId)?.status ?? "unknown";
}

/**
 * Returns the result of a completed background agent, or null if not done.
 */
export function getAgentResult(
  agentId: string,
): BackgroundAgentEntry["result"] | null {
  const entry = agentRegistry.get(agentId);
  if (entry?.status === "done") {
    return entry.result ?? null;
  }
  return null;
}

/**
 * Removes a completed/errored entry from the registry.
 */
export function deregisterBackgroundAgent(agentId: string): void {
  agentRegistry.delete(agentId);
}
