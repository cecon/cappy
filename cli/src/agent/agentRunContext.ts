import { AsyncLocalStorage } from "node:async_hooks";

import type { Message } from "./types";

/**
 * AsyncLocalStorage that threads the current agent run's message history
 * through tool execution calls, enabling forked subagents to inherit context.
 *
 * The AgentLoop populates this before each tool.execute() call.
 * AgentTool reads it when `inherit_history: true`.
 */
export const agentRunContext = new AsyncLocalStorage<Message[]>();

/**
 * Returns the message history of the currently executing agent run,
 * or an empty array if called outside an agent run context.
 */
export function getCurrentRunHistory(): Message[] {
  return agentRunContext.getStore() ?? [];
}
