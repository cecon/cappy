import React from "react";
import { Box, Paper, Stack, Text } from "@mantine/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message } from "../lib/types";
import type { ToolRowItem } from "../domain/entities/ChatState";
import { cappyPalette } from "../theme";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";
import { ToolPartDisplay } from "./ToolPartDisplay";
import styles from "./MessageList.module.css";

// ── TableListView — substitui <table> por cards no estilo mobile ──────────────

type AnyElement = React.ReactElement<{ children: React.ReactNode }>;

function getCellChildren(node: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(node)) return node;
  return (node as AnyElement).props.children;
}

function TableListView({ children }: { children?: React.ReactNode }): JSX.Element {
  const headers: React.ReactNode[] = [];
  const rows: React.ReactNode[][] = [];

  React.Children.forEach(children, (section) => {
    if (!React.isValidElement(section)) return;
    const sectionEl = section as AnyElement;
    const sectionType = sectionEl.type as string;

    React.Children.forEach(sectionEl.props.children, (tr) => {
      if (!React.isValidElement(tr)) return;
      const trEl = tr as AnyElement;
      const cells = React.Children.toArray(trEl.props.children);

      if (sectionType === "thead") {
        cells.forEach((cell) => headers.push(getCellChildren(cell)));
      } else if (sectionType === "tbody") {
        const row = cells.map((cell) => getCellChildren(cell));
        if (row.length > 0) rows.push(row);
      }
    });
  });

  if (rows.length === 0) {
    return <table>{children}</table>;
  }

  return (
    <div className={styles.tableList}>
      {rows.map((row, ri) => (
        <div key={ri} className={styles.tableCard}>
          {row.map((cell, ci) => (
            <div key={ci} className={ci === 0 ? styles.tableCardTitle : styles.tableCardRow}>
              {ci > 0 && headers[ci] != null && (
                <span className={styles.tableLabel}>{headers[ci]}</span>
              )}
              <span className={ci === 0 ? styles.tableCardTitleText : styles.tableCardValue}>
                {cell}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface MessageListProps {
  messages: Message[];
  toolRows: ToolRowItem[];
  isStreaming: boolean;
}

// ── Group type ────────────────────────────────────────────────────────────────

type UserGroup = { type: "user"; message: Message };
type AssistantGroup = {
  type: "assistant";
  message: Message;
  /** Placeholder messages (role:"tool") that belong to this assistant turn. */
  toolSlots: Message[];
  isLast: boolean;
};
type Group = UserGroup | AssistantGroup;

// ── Main component ────────────────────────────────────────────────────────────

export function MessageList({ messages, toolRows, isStreaming }: MessageListProps): JSX.Element {
  const groups = groupMessages(messages);

  return (
    <Stack gap="md" className={styles.container ?? ""} aria-live="polite">
      {messages.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nenhuma mensagem ainda.
        </Text>
      ) : null}

      {groups.map((group, gi) => {
        if (group.type === "user") {
          return <UserBubble key={`user-${gi}`} message={group.message} />;
        }
        return (
          <AssistantTurn
            key={`assistant-${gi}`}
            message={group.message}
            toolSlots={group.toolSlots}
            toolRows={toolRows}
            isStreaming={isStreaming && group.isLast}
          />
        );
      })}
    </Stack>
  );
}

// ── UserBubble ────────────────────────────────────────────────────────────────

function UserBubble({ message }: { message: Message }): JSX.Element {
  const hasImages = message.images && message.images.length > 0;
  return (
    <Box
      component="article"
      className={styles.messageWrapper ?? ""}
      style={{ alignSelf: "flex-end", maxWidth: "min(92%, 100%)" }}
    >
      <Stack gap={4} align="flex-end">
        <Text size="10px" tt="uppercase" lts={0.6} c="dimmed">
          User
        </Text>
        <Paper
          radius="md"
          p="sm"
          withBorder={false}
          style={{
            borderRadius: "10px 10px 2px 10px",
            background: cappyPalette.bgAccent,
            color: cappyPalette.textAccent,
            maxWidth: "100%",
          }}
        >
          <Stack gap="xs" align="flex-end">
            {hasImages ? (
              <Box style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {message.images!.map((img, i) => (
                  <img
                    key={i}
                    src={img.dataUrl}
                    alt={`Anexo ${i + 1}`}
                    className={styles.messageImage}
                  />
                ))}
              </Box>
            ) : null}
            <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {message.content}
            </Text>
          </Stack>
        </Paper>
        <Box className={styles.copyRowUser ?? ""}>
          <CopyButton value={message.content} />
        </Box>
      </Stack>
    </Box>
  );
}

// ── AssistantTurn ─────────────────────────────────────────────────────────────

interface AssistantTurnProps {
  message: Message;
  toolSlots: Message[];
  toolRows: ToolRowItem[];
  isStreaming: boolean;
}

function AssistantTurn({ message, toolSlots, toolRows, isStreaming }: AssistantTurnProps): JSX.Element {
  return (
    <Box
      component="article"
      w="100%"
      className={styles.messageWrapper ?? ""}
      style={{ alignSelf: "flex-start" }}
    >
      <Stack gap={4} align="flex-start">
        <Text size="10px" tt="uppercase" lts={0.6} c="dimmed">
          Assistant
        </Text>

        {/* Text bubble — only rendered when there is content */}
        {message.content.trim() ? (
          <Paper
            radius="md"
            p="sm"
            withBorder
            style={{
              borderRadius: "10px 10px 10px 2px",
              background: cappyPalette.bgSurface,
              borderColor: cappyPalette.borderSurface,
              color: cappyPalette.textPrimary,
              width: "100%",
              maxWidth: "100%",
            }}
          >
            <Box style={{ display: "flex", gap: 6, alignItems: "flex-end", minWidth: 0 }}>
              <Box className={styles.markdown ?? ""} style={{ flex: 1, minWidth: 0 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock, table: TableListView as React.ComponentType<React.HTMLAttributes<HTMLTableElement>> }}>
                  {message.content}
                </ReactMarkdown>
              </Box>
              {isStreaming ? <span className={styles.cursor} aria-hidden="true" /> : null}
            </Box>
          </Paper>
        ) : isStreaming ? (
          /* Streaming with no content yet — show cursor only */
          <span className={styles.cursor} aria-hidden="true" style={{ marginLeft: 4 }} />
        ) : null}

        {/* Inline tool rows — one per tool slot */}
        {toolSlots.length > 0 ? (
          <Stack gap={4} w="100%">
            {toolSlots.map((slot) => {
              const row = toolRows.find((r) => r.id === slot.tool_call_id);
              if (!row) return null;
              return (
                <Box key={slot.tool_call_id}>
                  <ToolPartDisplay row={row} />
                </Box>
              );
            })}
          </Stack>
        ) : null}

        <Box className={styles.copyRowAssistant ?? ""}>
          <CopyButton value={message.content} />
        </Box>
      </Stack>
    </Box>
  );
}

// ── Grouping logic ────────────────────────────────────────────────────────────

/**
 * Groups messages into user bubbles and assistant turns.
 * Each assistant turn collects the tool slot messages (role:"tool") that follow it.
 * Mirrors Kilo Code's VscodeSessionTurn grouping pattern.
 */
function groupMessages(messages: Message[]): Group[] {
  const result: Group[] = [];
  let lastAssistantIndex = -1;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;

    if (msg.role === "user") {
      result.push({ type: "user", message: msg });
      lastAssistantIndex = -1;
    } else if (msg.role === "assistant") {
      // Collect any tool slots that immediately follow
      const toolSlots: Message[] = [];
      while (i + 1 < messages.length && messages[i + 1]!.role === "tool" && messages[i + 1]!.tool_call_id !== undefined) {
        i++;
        toolSlots.push(messages[i]!);
      }
      lastAssistantIndex = result.length;
      result.push({ type: "assistant", message: msg, toolSlots, isLast: false });
    }
    // role:"tool" without tool_call_id = system log message (STREAM_SYSTEM), skip visual render
  }

  // Mark the last assistant group as isLast for streaming cursor
  if (lastAssistantIndex >= 0) {
    const last = result[lastAssistantIndex]!;
    if (last.type === "assistant") {
      result[lastAssistantIndex] = { ...last, isLast: true };
    }
  }

  return result;
}
