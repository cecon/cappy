/**
 * useReducer-based hook for Chat panel state.
 * Replaces 12+ useState calls in Chat.tsx. Pure reducer — no bridge, no side effects.
 */

import { useReducer } from "react";
import type { CappyConfig, ChatUiMode, FileDiffPayload, Message } from "../lib/types";
import type { ContextFile } from "../components/InputBar";
import {
  INITIAL_CHAT_STATE,
  type ChatState,
  type HitlUiPolicy,
  type ToolRowItem,
  type ToolRowStatus,
} from "../domain/entities/ChatState";
import {
  appendAssistantToken,
  appendToolLogMessage,
  appendToolSlotMessage,
} from "../domain/services/MessageService";
import {
  buildToolActivity,
  createActivity,
  mergeActivity,
} from "../domain/services/ActivityService";
import type { ContextUsageSnapshot } from "../lib/types";

// ── Action union ───────────────────────────────────────────────────────────

export type ChatAction =
  | { type: "SEND_START"; messages: Message[]; mode: ChatUiMode }
  | { type: "STOP" }
  | { type: "SESSION_RESET" }
  | { type: "STREAM_TOKEN"; token: string }
  | { type: "STREAM_DONE" }
  | { type: "STREAM_SYSTEM"; message: string }
  | { type: "TOOL_CONFIRM"; toolCall: import("../lib/types").ToolCall }
  | { type: "TOOL_EXECUTING"; toolCall: import("../lib/types").ToolCall }
  | { type: "TOOL_RESULT"; toolCall: import("../lib/types").ToolCall; result: string; fileDiff?: FileDiffPayload }
  | { type: "TOOL_REJECTED"; toolCall: import("../lib/types").ToolCall }
  | { type: "CONFIG_LOADED"; config: CappyConfig }
  | { type: "CONTEXT_USAGE"; snapshot: ContextUsageSnapshot }
  | { type: "ERROR"; message: string }
  | { type: "HITL_POLICY"; policy: HitlUiPolicy }
  | { type: "MODEL_CHANGE"; modelId: string }
  | { type: "ADD_CONTEXT_FILE"; file: ContextFile }
  | { type: "REMOVE_CONTEXT_FILE"; path: string };

// ── Reducer helpers ────────────────────────────────────────────────────────

function upsertToolRow(
  rows: ToolRowItem[],
  id: string,
  patch: Omit<ToolRowItem, "id">,
): ToolRowItem[] {
  const exists = rows.some((r) => r.id === id);
  if (exists) {
    return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
  }
  return [...rows, { id, ...patch }];
}

function patchToolRow(
  rows: ToolRowItem[],
  id: string,
  patch: Partial<Omit<ToolRowItem, "id">>,
): ToolRowItem[] {
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

// ── Reducer ────────────────────────────────────────────────────────────────

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SEND_START":
      return {
        ...state,
        messages: action.messages,
        isStreaming: true,
        errorMessage: null,
        activityTone: "working",
        activity: createActivity("Pensando", "Analisando contexto"),
      };

    case "STOP":
      return { ...state, isStreaming: false, activity: null };

    case "SESSION_RESET":
      return {
        ...INITIAL_CHAT_STATE,
        draftSessionKey: state.draftSessionKey + 1,
        runtimeConfig: state.runtimeConfig,
      };

    case "STREAM_TOKEN":
      return {
        ...state,
        isStreaming: true,
        activityTone: "working",
        activity: mergeActivity(state.activity, createActivity("Escrevendo resposta", null)),
        messages: appendAssistantToken(state.messages, action.token),
      };

    case "STREAM_DONE":
      return { ...state, isStreaming: false, activity: null };

    case "STREAM_SYSTEM":
      return {
        ...state,
        messages: appendToolLogMessage(state.messages, "Aviso do sistema", action.message),
      };

    case "TOOL_CONFIRM": {
      const { toolCall } = action;
      if (state.pendingConfirms.some((tc) => tc.id === toolCall.id)) return state;
      return {
        ...state,
        messages: appendToolSlotMessage(state.messages, toolCall),
        toolRows: upsertToolRow(state.toolRows, toolCall.id, {
          name: toolCall.name,
          input: toolCall.arguments,
          status: "pending",
        }),
        pendingConfirms: [...state.pendingConfirms, toolCall],
      };
    }

    case "TOOL_EXECUTING": {
      const { toolCall } = action;
      return {
        ...state,
        activityTone: "working",
        activity: mergeActivity(state.activity, buildToolActivity(toolCall)),
        messages: appendToolSlotMessage(state.messages, toolCall),
        toolRows: upsertToolRow(state.toolRows, toolCall.id, {
          name: toolCall.name,
          input: toolCall.arguments,
          status: "running",
        }),
      };
    }

    case "TOOL_RESULT": {
      const { toolCall, result, fileDiff } = action;
      return {
        ...state,
        activityTone: "working",
        activity: mergeActivity(
          state.activity,
          createActivity("Processando resultado da tool", "Atualizando contexto"),
        ),
        toolRows: patchToolRow(state.toolRows, toolCall.id, {
          status: "done",
          output: result,
          ...(fileDiff ? { fileDiff } : {}),
        }),
        pendingConfirms: state.pendingConfirms.filter((tc) => tc.id !== toolCall.id),
      };
    }

    case "TOOL_REJECTED": {
      const { toolCall } = action;
      return {
        ...state,
        activityTone: "working",
        activity: mergeActivity(
          state.activity,
          createActivity("Tool rejeitada, ajustando plano", null),
        ),
        toolRows: patchToolRow(state.toolRows, toolCall.id, { status: "rejected" }),
        pendingConfirms: state.pendingConfirms.filter((tc) => tc.id !== toolCall.id),
      };
    }

    case "CONFIG_LOADED":
      return { ...state, runtimeConfig: action.config };

    case "CONTEXT_USAGE":
      return { ...state, contextUsage: action.snapshot };

    case "ERROR":
      return {
        ...state,
        isStreaming: false,
        errorMessage: action.message,
        activityTone: "error",
        activity: createActivity("Erro durante execucao", action.message),
      };

    case "HITL_POLICY":
      return { ...state, hitlPolicy: action.policy };

    case "MODEL_CHANGE": {
      if (!state.runtimeConfig) return state;
      return {
        ...state,
        runtimeConfig: {
          ...state.runtimeConfig,
          openrouter: { ...state.runtimeConfig.openrouter, model: action.modelId },
        },
      };
    }

    case "ADD_CONTEXT_FILE":
      if (state.contextFiles.some((f) => f.path === action.file.path)) return state;
      return { ...state, contextFiles: [...state.contextFiles, action.file] };

    case "REMOVE_CONTEXT_FILE":
      return { ...state, contextFiles: state.contextFiles.filter((f) => f.path !== action.path) };

    default:
      return state;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useChatReducer(): [ChatState, import("react").Dispatch<ChatAction>] {
  return useReducer(chatReducer, INITIAL_CHAT_STATE);
}
