import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message } from "../lib/types";
import { mergeFileDiffsForDisplay } from "../lib/mergeFileDiffs";
import { FileDiffMini } from "./FileDiffMini";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps): JSX.Element {
  const lastAssistantMessageIndex = findLastAssistantMessageIndex(messages);
  const grouped = groupMessages(messages);

  return (
    <div className={styles.container} aria-live="polite">
      {messages.length === 0 ? <div className={styles.empty}>Nenhuma mensagem ainda.</div> : null}
      {grouped.map((group, gi) => {
        if (group.type === "user") {
          const hasImages = group.message.images && group.message.images.length > 0;
          return (
            <article key={`user-${gi}`} className={`${styles.row} ${styles.rowUser}`}>
              <span className={styles.label}>USER</span>
              <div className={`${styles.bubble} ${styles.bubbleUser}`}>
                {hasImages && (
                  <div className={styles.messageImages}>
                    {group.message.images!.map((img, i) => (
                      <img key={i} src={img.dataUrl} alt={`Anexo ${i + 1}`} className={styles.messageImage} />
                    ))}
                  </div>
                )}
                <span className={styles.content}>{group.message.content}</span>
              </div>
            </article>
          );
        }
        if (group.type === "tools") {
          return <ToolGroup key={`tools-${gi}`} messages={group.messages} />;
        }
        // assistant
        return (
          <article key={`assistant-${gi}`} className={`${styles.row} ${styles.rowAssistant}`}>
            <span className={styles.label}>ASSISTANT</span>
            <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
              <div className={styles.markdown}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{group.message.content}</ReactMarkdown>
              </div>
              {isStreaming && group.originalIndex === lastAssistantMessageIndex ? (
                <span className={styles.cursor} aria-hidden="true" />
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ToolGroup({ messages }: { messages: Message[] }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const summary = messages.length === 1
    ? truncateToolContent(messages[0]!.content, 80)
    : `${messages.length} tool calls`;
  const rawDiffs = messages.map((m) => m.fileDiff).filter((d): d is NonNullable<typeof d> => d !== undefined);
  const mergedDiffs = mergeFileDiffsForDisplay(rawDiffs);
  const uniqueFileCount = new Set(rawDiffs.map((d) => d.path)).size;

  return (
    <div className={styles.toolGroup}>
      {mergedDiffs.map((diff, i) => (
        <FileDiffMini key={`diff-${diff.path}-${i}`} diff={diff} />
      ))}
      <button
        className={styles.toolToggle}
        onClick={() => setExpanded((prev) => !prev)}
        type="button"
      >
        <span className={styles.toolIcon}>{expanded ? "▾" : "▸"}</span>
        <span className={styles.toolSummary}>{summary}</span>
      </button>
      {expanded && (
        <div className={styles.toolDetails}>
          {messages.map((msg, i) => (
            <pre key={i} className={styles.toolPre}>{msg.content}</pre>
          ))}
        </div>
      )}
      {uniqueFileCount > 0 ? (
        <p className={styles.toolExploreHint}>
          {uniqueFileCount === 1 ? "1 ficheiro alterado" : `${String(uniqueFileCount)} ficheiros alterados`}
        </p>
      ) : null}
    </div>
  );
}

type GroupedItem =
  | { type: "user"; message: Message }
  | { type: "assistant"; message: Message; originalIndex: number }
  | { type: "tools"; messages: Message[] };

function groupMessages(messages: Message[]): GroupedItem[] {
  const result: GroupedItem[] = [];
  let toolBatch: Message[] = [];

  const flushTools = () => {
    if (toolBatch.length > 0) {
      result.push({ type: "tools", messages: toolBatch });
      toolBatch = [];
    }
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    if (msg.role === "tool") {
      toolBatch.push(msg);
    } else {
      flushTools();
      if (msg.role === "user") {
        result.push({ type: "user", message: msg });
      } else {
        result.push({ type: "assistant", message: msg, originalIndex: i });
      }
    }
  }
  flushTools();
  return result;
}

function truncateToolContent(content: string, max: number): string {
  const oneLine = content.replace(/\n/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max) + "…";
}

function findLastAssistantMessageIndex(messages: Message[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return index;
    }
  }
  return -1;
}
