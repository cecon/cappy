import { Box, Group, Loader, Paper, Stack, Text } from "@mantine/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import { getBridge, type HitlUiPolicy, type IncomingMessage } from "../lib/vscode-bridge";
import { isTerminalHitlPresentation } from "../lib/hitlPresentation";
import { CAPPY_NEW_SESSION_EVENT } from "../lib/session-events";
import type {
  ChatUiMode,
  ContextUsageSnapshot,
  FileDiffPayload,
  ImageAttachment,
  Message,
  ToolCall,
} from "../lib/types";
import { ChatTerminal } from "./ChatTerminal";
import { HitlCard } from "./HitlCard";
import { InputBar, type ContextFile } from "./InputBar";
import { MessageList } from "./MessageList";
import { cappyPalette } from "../theme";

const bridge = getBridge();

/** Painel integrado estilo terminal: só na extensão VS Code; no `pnpm dev` (browser) fica oculto. */
function isExtensionHost(): boolean {
  return typeof window.acquireVsCodeApi === "function";
}

/**
 * Mostra o texto longo de exemplo no terminal quando não há log nem HITL (útil para testar scroll/layout).
 * O painel do terminal está sempre visível no chat; com `false` vê-se só a linha `# Aguardando saída…`.
 */
const SHOW_CHAT_TERMINAL_IDLE_PREVIEW = false;

type ActivityTone = "working" | "error";

interface ActivityState {
  primary: string;
  secondary: string | null;
  signature: string;
  repeats: number;
  startedAtMs: number;
}

/**
 * Chat container that manages history, stream state and pending HITL confirmations.
 */
export function Chat(): JSX.Element {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingConfirms, setPendingConfirms] = useState<ToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const [activityTone, setActivityTone] = useState<ActivityTone>("working");
  const [activityTick, setActivityTick] = useState(0);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [contextUsage, setContextUsage] = useState<ContextUsageSnapshot | null>(null);
  /** Incrementado em nova sessão para remontar o `InputBar` (limpa rascunho, anexos locais, modo). */
  const [draftSessionKey, setDraftSessionKey] = useState(0);
  /** Eco textual do mesmo `exec` usado pelas tools Bash/runTerminal (painel terminal). */
  const [agentShellLog, setAgentShellLog] = useState("");
  /** Política HITL do host: a UI auto-envia `tool:approve` quando `allow_all` ou sessão «aprovar todos». */
  const hitlPolicyRef = useRef<HitlUiPolicy>({
    destructiveTools: "confirm_each",
    sessionAutoApproveDestructive: false,
  });

  const autoApproveHitl = useCallback((toolCallId: string) => {
    bridge.send({ type: "tool:approve", toolCallId });
  }, []);

  useEffect(() => {
    const unsubscribe = bridge.onMessage((message: IncomingMessage) => {
      handleIncomingMessage(
        message,
        setMessages,
        setPendingConfirms,
        setIsStreaming,
        setErrorMessage,
        setActivity,
        setActivityTone,
        setContextUsage,
        setContextFiles,
        setAgentShellLog,
        hitlPolicyRef,
        autoApproveHitl,
      );
    });
    return unsubscribe;
  }, [autoApproveHitl]);

  useEffect(() => {
    const onNewSession = (): void => {
      setMessages([]);
      setPendingConfirms([]);
      setIsStreaming(false);
      setErrorMessage(null);
      setActivity(null);
      setActivityTone("working");
      setContextUsage(null);
      setContextFiles([]);
      setAgentShellLog("");
      hitlPolicyRef.current = {
        destructiveTools: "confirm_each",
        sessionAutoApproveDestructive: false,
      };
      setDraftSessionKey((k) => k + 1);
    };
    window.addEventListener(CAPPY_NEW_SESSION_EVENT, onNewSession);
    return () => window.removeEventListener(CAPPY_NEW_SESSION_EVENT, onNewSession);
  }, []);

  useEffect(() => {
    if (!activity || activityTone !== "working") {
      return;
    }
    const intervalId = window.setInterval(() => {
      setActivityTick((currentTick) => currentTick + 1);
    }, 1200);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [activity, activityTone]);

  /** Mantém o scroll colado ao fundo quando chegam mensagens ou tokens em stream. */
  useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming, pendingConfirms.length, activity?.primary, agentShellLog]);

  const activityDetail = useMemo(() => {
    if (!activity) {
      return null;
    }
    return activity.secondary;
  }, [activity]);

  const elapsedSeconds = useMemo(() => {
    if (!activity) {
      return null;
    }
    return Math.max(0, Math.floor((Date.now() - activity.startedAtMs) / 1000));
  }, [activity, activityTick]);

  /** Shell / Bash / runTerminal: HITL no painel Terminal; resto: caixa genérica. */
  const pendingTerminalHitl = useMemo(
    () => pendingConfirms.filter(isTerminalHitlPresentation),
    [pendingConfirms],
  );
  const pendingGenericHitl = useMemo(
    () => pendingConfirms.filter((toolCall) => !isTerminalHitlPresentation(toolCall)),
    [pendingConfirms],
  );

  /** No browser, HITL de shell não tem painel terminal — usa os cartões genéricos. */
  const hitlForGenericCards = useMemo(
    () => (isExtensionHost() ? pendingGenericHitl : pendingConfirms),
    [pendingConfirms, pendingGenericHitl],
  );

  /**
   * Appends the user message and triggers one chat run.
   */
  function handleSend(text: string, mode: ChatUiMode, images?: ImageAttachment[]): void {
    setErrorMessage(null);
    setActivityTone("working");
    setActivityTick(0);
    setActivity(createActivity("Pensando", "Analisando contexto"));
    setIsStreaming(true);
    setMessages((previousMessages) => {
      const userMessage: Message = { role: "user", content: text };
      if (images && images.length > 0) {
        userMessage.images = images;
      }
      const nextMessages: Message[] = [...previousMessages, userMessage];
      bridge.send({ type: "chat:send", messages: nextMessages, mode });
      return nextMessages;
    });
  }

  /**
   * Approves one pending tool execution by id.
   */
  function handleApprove(toolCallId: string): void {
    bridge.send({ type: "tool:approve", toolCallId });
  }

  /**
   * Stops the current agent run.
   */
  function handleStop(): void {
    bridge.send({ type: "chat:stop" });
    setIsStreaming(false);
    setActivity(null);
  }

  /**
   * Rejects one pending tool execution by id.
   */
  function handleReject(toolCallId: string): void {
    bridge.send({ type: "tool:reject", toolCallId });
  }

  /**
   * Aprova o pedido actual e activa auto-aprovação destrutiva até ao fim da sessão do agente.
   */
  function handleApproveSession(toolCallId: string): void {
    bridge.send({ type: "hitl:approveSession", toolCallId });
  }

  /**
   * Aprova e grava `allow_all` em `.cappy/agent-preferences.json` no workspace.
   */
  function handleApprovePersist(toolCallId: string): void {
    bridge.send({ type: "hitl:approvePersist", toolCallId });
  }

  /**
   * Adds one context file if it is not already selected.
   */
  function handleAddContextFile(file: ContextFile): void {
    setContextFiles((previousFiles) => {
      if (previousFiles.some((currentFile) => currentFile.path === file.path)) {
        return previousFiles;
      }
      return [...previousFiles, file];
    });
  }

  /**
   * Removes one selected context file.
   */
  function handleRemoveContextFile(path: string): void {
    setContextFiles((previousFiles) => previousFiles.filter((file) => file.path !== path));
  }

  return (
    <Stack gap={0} h="100%" style={{ minHeight: 0, minWidth: 0 }} justify="space-between">
      <Box
        ref={messagesScrollRef}
        flex={1}
        style={{
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          overflowX: "hidden",
          overflowY: "auto",
          paddingBlock: 8,
        }}
      >
        <Stack gap="md" px={4} style={{ minHeight: "min-content" }}>
          <MessageList messages={messages} isStreaming={isStreaming} />
          {isExtensionHost() && (agentShellLog.trim().length > 0 || pendingTerminalHitl.length > 0) ? (
            <ChatTerminal
              chatSessionKey={draftSessionKey}
              log={agentShellLog}
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

        {activity ? (
          <Paper
            p="sm"
            radius="md"
            withBorder
            style={{
              backgroundColor: activityTone === "error" ? cappyPalette.redBg : undefined,
              borderColor: activityTone === "error" ? "#4b2323" : undefined,
            }}
          >
            <Group gap="sm" align="flex-start" wrap="wrap">
              <Text size="xs" tt="uppercase" lts={0.5} c="dimmed" style={{ flexShrink: 0 }}>
                Cappy
              </Text>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" style={{ wordBreak: "break-word" }}>
                  {activity.primary}
                </Text>
                {activityDetail ? (
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-word" }}>
                    {activityDetail}
                  </Text>
                ) : null}
              </Stack>
              <Group gap="xs" ml="auto" wrap="nowrap" align="center">
                {activity.repeats > 1 ? (
                  <Text size="xs" c="dimmed" px={6} py={2} style={{ border: `1px solid ${cappyPalette.borderSurface}`, borderRadius: 999 }}>
                    x{activity.repeats}
                  </Text>
                ) : null}
                {typeof elapsedSeconds === "number" ? (
                  <Text size="xs" c="dimmed">
                    {elapsedSeconds}s
                  </Text>
                ) : null}
                {activityTone === "working" ? (
                  <Loader size="xs" type="dots" color="ideAccent" aria-hidden />
                ) : null}
              </Group>
            </Group>
          </Paper>
        ) : null}

        {errorMessage ? (
          <Text size="sm" c="red.4" px={4}>
            {errorMessage}
          </Text>
        ) : null}

        <Box pt="sm" style={{ borderTop: `1px solid ${cappyPalette.borderSubtle}` }}>
          <InputBar
            key={draftSessionKey}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            contextFiles={contextFiles}
            onAddContextFile={handleAddContextFile}
            onRemoveContextFile={handleRemoveContextFile}
            contextUsage={contextUsage}
          />
        </Box>
      </Stack>
    </Stack>
  );
}

/**
 * Formata o início de uma execução shell espelhada (mesmo comando que o agente corre).
 */
function formatAgentShellStart(message: { command: string; cwd?: string }): string {
  const cwdLine = message.cwd ? `# cwd: ${message.cwd}\n` : "";
  return `${cwdLine}$ ${message.command}\n`;
}

/**
 * Formata stdout/stderr devolvidos pelo mesmo `exec` da tool.
 */
function formatAgentShellComplete(message: {
  stdout: string;
  stderr: string;
  errorText?: string;
}): string {
  if (message.errorText !== undefined && message.errorText.length > 0) {
    return `${message.errorText}\n`;
  }
  let block = "";
  if (message.stdout.length > 0) {
    block += message.stdout.endsWith("\n") ? message.stdout : `${message.stdout}\n`;
  }
  if (message.stderr.length > 0) {
    block += "\n# stderr\n";
    block += message.stderr.endsWith("\n") ? message.stderr : `${message.stderr}\n`;
  }
  return block;
}

/**
 * Routes one inbound bridge message to local chat state updates.
 */
function handleIncomingMessage(
  message: IncomingMessage,
  setMessages: Dispatch<SetStateAction<Message[]>>,
  setPendingConfirms: Dispatch<SetStateAction<ToolCall[]>>,
  setIsStreaming: Dispatch<SetStateAction<boolean>>,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
  setActivity: Dispatch<SetStateAction<ActivityState | null>>,
  setActivityTone: Dispatch<SetStateAction<ActivityTone>>,
  setContextUsage: Dispatch<SetStateAction<ContextUsageSnapshot | null>>,
  setContextFiles: Dispatch<SetStateAction<ContextFile[]>>,
  setAgentShellLog: Dispatch<SetStateAction<string>>,
  hitlPolicyRef: MutableRefObject<HitlUiPolicy>,
  autoApproveHitl: (toolCallId: string) => void,
): void {
  if (message.type === "session:cleared") {
    setMessages([]);
    setPendingConfirms([]);
    setIsStreaming(false);
    setErrorMessage(null);
    setActivity(null);
    setActivityTone("working");
    setContextUsage(null);
    setContextFiles([]);
    setAgentShellLog("");
    hitlPolicyRef.current = {
      destructiveTools: "confirm_each",
      sessionAutoApproveDestructive: false,
    };
    return;
  }

  if (message.type === "hitl:policy") {
    hitlPolicyRef.current = {
      destructiveTools: message.destructiveTools,
      sessionAutoApproveDestructive: message.sessionAutoApproveDestructive,
    };
    return;
  }

  if (message.type === "agent:shell:start") {
    setAgentShellLog((previous) => `${previous}${formatAgentShellStart(message)}`);
    return;
  }

  if (message.type === "agent:shell:complete") {
    setAgentShellLog((previous) => `${previous}${formatAgentShellComplete(message)}`);
    return;
  }

  if (message.type === "stream:token") {
    setIsStreaming(true);
    setActivityTone("working");
    setActivity((previousActivity) => mergeActivity(previousActivity, createActivity("Escrevendo resposta", null)));
    setMessages((previousMessages) => appendAssistantToken(previousMessages, message.token));
    return;
  }

  if (message.type === "stream:done") {
    setIsStreaming(false);
    setActivity(null);
    return;
  }

  if (message.type === "tool:confirm") {
    const policy = hitlPolicyRef.current;
    if (policy.destructiveTools === "allow_all" || policy.sessionAutoApproveDestructive) {
      autoApproveHitl(message.toolCall.id);
      return;
    }

    /**
     * Banner «CAPPY» + cartões Terminal / `ToolConfirmCard` diziam o mesmo (mock mostrava 2 blocos).
     * Mantém-se só o painel adequado; opcionalmente uma linha no histórico quando não há Terminal dedicado.
     */
    const shellHitlInExtension =
      typeof window.acquireVsCodeApi === "function" && isTerminalHitlPresentation(message.toolCall);
    if (!shellHitlInExtension) {
      setMessages((previousMessages) =>
        appendToolLogMessage(
          previousMessages,
          `Aguardando aprovacao para executar \`${message.toolCall.name}\``,
          getToolLogDetail(message.toolCall),
        ),
      );
    }
    setPendingConfirms((previousConfirms) => {
      if (previousConfirms.some((toolCall) => toolCall.id === message.toolCall.id)) {
        return previousConfirms;
      }
      return [...previousConfirms, message.toolCall];
    });
    return;
  }

  if (message.type === "tool:executing") {
    setActivityTone("working");
    setActivity((previousActivity) => mergeActivity(previousActivity, buildToolActivity(message.toolCall)));
    setMessages((previousMessages) =>
      appendToolLogMessage(
        previousMessages,
        `Executando tool \`${message.toolCall.name}\``,
        getToolLogDetail(message.toolCall),
      ),
    );
    return;
  }

  if (message.type === "tool:result" || message.type === "tool:rejected") {
    setActivityTone("working");
    setActivity((previousActivity) =>
      mergeActivity(
        previousActivity,
        createActivity(
          message.type === "tool:result" ? "Processando resultado da tool" : "Tool rejeitada, ajustando plano",
          "Atualizando contexto da conversa",
        ),
      ),
    );
    setMessages((previousMessages) =>
      appendToolLogMessage(
        previousMessages,
        message.type === "tool:result"
          ? `Resultado recebido de \`${message.toolCall.name}\``
          : `Execucao de \`${message.toolCall.name}\` foi rejeitada`,
        message.type === "tool:result" ? summarizeToolResult(message.result) : "Aguardando nova estrategia do agente",
        message.type === "tool:result" ? message.fileDiff : undefined,
      ),
    );
    setPendingConfirms((previousConfirms) =>
      previousConfirms.filter((toolCall) => toolCall.id !== message.toolCall.id),
    );
    return;
  }

  if (message.type === "context:usage") {
    setContextUsage({
      usedTokens: message.usedTokens,
      limitTokens: message.limitTokens,
      effectiveInputBudgetTokens: message.effectiveInputBudgetTokens,
      didTrimForApi: message.didTrimForApi,
      droppedMessageCount: message.droppedMessageCount,
    });
    return;
  }

  if (message.type === "error") {
    setIsStreaming(false);
    setErrorMessage(message.message);
    setActivityTone("error");
    setActivity(createActivity("Erro durante execucao", message.message));
    return;
  }
}

/**
 * Appends streamed assistant text into the latest assistant message.
 */
function appendAssistantToken(previousMessages: Message[], token: string): Message[] {
  if (token.length === 0) {
    return previousMessages;
  }

  const lastMessage = previousMessages[previousMessages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") {
    return [...previousMessages, { role: "assistant", content: token }];
  }

  const updatedLastMessage: Message = {
    ...lastMessage,
    content: `${lastMessage.content}${token}`,
  };
  return [...previousMessages.slice(0, -1), updatedLastMessage];
}

/**
 * Maps tool metadata into user-friendly activity copy.
 */
function buildToolActivity(toolCall: ToolCall): ActivityState {
  const toolName = toolCall.name.toLowerCase();
  const targetPath = getPathArgument(toolCall.arguments);
  const command = getStringArgument(toolCall.arguments, ["command"]);
  const query = getStringArgument(toolCall.arguments, ["query"]);

  if (toolName.includes("read")) {
    return createActivity(targetPath ? `Lendo ${targetPath}` : "Lendo arquivos", targetPath ?? "Abrindo arquivo solicitado");
  }
  if (toolName.includes("search") || toolName.includes("rg") || toolName.includes("grep")) {
    const searchDetail = query
      ? `Filtro: ${truncate(query, 80)}`
      : targetPath
        ? `Escopo: ${targetPath}`
        : "Escopo: projeto inteiro";
    return createActivity("Procurando no codigo", searchDetail);
  }
  if (toolName.includes("list") || toolName.includes("dir")) {
    return createActivity(
      targetPath ? `Explorando ${targetPath}` : "Explorando estrutura do projeto",
      targetPath ? `Diretorio: ${targetPath}` : "Listando diretorios e arquivos",
    );
  }
  if (toolName.includes("write") || toolName.includes("edit")) {
    return createActivity(
      targetPath ? `Editando ${targetPath}` : "Aplicando alteracoes",
      targetPath ? `Arquivo alvo: ${targetPath}` : "Atualizando conteudo",
    );
  }
  if (toolName.includes("run") || toolName.includes("terminal") || toolName.includes("shell")) {
    return createActivity(
      "Executando comando no terminal",
      command ? `Comando: ${truncate(command, 88)}` : targetPath ? `Diretorio: ${targetPath}` : "Diretorio atual",
    );
  }
  return createActivity(
    `Trabalhando com ${toolCall.name}`,
    targetPath ? `Alvo: ${targetPath}` : "Processando requisicao",
  );
}

/**
 * Extracts likely path argument from a tool payload.
 */
function getPathArgument(argumentsValue: Record<string, unknown>): string | null {
  const possibleKeys = ["path", "targetPath", "filePath", "working_directory", "cwd"];
  for (const key of possibleKeys) {
    const value = argumentsValue[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

/**
 * Returns the first non-empty string from candidate keys.
 */
function getStringArgument(argumentsValue: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = argumentsValue[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

/**
 * Truncates long labels for compact status lines.
 */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}...`;
}

/**
 * Creates one activity state payload.
 */
function createActivity(primary: string, secondary: string | null): ActivityState {
  const signature = `${primary}::${secondary ?? ""}`;
  return {
    primary,
    secondary,
    signature,
    repeats: 1,
    startedAtMs: Date.now(),
  };
}

/**
 * Merges repeated activity updates without looking like infinite loop.
 */
function mergeActivity(previous: ActivityState | null, next: ActivityState): ActivityState {
  if (!previous || previous.signature !== next.signature) {
    return next;
  }
  return {
    ...previous,
    repeats: previous.repeats + 1,
  };
}

/**
 * Appends one compact tool event message to the chat history.
 */
function appendToolLogMessage(
  previousMessages: Message[],
  title: string,
  detail: string | null,
  fileDiff?: FileDiffPayload,
): Message[] {
  const content = detail ? `${title}\n${detail}` : title;
  const lastMessage = previousMessages[previousMessages.length - 1];
  if (lastMessage?.role === "tool" && lastMessage.content === content && !fileDiff) {
    return previousMessages;
  }
  return [...previousMessages, { role: "tool", content, ...(fileDiff ? { fileDiff } : {}) }];
}

/**
 * Builds one human-readable tool detail line.
 */
function getToolLogDetail(toolCall: ToolCall): string | null {
  const targetPath = getPathArgument(toolCall.arguments);
  const query = getStringArgument(toolCall.arguments, ["query", "pattern"]);
  const command = getStringArgument(toolCall.arguments, ["command"]);
  if (query) {
    return `Filtro: ${truncate(query, 120)}`;
  }
  if (command) {
    return `Comando: ${truncate(command, 120)}`;
  }
  if (targetPath) {
    return `Alvo: ${truncate(targetPath, 120)}`;
  }
  return null;
}

/**
 * Summarizes raw tool payload for timeline display.
 */
function summarizeToolResult(result: string): string {
  const normalized = result.trim();
  if (normalized.length === 0) {
    return "Tool sem retorno textual";
  }
  return `Retorno: ${truncate(normalized.replace(/\s+/gu, " "), 140)}`;
}
