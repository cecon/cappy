import type { Message } from "../lib/types";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

/**
 * Renders chat history.
 */
export function MessageList({ messages, isStreaming }: MessageListProps): JSX.Element {
  const lastMessageIndex = messages.length - 1;

  return (
    <div className={styles.container}>
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`} className={styles.message}>
          <strong>{message.role}:</strong> {message.content}
          {isStreaming && message.role === "assistant" && index === lastMessageIndex ? (
            <span className={styles.cursor} aria-hidden>
              |
            </span>
          ) : null}
        </div>
      ))}
      {messages.length === 0 ? <div>Nenhuma mensagem ainda.</div> : null}
    </div>
  );
}
