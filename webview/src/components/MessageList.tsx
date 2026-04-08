import type { Message } from "../lib/types";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps): JSX.Element {
  const lastAssistantMessageIndex = findLastAssistantMessageIndex(messages);

  return (
    <div className={styles.container} aria-live="polite">
      {messages.length === 0 ? <div className={styles.empty}>Nenhuma mensagem ainda.</div> : null}
      {messages.map((message, index) => {
        const role = message.role === "user" ? "user" : "assistant";
        const roleLabel = role === "user" ? "USER" : message.role === "tool" ? "TOOL" : "ASSISTANT";
        return (
          <article
            key={`${message.role}-${index}-${message.content.length}`}
            className={`${styles.row} ${role === "user" ? styles.rowUser : styles.rowAssistant}`}
          >
            <span className={styles.label}>{roleLabel}</span>
            <div className={`${styles.bubble} ${role === "user" ? styles.bubbleUser : styles.bubbleAssistant}`}>
              <span className={styles.content}>{message.content}</span>
              {isStreaming && role === "assistant" && index === lastAssistantMessageIndex ? (
                <span className={styles.cursor} aria-hidden="true" />
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function findLastAssistantMessageIndex(messages: Message[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return index;
    }
  }
  return -1;
}
