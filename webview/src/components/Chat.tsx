import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type {
  ChatUiMode,
  ContextUsageSnapshot,
  FileDiffPayload,
  ImageAttachment,
  Message,
  ToolCall,
} from "../lib/types";
import { InputBar, type ContextFile } from "./InputBar";
import { MessageList } from "./MessageList";
import { ToolConfirmCard } from "./ToolConfirmCard";
import styles from "./Chat.module.css";

const bridge = getBridge();

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

  useEffect(() => {
    bridge.onMessage((message: IncomingMessage) => {
      handleIncomingMessage(
        message,
        setMessages,
        setPendingConfirms,
        setIsStreaming,
        setErrorMessage,
        setActivity,
        setActivityTone,
        setContextUsage,
      );
    });
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
  }, [messages, isStreaming, pendingConfirms.length, activity?.primary]);

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
   * Rejects one pending tool execution by id.
   */
  function handleReject(toolCallId: string): void {
    bridge.send({ type: "tool:reject", toolCallId });
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
    <section className={styles.container}>
      <div ref={messagesScrollRef} className={styles.messages}>
        <MessageList messages={messages} isStreaming={isStreaming} />
      </div>
      <div className={styles.confirmList}>
        {pendingConfirms.map((toolCall) => (
          <ToolConfirmCard
            key={toolCall.id}
            toolCall={toolCall}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}
      </div>
      {activity ? (
        <div className={`${styles.activity} ${activityTone === "error" ? styles.activityError : styles.activityWorking}`}>
          <span className={styles.activityLabel}>CAPPY</span>
          <div className={styles.activityBody}>
            <span className={styles.activityText}>{activity.primary}</span>
            {activityDetail ? <span className={styles.activityDetail}>{activityDetail}</span> : null}
          </div>
          {activity.repeats > 1 ? <span className={styles.activityRepeat}>x{activity.repeats}</span> : null}
          {typeof elapsedSeconds === "number" ? <span className={styles.activityTime}>{elapsedSeconds}s</span> : null}
          {activityTone === "working" ? (
            <span className={styles.activityDots} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : null}
        </div>
      ) : null}
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      <footer className={styles.inputArea}>
        <InputBar
          onSend={handleSend}
          isStreaming={isStreaming}
          contextFiles={contextFiles}
          onAddContextFile={handleAddContextFile}
          onRemoveContextFile={handleRemoveContextFile}
          contextUsage={contextUsage}
        />
      </footer>
    </section>
  );
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
): void {
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
    setActivityTone("working");
    setActivity(createActivity(`Aguardando aprovacao: ${message.toolCall.name}`, "Confirme para continuar"));
    setMessages((previousMessages) =>
      appendToolLogMessage(
        previousMessages,
        `Aguardando aprovacao para executar \`${message.toolCall.name}\``,
        getToolLogDetail(message.toolCall),
      ),
    );
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
