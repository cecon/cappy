import { ActionIcon, Box, Group, Loader, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconFileExport } from "@tabler/icons-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CAPPY_NEW_SESSION_EVENT } from "../lib/session-events";
import type { ChatUiMode, ImageAttachment, Message } from "../lib/types";
import { getBridge } from "../lib/vscode-bridge";
import { useChatReducer } from "../hooks/useChatReducer";
import { useBridgeMessages } from "../hooks/useBridgeMessages";
import { useModelOptions } from "../hooks/useModelOptions";
import { InputBar, type ContextFile } from "./InputBar";
import { MessageList } from "./MessageList";
import { PermissionDock } from "./PermissionDock";
import { PlanModePanel } from "./PlanModePanel";
import { PlannerPanel } from "./PlannerPanel";
import { StageProgressBar } from "./StageProgressBar";
import { WorkersPanel } from "./WorkersPanel";
import { PipelineDAGView } from "./PipelineDAGView";
import { AgentTrace } from "./AgentTrace";
import { DebugPanel } from "./DebugPanel";
import { useDebugLog } from "../hooks/useDebugLog";
import { cappyPalette } from "../theme";

const bridge = getBridge();

export function Chat(): JSX.Element {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [state, innerDispatch] = useChatReducer();
  const { debugLog, dispatch, clearLog } = useDebugLog(innerDispatch);
  const [activityTick, setActivityTick] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  useBridgeMessages(dispatch, state.hitlPolicy);
  const availableModels = useModelOptions(state.runtimeConfig?.openrouter.model);

  useEffect(() => { bridge.send({ type: "pipeline:list" }); }, []);

  useEffect(() => {
    const onNewSession = () => dispatch({ type: "SESSION_RESET" });
    window.addEventListener(CAPPY_NEW_SESSION_EVENT, onNewSession);
    return () => window.removeEventListener(CAPPY_NEW_SESSION_EVENT, onNewSession);
  }, [dispatch]);

  useEffect(() => {
    if (!state.activity || state.activityTone !== "working") return;
    const id = window.setInterval(() => setActivityTick((t) => t + 1), 1200);
    return () => window.clearInterval(id);
  }, [state.activity, state.activityTone]);

  useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 80) el.scrollTop = el.scrollHeight;
  }, [state.messages, state.toolRows, state.isStreaming, state.pendingConfirms.length, state.activity?.primary]);

  const elapsedSeconds = useMemo(() => {
    if (!state.activity) return null;
    return Math.max(0, Math.floor((Date.now() - state.activity.startedAtMs) / 1000));
  }, [state.activity, activityTick]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSend(text: string, mode: ChatUiMode, images?: ImageAttachment[]): void {
    const userMsg: Message = { role: "user", content: text };
    if (images && images.length > 0) userMsg.images = images;
    const newMessages = [...state.messages, userMsg];
    dispatch({ type: "SEND_START", messages: newMessages, mode });
    bridge.send({ type: "chat:send", messages: newMessages, mode });
    setActivityTick(0);
  }

  function handlePipelineSend(pipelineId: string, text: string): void {
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...state.messages, userMsg];
    dispatch({ type: "SEND_START", messages: newMessages, mode: "agent" });
    bridge.send({ type: "pipeline:run", pipelineId, messages: newMessages });
    setActivityTick(0);
  }

  function handleStop(): void {
    if (state.pipeline) bridge.send({ type: "pipeline:abort" });
    bridge.send({ type: "chat:stop" });
    dispatch({ type: "STOP" });
  }

  const handleApprove = useCallback((id: string) => bridge.send({ type: "tool:approve", toolCallId: id }), []);
  const handleReject = useCallback((id: string) => bridge.send({ type: "tool:reject", toolCallId: id }), []);
  const handleApproveSession = useCallback((id: string) => bridge.send({ type: "hitl:approveSession", toolCallId: id }), []);
  const handleApprovePersist = useCallback((id: string) => bridge.send({ type: "hitl:approvePersist", toolCallId: id }), []);
  const handleAddContextFile = useCallback((file: ContextFile) => dispatch({ type: "ADD_CONTEXT_FILE", file }), [dispatch]);
  const handleRemoveContextFile = useCallback((path: string) => dispatch({ type: "REMOVE_CONTEXT_FILE", path }), [dispatch]);
  const handleModelChange = useCallback(
    (modelId: string) => {
      if (!state.runtimeConfig) return;
      const updated = { ...state.runtimeConfig, openrouter: { ...state.runtimeConfig.openrouter, model: modelId } };
      dispatch({ type: "MODEL_CHANGE", modelId });
      bridge.send({ type: "config:save", config: updated });
    },
    [dispatch, state.runtimeConfig],
  );

  function handlePlanApprove(): void {
    bridge.send({ type: "plan:approve" });
  }

  function handlePlanReview(reason: string): void {
    bridge.send({ type: "plan:review", reason });
  }

  function handlePlanRegen(reason: string): void {
    bridge.send({ type: "plan:regen", reason });
  }

  function handleExport(): void {
    const date = new Date().toLocaleString("pt-BR");
    const lines: string[] = [`# Conversa Cappy`, ``, `> Exportado em: ${date}`, ``];

    for (const msg of state.messages) {
      if (msg.role === "user") {
        lines.push(`## Usuário`, ``, msg.content, ``);
      } else if (msg.role === "assistant") {
        if (msg.content) lines.push(`## Cappy`, ``, msg.content, ``);
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            lines.push(`### Tool: \`${tc.name}\``, ``, `**Input:**`, "```json", JSON.stringify(tc.arguments, null, 2), "```", ``);
          }
        }
      } else if (msg.role === "tool" && msg.tool_call_id) {
        const row = state.toolRows.find((r) => r.id === msg.tool_call_id);
        if (row?.output) {
          lines.push(`**Output (\`${row.name}\`):**`, "```", row.output.slice(0, 2000), "```", ``);
        }
      }
    }

    bridge.send({ type: "conversation:export", markdown: lines.join("\n") });
  }

  const firstPending = state.pendingConfirms[0] ?? null;

  return (
    <Stack
      gap={0}
      h="100%"
      style={{ minHeight: 0, minWidth: "var(--cappy-chat-min-width, 320px)", width: "100%", boxSizing: "border-box" }}
      justify="space-between"
    >
      {state.pipeline ? (
        state.pipeline.awaitingApproval
          ? <StageProgressBar pipeline={state.pipeline} onAdvance={() => bridge.send({ type: "pipeline:advance" })} />
          : <StageProgressBar pipeline={state.pipeline} />
      ) : null}

      <Group px={6} py={2} justify="flex-end" style={{ flexShrink: 0 }}>
        <Tooltip label="Debug" position="left" withArrow>
          <ActionIcon
            variant={showDebug ? "filled" : "subtle"}
            color={showDebug ? "orange" : "dimmed"}
            size="xs"
            aria-label="Abrir painel de debug"
            onClick={() => setShowDebug((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
            </svg>
          </ActionIcon>
        </Tooltip>
        {state.messages.length > 0 && !state.isStreaming && (
          <Tooltip label="Exportar conversa como Markdown" position="left" withArrow>
            <ActionIcon variant="subtle" size="xs" color="dimmed" onClick={handleExport} aria-label="Exportar conversa">
              <IconFileExport size={13} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      <Box
        ref={messagesScrollRef}
        flex={1}
        style={{ minHeight: 0, minWidth: 0, width: "100%", overflowX: "hidden", overflowY: "auto", paddingBlock: 8 }}
      >
        <Stack gap="md" px={4} style={{ minHeight: "min-content" }}>
          <MessageList messages={state.messages} toolRows={state.toolRows} isStreaming={state.isStreaming} />
        </Stack>
      </Box>

      <WorkersPanel toolRows={state.toolRows} />
      <PipelineDAGView toolRows={state.toolRows} pipeline={state.pipeline} />

      {state.toolRows.length > 0 && !state.isStreaming && (
        <Box px={4} pb={2}>
          <AgentTrace toolRows={state.toolRows} />
        </Box>
      )}

      {showDebug ? <DebugPanel log={debugLog} state={state} onClear={clearLog} /> : null}

      <Stack gap="sm" style={{ flexShrink: 0, minWidth: 0 }}>
        {firstPending ? (
          <Box px={4}>
            <PermissionDock
              toolCall={firstPending}
              onApprove={handleApprove}
              onReject={handleReject}
              onApproveSession={handleApproveSession}
              onApprovePersist={handleApprovePersist}
              remainingCount={state.pendingConfirms.length - 1}
            />
          </Box>
        ) : null}

        {(state.activePlan !== null || state.isPlanGenerating) ? (
          <Box px={4}>
            <PlannerPanel
              plan={state.activePlan}
              isGenerating={state.isPlanGenerating}
              onApprove={handlePlanApprove}
              onReview={handlePlanReview}
              onRegen={handlePlanRegen}
            />
          </Box>
        ) : null}

        {state.planMode ? (
          <Box px={4}>
            <PlanModePanel
              content={state.planContent}
              filePath={state.planFilePath}
              onOpenFile={() => { if (state.planFilePath) bridge.send({ type: "file:open", path: state.planFilePath }); }}
              onApprove={() => handleSend("O plano está aprovado. Pode implementar.", "agent")}
            />
          </Box>
        ) : null}

        {state.activity ? (
          <Paper
            p="sm"
            radius="md"
            withBorder
            style={{
              backgroundColor: state.activityTone === "error" ? cappyPalette.redBg : undefined,
              borderColor: state.activityTone === "error" ? "#4b2323" : undefined,
            }}
          >
            <Group gap="sm" align="flex-start" wrap="wrap">
              <Text size="xs" tt="uppercase" lts={0.5} c="dimmed" style={{ flexShrink: 0 }}>Cappy</Text>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" style={{ wordBreak: "break-word" }}>{state.activity.primary}</Text>
                {state.activity.secondary ? (
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-word" }}>{state.activity.secondary}</Text>
                ) : null}
              </Stack>
              <Group gap="xs" ml="auto" wrap="nowrap" align="center">
                {state.activity.repeats > 1 ? (
                  <Text size="xs" c="dimmed" px={6} py={2}
                    style={{ border: `1px solid ${cappyPalette.borderSurface}`, borderRadius: 999 }}>
                    x{state.activity.repeats}
                  </Text>
                ) : null}
                {typeof elapsedSeconds === "number" ? <Text size="xs" c="dimmed">{elapsedSeconds}s</Text> : null}
                {state.activityTone === "working" ? <Loader size="xs" type="dots" color="ideAccent" aria-hidden /> : null}
              </Group>
            </Group>
          </Paper>
        ) : null}

        {state.errorMessage ? <Text size="sm" c="red.4" px={4}>{state.errorMessage}</Text> : null}

        <Box pt="sm" style={{ borderTop: `1px solid ${cappyPalette.borderSubtle}` }}>
          <InputBar
            key={state.draftSessionKey}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={state.isStreaming}
            contextFiles={state.contextFiles}
            onAddContextFile={handleAddContextFile}
            onRemoveContextFile={handleRemoveContextFile}
            contextUsage={state.contextUsage}
            selectedModel={state.runtimeConfig?.openrouter.model ?? "openai/gpt-oss-120b"}
            modelOptions={availableModels}
            onModelChange={handleModelChange}
            configReady={state.runtimeConfig !== null}
            pipelineTemplates={state.pipelineTemplates}
            onPipelineSend={handlePipelineSend}
          />
        </Box>
      </Stack>
    </Stack>
  );
}
