import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type { ActiveAgent, Message, ToolCall } from "../lib/types";
import { InputBar } from "./InputBar";
import { MessageList } from "./MessageList";
import { ToolConfirmCard } from "./ToolConfirmCard";
import styles from "./Chat.module.css";

const bridge = getBridge();
const AGENT_BADGE_MAP: Record<ActiveAgent, { label: string; icon: string; color: string; background: string }> = {
  coder: { label: "Coder", icon: "●", color: "#1f6feb", background: "#e8f0fe" },
  planner: { label: "Planner", icon: "◆", color: "#9a6700", background: "#fff8c5" },
  reviewer: { label: "Reviewer", icon: "■", color: "#1a7f37", background: "#dafbe1" },
};

/**
 * Chat container that manages history, stream state and pending HITL confirmations.
 */
export function Chat(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingConfirms, setPendingConfirms] = useState<ToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<ActiveAgent>("coder");

  useEffect(() => {
    bridge.onMessage((message: IncomingMessage) => {
      if (message.type === "config:loaded") {
        setActiveAgent(message.config.agent.activeAgent);
        return;
      }
      handleIncomingMessage(message, setMessages, setPendingConfirms, setIsStreaming, setErrorMessage);
    });
    bridge.send({ type: "config:load" });
  }, []);

  /**
   * Appends the user message and triggers one chat run.
   */
  function handleSend(text: string): void {
    setErrorMessage(null);
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

  const activeBadge = AGENT_BADGE_MAP[activeAgent];

  return (
    <section className={styles.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Chat</h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            borderRadius: "999px",
            padding: "4px 10px",
            fontSize: "12px",
            fontWeight: 600,
            color: activeBadge.color,
            backgroundColor: activeBadge.background,
          }}
        >
          <span aria-hidden="true">{activeBadge.icon}</span>
          {activeBadge.label}
        </span>
      </div>
      <MessageList messages={messages} isStreaming={isStreaming} />
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
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      <div className={styles.inputBar}>
        <InputBar onSend={handleSend} isStreaming={isStreaming} />
      </div>
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
): void {
  if (message.type === "stream:token") {
    setIsStreaming(true);
    setMessages((previousMessages) => appendAssistantToken(previousMessages, message.token));
    return;
  }

  if (message.type === "stream:done") {
    setIsStreaming(false);
    return;
  }

  if (message.type === "tool:confirm") {
    setPendingConfirms((previousConfirms) => {
      if (previousConfirms.some((toolCall) => toolCall.id === message.toolCall.id)) {
        return previousConfirms;
      }
      return [...previousConfirms, message.toolCall];
    });
    return;
  }

  if (message.type === "tool:result" || message.type === "tool:rejected") {
    setPendingConfirms((previousConfirms) =>
      previousConfirms.filter((toolCall) => toolCall.id !== message.toolCall.id),
    );
    return;
  }

  if (message.type === "error") {
    setIsStreaming(false);
    setErrorMessage(message.message);
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
