/**
 * Chat UI state entities — zero external dependencies.
 * Extracted from Chat.tsx module-level types and scattered useState definitions.
 */

import type { CappyConfig, ContextUsageSnapshot, Message, ToolCall } from "../../lib/types";
import type { ContextFile } from "../../components/InputBar";

export type ActivityTone = "working" | "error";

/** Represents one in-progress agent activity shown in the status bar. */
export interface ActivityState {
  primary: string;
  secondary: string | null;
  /** Stable key: used to detect repeated identical activities without resetting timer. */
  signature: string;
  repeats: number;
  startedAtMs: number;
}

/** HITL policy mirrored from the extension host. */
export interface HitlUiPolicy {
  destructiveTools: "confirm_each" | "allow_all";
  sessionAutoApproveDestructive: boolean;
}

/** Full chat panel state managed via useReducer. */
export interface ChatState {
  messages: Message[];
  pendingConfirms: ToolCall[];
  isStreaming: boolean;
  errorMessage: string | null;
  activity: ActivityState | null;
  activityTone: ActivityTone;
  contextFiles: ContextFile[];
  contextUsage: ContextUsageSnapshot | null;
  /** Incremented on new session to remount InputBar (clears drafts/attachments). */
  draftSessionKey: number;
  runtimeConfig: CappyConfig | null;
  agentShellLog: string;
  hitlPolicy: HitlUiPolicy;
}

export const DEFAULT_HITL_POLICY: HitlUiPolicy = {
  destructiveTools: "confirm_each",
  sessionAutoApproveDestructive: false,
};

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  pendingConfirms: [],
  isStreaming: false,
  errorMessage: null,
  activity: null,
  activityTone: "working",
  contextFiles: [],
  contextUsage: null,
  draftSessionKey: 0,
  runtimeConfig: null,
  agentShellLog: "",
  hitlPolicy: DEFAULT_HITL_POLICY,
};
