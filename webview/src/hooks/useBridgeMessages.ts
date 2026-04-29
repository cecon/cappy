/**
 * Hook: subscribes to the vscode bridge and dispatches ChatActions.
 * Extracted from Chat.tsx handleIncomingMessage + bridge useEffect.
 * All bridge side-effects live here; reducer stays pure.
 */

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { ChatAction } from "./useChatReducer";
import type { HitlUiPolicy } from "../domain/entities/ChatState";
import { getBridge } from "../lib/vscode-bridge";

const bridge = getBridge();

/**
 * Subscribes to the bridge for the lifetime of the component.
 * Uses hitlPolicy ref pattern so the effect closure never goes stale.
 */
export function useBridgeMessages(
  dispatch: Dispatch<ChatAction>,
  hitlPolicy: HitlUiPolicy,
): void {
  // Always reflects the latest rendered policy — read inside async callback.
  const hitlPolicyRef = useRef(hitlPolicy);
  hitlPolicyRef.current = hitlPolicy;

  // Request config once on mount.
  useEffect(() => {
    bridge.send({ type: "config:load" });
  }, []);

  // Route incoming messages to reducer actions.
  useEffect(() => {
    return bridge.onMessage((message) => {
      switch (message.type) {
        case "config:loaded":
          dispatch({ type: "CONFIG_LOADED", config: message.config });
          break;

        case "config:saved":
          // Reload to sync latest persisted values.
          bridge.send({ type: "config:load" });
          break;

        case "hitl:policy":
          dispatch({
            type: "HITL_POLICY",
            policy: {
              destructiveTools: message.destructiveTools,
              sessionAutoApproveDestructive: message.sessionAutoApproveDestructive,
            },
          });
          break;

        case "stream:token":
          dispatch({ type: "STREAM_TOKEN", token: message.token });
          break;

        case "stream:done":
          dispatch({ type: "STREAM_DONE" });
          break;

        case "stream:system":
          dispatch({ type: "STREAM_SYSTEM", message: message.message });
          break;

        case "tool:confirm": {
          const policy = hitlPolicyRef.current;
          if (policy.destructiveTools === "allow_all" || policy.sessionAutoApproveDestructive) {
            bridge.send({ type: "tool:approve", toolCallId: message.toolCall.id });
            break;
          }
          dispatch({ type: "TOOL_CONFIRM", toolCall: message.toolCall });
          break;
        }

        case "tool:executing":
          dispatch({ type: "TOOL_EXECUTING", toolCall: message.toolCall });
          break;

        case "tool:result":
          dispatch({
            type: "TOOL_RESULT",
            toolCall: message.toolCall,
            result: message.result,
            ...(message.fileDiff !== undefined ? { fileDiff: message.fileDiff } : {}),
          });
          break;

        case "tool:rejected":
          dispatch({ type: "TOOL_REJECTED", toolCall: message.toolCall });
          break;

        case "context:usage":
          dispatch({
            type: "CONTEXT_USAGE",
            snapshot: {
              usedTokens: message.usedTokens,
              limitTokens: message.limitTokens,
              effectiveInputBudgetTokens: message.effectiveInputBudgetTokens,
              didTrimForApi: message.didTrimForApi,
              droppedMessageCount: message.droppedMessageCount,
            },
          });
          break;

        case "plan:state":
          dispatch({ type: "PLAN_STATE", active: message.active, content: message.content, filePath: message.filePath });
          break;

        case "pipeline:start":
          dispatch({
            type: "PIPELINE_START",
            pipeline: {
              id: message.pipeline.id,
              name: message.pipeline.name,
              currentStageIndex: 0,
              awaitingApproval: false,
              stages: message.pipeline.stages.map((s) => {
                const info: import("../lib/types").PipelineStageInfo = { id: s.id, name: s.name, status: "pending" };
                if (s.requiresApproval !== undefined) info.requiresApproval = s.requiresApproval;
                return info;
              }),
            },
          });
          break;

        case "pipeline:stage:start":
          dispatch({ type: "PIPELINE_STAGE_START", stageId: message.stageId, stageIndex: message.stageIndex });
          break;

        case "pipeline:stage:done":
          dispatch({ type: "PIPELINE_STAGE_DONE", stageId: message.stageId, stageIndex: message.stageIndex });
          break;

        case "pipeline:stage:approve":
          dispatch({ type: "PIPELINE_STAGE_APPROVE", stageId: message.stageId, stageIndex: message.stageIndex });
          break;

        case "pipeline:done":
          dispatch({ type: "PIPELINE_DONE" });
          break;

        case "pipeline:templates":
          dispatch({ type: "PIPELINE_TEMPLATES", templates: message.templates });
          break;

        case "plan:generating":
          dispatch({ type: "PLAN_GENERATING" });
          break;

        case "plan:sync":
          dispatch({ type: "PLAN_SYNC", plan: message.plan });
          break;

        case "error":
          dispatch({ type: "ERROR", message: message.message });
          break;
      }
    });
  }, [dispatch]);
}
