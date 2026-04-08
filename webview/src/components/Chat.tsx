import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type { Message, ToolCall } from "../lib/types";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingConfirms, setPendingConfirms] = useState<ToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const [activityTone, setActivityTone] = useState<ActivityTone>("working");
  const [activityTick, setActivityTick] = useState(0);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);

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
  function handleSend(text: string): void {
    setErrorMessage(null);
    setActivityTone("working");
    setActivityTick(0);
    setActivity(createActivity("Pensando", "Analisando contexto"));
    setIsStreaming(true);
    setMessages((previousMessages) => {
      const nextMessages: Message[] = [...previousMessages, { role: "user", content: text }];
      bridge.send({ type: "chat:send", messages: nextMessages });
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
      <div className={styles.messages}>
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
    setPendingConfirms((previousConfirms) =>
      previousConfirms.filter((toolCall) => toolCall.id !== message.toolCall.id),
    );
    return;
  }

  if (message.type === "error") {
    setIsStreaming(false);
    setErrorMessage(message.message);
    setActivityTone("error");
    setActivity(createActivity("Erro durante execucao", message.message));
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
