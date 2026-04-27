/**
 * Chat UI state entities — zero external dependencies.
 * Extracted from Chat.tsx module-level types and scattered useState definitions.
 */

import type { CappyConfig, ContextUsageSnapshot, FileDiffPayload, Message, PipelineTemplate, PipelineUiState, ToolCall } from "../../lib/types";
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

/** Lifecycle status of a single tool call in the UI. */
export type ToolRowStatus = "pending" | "running" | "done" | "rejected";

/**
 * Tracks the live UI state for one tool call.
 * Drives the inline ToolPartDisplay accordion — separate from the message log.
 */
export interface ToolRowItem {
  /** Matches the ToolCall.id and the tool_call_id on the placeholder message. */
  id: string;
  /** e.g. "bash", "read_file", "str_replace_based_edit" */
  name: string;
  input: Record<string, unknown>;
  output?: string;
  fileDiff?: FileDiffPayload;
  status: ToolRowStatus;
}

/** Full chat panel state managed via useReducer. */
export interface ChatState {
  messages: Message[];
  /** Live state for each tool call — rendered as inline accordions in the message list. */
  toolRows: ToolRowItem[];
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
  hitlPolicy: HitlUiPolicy;
  /** Whether the agent is currently in plan mode. */
  planMode: boolean;
  /** Markdown content of the current plan (null = no plan written yet). */
  planContent: string | null;
  /** Absolute path of the session plan file on disk (null = not yet created). */
  planFilePath: string | null;
  /** Active pipeline state (null when no pipeline is running). */
  pipeline: PipelineUiState | null;
  /** Available pipeline templates from the host. */
  pipelineTemplates: PipelineTemplate[];
}

export const DEFAULT_HITL_POLICY: HitlUiPolicy = {
  destructiveTools: "confirm_each",
  sessionAutoApproveDestructive: false,
};

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  toolRows: [],
  pendingConfirms: [],
  isStreaming: false,
  errorMessage: null,
  activity: null,
  activityTone: "working",
  contextFiles: [],
  contextUsage: null,
  draftSessionKey: 0,
  runtimeConfig: null,
  hitlPolicy: DEFAULT_HITL_POLICY,
  planMode: false,
  planContent: null,
  planFilePath: null,
  pipeline: null,
  pipelineTemplates: [],
};
