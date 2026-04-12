import { Box, Group, Loader, Paper, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CAPPY_NEW_SESSION_EVENT } from "../lib/session-events";
import type { ChatUiMode, ImageAttachment, Message } from "../lib/types";
import { getBridge } from "../lib/vscode-bridge";
import { isTerminalHitlPresentation } from "../domain/services/HitlService";
import { useChatReducer } from "../hooks/useChatReducer";
import { useBridgeMessages } from "../hooks/useBridgeMessages";
import { useModelOptions } from "../hooks/useModelOptions";
import { ChatTerminal } from "./ChatTerminal";
import { HitlCard } from "./HitlCard";
import { InputBar, type ContextFile } from "./InputBar";
import { MessageList } from "./MessageList";
import { cappyPalette } from "../theme";

const bridge = getBridge();
const SHOW_CHAT_TERMINAL_IDLE_PREVIEW = false;

function isExtensionHost(): boolean {
  return typeof window.acquireVsCodeApi === "function";
}

/**
 * Chat container: manages history, stream state and pending HITL confirmations.
 * State lives in useChatReducer; bridge subscription lives in useBridgeMessages.
 */
export function Chat(): JSX.Element {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useChatReducer();
  /** Local tick used only to re-compute elapsed seconds on the activity badge. */
  const [activityTick, setActivityTick] = useState(0);

  useBridgeMessages(dispatch, state.hitlPolicy);
  const availableModels = useModelOptions(state.runtimeConfig?.openrouter.model);

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
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.messages, state.isStreaming, state.pendingConfirms.length, state.activity?.primary, state.agentShellLog]);

  const elapsedSeconds = useMemo(() => {
    if (!state.activity) return null;
    return Math.max(0, Math.floor((Date.now() - state.activity.startedAtMs) / 1000));
  }, [state.activity, activityTick]);

  const pendingTerminalHitl = useMemo(
    () => state.pendingConfirms.filter(isTerminalHitlPresentation),
    [state.pendingConfirms],
  );
  const pendingGenericHitl = useMemo(
    () => state.pendingConfirms.filter((tc) => !isTerminalHitlPresentation(tc)),
    [state.pendingConfirms],
  );
  const hitlForGenericCards = useMemo(
    () => (isExtensionHost() ? pendingGenericHitl : state.pendingConfirms),
    [state.pendingConfirms, pendingGenericHitl],
  );

  function handleSend(text: string, mode: ChatUiMode, images?: ImageAttachment[]): void {
    const userMsg: Message = { role: "user", content: text };
    if (images && images.length > 0) userMsg.images = images;
    const newMessages = [...state.messages, userMsg];
    dispatch({ type: "SEND_START", messages: newMessages, mode });
    bridge.send({ type: "chat:send", messages: newMessages, mode });
    setActivityTick(0);
  }

  function handleStop(): void {
    bridge.send({ type: "chat:stop" });
    dispatch({ type: "STOP" });
  }

  const handleApprove = (id: string) => bridge.send({ type: "tool:approve", toolCallId: id });
  const handleReject = (id: string) => bridge.send({ type: "tool:reject", toolCallId: id });
  const handleApproveSession = (id: string) => bridge.send({ type: "hitl:approveSession", toolCallId: id });
  const handleApprovePersist = (id: string) => bridge.send({ type: "hitl:approvePersist", toolCallId: id });

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

  return (
    <Stack
      gap={0}
      h="100%"
      style={{ minHeight: 0, minWidth: "var(--cappy-chat-min-width, 400px)", width: "100%", boxSizing: "border-box" }}
      justify="space-between"
    >
      <Box
        ref={messagesScrollRef}
        flex={1}
        style={{ minHeight: 0, minWidth: 0, width: "100%", overflowX: "hidden", overflowY: "auto", paddingBlock: 8 }}
      >
        <Stack gap="md" px={4} style={{ minHeight: "min-content" }}>
          <MessageList messages={state.messages} isStreaming={state.isStreaming} />
          {isExtensionHost() && (state.agentShellLog.trim().length > 0 || pendingTerminalHitl.length > 0) ? (
            <ChatTerminal
              chatSessionKey={state.draftSessionKey}
              log={state.agentShellLog}
              pendingConfirms={pendingTerminalHitl}
              showIdleSample={SHOW_CHAT_TERMINAL_IDLE_PREVIEW}
              onApprove={handleApprove}
              onApproveSession={handleApproveSession}
              onApprovePersist={handleApprovePersist}
              onReject={handleReject}
            />
          ) : null}
        </Stack>
      </Box>

      <Stack gap="sm" style={{ flexShrink: 0, minWidth: 0 }}>
        {hitlForGenericCards.length > 0 ? (
          <Stack gap="xs" px={4}>
            {hitlForGenericCards.map((toolCall) => (
              <HitlCard
                key={toolCall.id}
                toolCall={toolCall}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </Stack>
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
                  <Text size="xs" c="dimmed" px={6} py={2} style={{ border: `1px solid ${cappyPalette.borderSurface}`, borderRadius: 999 }}>
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

        {state.errorMessage ? (
          <Text size="sm" c="red.4" px={4}>{state.errorMessage}</Text>
        ) : null}

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
