import type { FileDiffPayload } from "../utils/fileDiffPayload";
import type { TodoItem } from "../agent/sessionContext";

export const CAPPY_EVENT_VERSION = 1 as const;
export const CAPPY_SESSION_VERSION = 1 as const;
export const CAPPY_TODOS_VERSION = 1 as const;

export type AgentName = "main" | "explore" | (string & {});

export interface ChatEventBase {
  v: typeof CAPPY_EVENT_VERSION;
  t: number;
}

export interface SessionInitEvent extends ChatEventBase {
  kind: "session:init";
  sessionId: string;
  model: string;
}

export interface UserMessageEvent extends ChatEventBase {
  kind: "user:message";
  id: string;
  content: string;
  images?: { hash: string; mimeType: string }[];
}

export interface AssistantMessageEvent extends ChatEventBase {
  kind: "assistant:message";
  id: string;
  content: string;
  toolCallIds?: string[];
  tokensIn?: number;
  tokensOut?: number;
  costUSD?: number;
  agent?: AgentName;
}

export interface ToolExecutingEvent extends ChatEventBase {
  kind: "tool:executing";
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  agent?: AgentName;
}

export interface ToolResultEvent extends ChatEventBase {
  kind: "tool:result";
  toolCallId: string;
  result: string;
  fileDiff?: FileDiffPayload;
  agent?: AgentName;
}

export interface ToolRejectedEvent extends ChatEventBase {
  kind: "tool:rejected";
  toolCallId: string;
}

export interface PlanStateEvent extends ChatEventBase {
  kind: "plan:state";
  active: boolean;
  content: string | null;
}

export interface TodoStateEvent extends ChatEventBase {
  kind: "todo:state";
  todos: TodoItem[];
}

export type HookOutcome = "ok" | "blocked" | "error";

export interface HookFiredEvent extends ChatEventBase {
  kind: "hook:fired";
  trigger: string;
  hookName: string;
  durationMs: number;
  outcome: HookOutcome;
  message?: string;
}

export interface SystemNoticeEvent extends ChatEventBase {
  kind: "system:notice";
  message: string;
}

export interface SessionClosedEvent extends ChatEventBase {
  kind: "session:closed";
  reason: "user" | "abort" | "errored";
}

export type ChatEvent =
  | SessionInitEvent
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolExecutingEvent
  | ToolResultEvent
  | ToolRejectedEvent
  | PlanStateEvent
  | TodoStateEvent
  | HookFiredEvent
  | SystemNoticeEvent
  | SessionClosedEvent;

export type ChatEventKind = ChatEvent["kind"];

export interface AgentUsage {
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  calls: number;
}

export interface SessionTotals {
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  llmCalls: number;
  toolCalls: number;
}

export type SessionStatus = "active" | "closed" | "errored";

export interface SessionMetadata {
  v: typeof CAPPY_SESSION_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  workspaceRoot: string | null;
  primaryModel: string;
  totals: SessionTotals;
  agents: Record<string, AgentUsage>;
  preview: {
    title: string;
    messageCount: number;
  };
}

export interface TodosFile {
  v: typeof CAPPY_TODOS_VERSION;
  updatedAt: string;
  todos: TodoItem[];
}

export function makeEmptyTotals(): SessionTotals {
  return { tokensIn: 0, tokensOut: 0, costUSD: 0, llmCalls: 0, toolCalls: 0 };
}

export function makeEmptyAgentUsage(): AgentUsage {
  return { tokensIn: 0, tokensOut: 0, costUSD: 0, calls: 0 };
}
