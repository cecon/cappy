/**
 * Data Transfer Objects for the agent use cases.
 * Plain data — no behaviour, no deps.
 */

import type { Message, ToolCall, FileDiffPayload } from "../../domain/entities/Message";
import type { ChatUiMode } from "../../domain/entities/AgentConfig";
import type { ContextUsagePayload } from "../../domain/entities/ContextBudget";

// ── Input ──────────────────────────────────────────────────────────────────

export interface RunAgentInput {
  messages: Message[];
  chatMode?: ChatUiMode;
  systemPromptPrefix?: string;
  /** When true, streaming tokens are not emitted (nested subagent runs). */
  silent?: boolean;
  /** When true, plan-mode check is skipped (read-only subagents). */
  ignorePlanMode?: boolean;
  /** Maximum LLM rounds; undefined = unlimited. */
  maxLlmRounds?: number;
  /** Injected workspace skills prompt (loaded per-request by the bridge). */
  workspaceSkillsPrompt?: string;
}

// ── Events emitted during a run ────────────────────────────────────────────

export type AgentRunEvent =
  | { type: "stream:token"; token: string }
  | { type: "stream:done" }
  | { type: "stream:system"; message: string }
  | { type: "context:usage"; payload: ContextUsagePayload }
  | { type: "tool:confirm"; toolCall: ToolCall }
  | { type: "tool:executing"; toolCall: ToolCall }
  | { type: "tool:result"; toolCall: ToolCall; result: string; fileDiff?: FileDiffPayload }
  | { type: "tool:rejected"; toolCall: ToolCall }
  | { type: "error"; error: Error };

/** Callback invoked for each event emitted during a run. */
export type AgentEventHandler = (event: AgentRunEvent) => void;

// ── HITL approval interface ────────────────────────────────────────────────

/**
 * Resolver returned when HITL confirmation is required.
 * The bridge calls `resolve(true)` to approve or `resolve(false)` to reject.
 */
export interface HitlResolver {
  toolCallId: string;
  resolve: (approved: boolean) => void;
}
