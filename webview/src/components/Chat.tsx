import { Box, Group, Loader, Paper, Stack, Text } from "@mantine/core";
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
import { StageProgressBar } from "./StageProgressBar";
import { WorkersPanel } from "./WorkersPanel";
import { PipelineDAGView } from "./PipelineDAGView";
import { cappyPalette } from "../theme";

const bridge = getBridge();

/**
 * Chat container: manages history, stream state and pending HITL confirmations.
 * Layout:
 *   ┌─ StageProgressBar (pipeline active) ───────┐
 *   ├─ scroll area (flex 1) ─────────────────────┤
 *   │  MessageList                               │
 *   ├─ WorkersPanel (workers active) ────────────┤
 *   ├─ PipelineDAGView (collapsible) ────────────┤
 *   ├─ PermissionDock (when pending) ────────────┤
 *   ├─ PlanModePanel (plan mode) ────────────────┤
 *   ├─ Pipeline launcher (idle, templates loaded) ┤
 *   ├─ activity bar ──────────────────────────────┤
 *   │  InputBar                                  │
 *   └─────────────────────────────────────────────┘
 */
export function Chat(): JSX.Element {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useChatReducer();
  const [activityTick, setActivityTick] = useState(0);

  useBridgeMessages(dispatch, state.hitlPolicy);
  const availableModels = useModelOptions(state.runtimeConfig?.openrouter.model);

  // Request pipeline templates once on mount
  useEffect(() => {
    bridge.send({ type: "pipeline:list" });
  }, []);

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

  // Auto-scroll when new content arrives.
  useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight;
    }
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
    if (state.pipeline) {
      bridge.send({ type: "pipeline:abort" });
    }
    bridge.send({ type: "chat:stop" });
    dispatch({ type: "STOP" });
  }

  function handlePipelineAdvance(): void {
    bridge.send({ type: "pipeline:advance" });
  }

  const handleApprove = useCallback((id: string) => bridge.send({ type: "tool:approve", toolCallId: id }), []);
  const handleReject = useCallback((id: string) => bridge.send({ type: "tool:reject", toolCallId: id }), []);
  const handleApproveSession = useCallback((id: string) => bridge.send({ type: "hitl:approveSession", toolCallId: id }), []);
  const handleApprovePersist = useCallback((id: string) => bridge.send({ type: "hitl:approvePersist", toolCallId: id }), []);

  const handleAddContextFile = useCallback(
    (file: ContextFile) => dispatch({ type: "ADD_CONTEXT_FILE", file }),
    [dispatch],
  );
  const handleRemoveContextFile = useCallback(
    (path: string) => dispatch({ type: "REMOVE_CONTEXT_FILE", path }),
    [dispatch],
  );
  const handleModelChange = useCallback(
    (modelId: string) => {
      if (!state.runtimeConfig) return;
      const updated = {
        ...state.runtimeConfig,
        openrouter: { ...state.runtimeConfig.openrouter, model: modelId },
      };
      dispatch({ type: "MODEL_CHANGE", modelId });
      bridge.send({ type: "config:save", config: updated });
    },
    [dispatch, state.runtimeConfig],
  );

  const firstPending = state.pendingConfirms[0] ?? null;

  const showPipelineLauncher =
    !state.isStreaming &&
    !state.pipeline &&
    state.pipelineTemplates.length > 0;

  return (
    <Stack
      gap={0}
      h="100%"
      style={{ minHeight: 0, minWidth: "var(--cappy-chat-min-width, 320px)", width: "100%", boxSizing: "border-box" }}
      justify="space-between"
    >
      {/* ── Stage progress bar (pipeline active) ── */}
      {state.pipeline ? (
        state.pipeline.awaitingApproval ? (
          <StageProgressBar pipeline={state.pipeline} onAdvance={handlePipelineAdvance} />
        ) : (
          <StageProgressBar pipeline={state.pipeline} />
        )
      ) : null}

      {/* ── Scroll area: message list ── */}
      <Box
        ref={messagesScrollRef}
        flex={1}
        style={{ minHeight: 0, minWidth: 0, width: "100%", overflowX: "hidden", overflowY: "auto", paddingBlock: 8 }}
      >
        <Stack gap="md" px={4} style={{ minHeight: "min-content" }}>
          <MessageList
            messages={state.messages}
            toolRows={state.toolRows}
            isStreaming={state.isStreaming}
          />
        </Stack>
      </Box>

      {/* ── Workers panel (parallel agents active) ── */}
      <WorkersPanel toolRows={state.toolRows} />

      {/* ── DAG view (collapsible, pipeline or workers) ── */}
      <PipelineDAGView toolRows={state.toolRows} pipeline={state.pipeline} />

      {/* ── Fixed bottom area ── */}
      <Stack gap="sm" style={{ flexShrink: 0, minWidth: 0 }}>
        {/* PermissionDock — unified approval for ALL tool types */}
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

        {/* Plan mode panel — shown above InputBar while agent is in plan mode */}
        {state.planMode ? (
          <Box px={4}>
            <PlanModePanel
              content={state.planContent}
              filePath={state.planFilePath}
              onOpenFile={() => {
                if (state.planFilePath) bridge.send({ type: "file:open", path: state.planFilePath });
              }}
              onApprove={() => handleSend("O plano está aprovado. Pode implementar.", "agent")}
            />
          </Box>
        ) : null}

        {/* Pipeline launcher — quick template buttons shown when idle */}
        {showPipelineLauncher ? (
          <PipelineLauncher
            templates={state.pipelineTemplates}
            onLaunch={handlePipelineSend}
          />
        ) : null}

        {/* Activity badge */}
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
              <Text size="xs" tt="uppercase" lts={0.5} c="dimmed" style={{ flexShrink: 0 }}>
                Cappy
              </Text>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" style={{ wordBreak: "break-word" }}>{state.activity.primary}</Text>
                {state.activity.secondary ? (
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-word" }}>
                    {state.activity.secondary}
                  </Text>
                ) : null}
              </Stack>
              <Group gap="xs" ml="auto" wrap="nowrap" align="center">
                {state.activity.repeats > 1 ? (
                  <Text
                    size="xs"
                    c="dimmed"
                    px={6}
                    py={2}
                    style={{ border: `1px solid ${cappyPalette.borderSurface}`, borderRadius: 999 }}
                  >
                    x{state.activity.repeats}
                  </Text>
                ) : null}
                {typeof elapsedSeconds === "number" ? (
                  <Text size="xs" c="dimmed">{elapsedSeconds}s</Text>
                ) : null}
                {state.activityTone === "working" ? (
                  <Loader size="xs" type="dots" color="ideAccent" aria-hidden />
                ) : null}
              </Group>
            </Group>
          </Paper>
        ) : null}

        {/* Error message */}
        {state.errorMessage ? (
          <Text size="sm" c="red.4" px={4}>{state.errorMessage}</Text>
        ) : null}

        {/* Input */}
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
          />
        </Box>
      </Stack>
    </Stack>
  );
}

// ── Pipeline launcher ─────────────────────────────────────────────────────────

interface PipelineLauncherProps {
  templates: Array<{ id: string; name: string; stageCount: number }>;
  onLaunch: (pipelineId: string, text: string) => void;
}

function PipelineLauncher({ templates, onLaunch }: PipelineLauncherProps): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");

  const selectedTemplate = templates.find((t) => t.id === selected);

  function handleConfirm(): void {
    if (!selected || !text.trim()) return;
    onLaunch(selected, text.trim());
    setSelected(null);
    setText("");
  }

  return (
    <Box
      px={8}
      py={6}
      style={{
        background: cappyPalette.bgSunken,
        borderTop: `1px solid ${cappyPalette.borderSubtle}`,
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase" lts={0.5} mb={6}>
        Pipeline
      </Text>

      {/* Template selector chips */}
      <Group gap={4} mb={selected ? 6 : 0}>
        {templates.map((t) => (
          <Box
            key={t.id}
            component="button"
            onClick={() => setSelected(selected === t.id ? null : t.id)}
            px={8}
            py={3}
            style={{
              background: selected === t.id ? `${cappyPalette.accentFill}22` : "transparent",
              border: `1px solid ${selected === t.id ? cappyPalette.accentFill : cappyPalette.borderSurface}`,
              borderRadius: 999,
              color: selected === t.id ? cappyPalette.textAccent : cappyPalette.textSecondary,
              fontSize: "0.7rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.name}
            <Text component="span" size="xs" c="dimmed" ml={4}>
              ({t.stageCount} stages)
            </Text>
          </Box>
        ))}
      </Group>

      {/* Input + launch when a template is selected */}
      {selectedTemplate ? (
        <Group gap={4} align="flex-end" mt={4}>
          <Box
            component="input"
            value={text}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleConfirm(); }
            }}
            placeholder={`Descreva a tarefa para "${selectedTemplate.name}"…`}
            style={{
              flex: 1,
              background: cappyPalette.bgBase,
              border: `1px solid ${cappyPalette.borderSurface}`,
              borderRadius: 6,
              color: cappyPalette.textPrimary,
              fontSize: "0.75rem",
              padding: "4px 8px",
              outline: "none",
            }}
          />
          <Box
            component="button"
            onClick={handleConfirm}
            disabled={!text.trim()}
            px={10}
            py={4}
            style={{
              background: text.trim() ? cappyPalette.accentFill : cappyPalette.bgSurface,
              border: "none",
              borderRadius: 6,
              color: text.trim() ? "#fff" : cappyPalette.textMuted,
              fontSize: "0.7rem",
              fontWeight: 600,
              cursor: text.trim() ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Iniciar
          </Box>
        </Group>
      ) : null}
    </Box>
  );
}
