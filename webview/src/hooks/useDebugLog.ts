import { useCallback, useState } from "react";
import type { Dispatch } from "react";
import type { ChatAction } from "./useChatReducer";

export interface DebugEntry {
  ts: number;
  type: string;
  detail: string;
  category: "send" | "stream" | "tool" | "pipeline" | "error" | "system";
}

function categorize(type: string): DebugEntry["category"] {
  if (type === "SEND_START" || type === "STOP") return "send";
  if (type.startsWith("STREAM_")) return "stream";
  if (type.startsWith("TOOL_")) return "tool";
  if (type.startsWith("PIPELINE_")) return "pipeline";
  if (type === "ERROR") return "error";
  return "system";
}

function summarize(action: ChatAction): string {
  switch (action.type) {
    case "SEND_START": return `mode=${action.mode} msgs=${action.messages.length}`;
    case "STREAM_TOKEN": return `+${action.token.length}chars`;
    case "STREAM_SYSTEM": return action.message.slice(0, 80);
    case "TOOL_CONFIRM": return action.toolCall.name;
    case "TOOL_EXECUTING": return action.toolCall.name;
    case "TOOL_RESULT": return `${action.toolCall.name} → ${action.result.length}chars`;
    case "TOOL_REJECTED": return action.toolCall.name;
    case "PIPELINE_START": return action.pipeline.name;
    case "PIPELINE_STAGE_START": return `[${action.stageIndex}] ${action.stageId}`;
    case "PIPELINE_STAGE_DONE": return `[${action.stageIndex}] ${action.stageId}`;
    case "PIPELINE_STAGE_APPROVE": return `[${action.stageIndex}] aguardando aprovação`;
    case "ERROR": return action.message.slice(0, 100);
    case "CONFIG_LOADED": return `model=${action.config.openrouter.model}`;
    case "CONTEXT_USAGE": return `${action.snapshot.usedTokens.toLocaleString()}/${action.snapshot.limitTokens.toLocaleString()} tokens`;
    case "MODEL_CHANGE": return action.modelId;
    default: return "";
  }
}

export function useDebugLog(innerDispatch: Dispatch<ChatAction>): {
  debugLog: DebugEntry[];
  dispatch: Dispatch<ChatAction>;
  clearLog: () => void;
} {
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  const dispatch = useCallback(
    (action: ChatAction) => {
      innerDispatch(action);

      setDebugLog((prev) => {
        // Coalesce consecutive STREAM_TOKEN entries to avoid flooding
        if (action.type === "STREAM_TOKEN") {
          const last = prev[prev.length - 1];
          if (last?.type === "STREAM_TOKEN") {
            const match = last.detail.match(/\+(\d+)chars/);
            const accumulated = match?.[1] ? parseInt(match[1], 10) : 0;
            return [
              ...prev.slice(0, -1),
              { ...last, detail: `+${accumulated + action.token.length}chars` },
            ];
          }
        }

        const entry: DebugEntry = {
          ts: Date.now(),
          type: action.type,
          detail: summarize(action),
          category: categorize(action.type),
        };
        return [...prev.slice(-299), entry];
      });
    },
    [innerDispatch],
  );

  const clearLog = useCallback(() => setDebugLog([]), []);

  return { debugLog, dispatch, clearLog };
}
