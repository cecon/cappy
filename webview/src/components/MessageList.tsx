import { Box, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message } from "../lib/types";
import { mergeFileDiffsForDisplay } from "../lib/mergeFileDiffs";
import { cappyPalette } from "../theme";
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
    <Stack gap="md" className={styles.container ?? ""} aria-live="polite">
      {messages.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nenhuma mensagem ainda.
        </Text>
      ) : null}
      {grouped.map((group, gi) => {
        if (group.type === "user") {
          const hasImages = group.message.images && group.message.images.length > 0;
          return (
            <Box
              key={`user-${String(gi)}`}
              component="article"
              style={{ alignSelf: "flex-end", maxWidth: "min(92%, 100%)" }}
            >
              <Stack gap={4} align="flex-end">
                <Text size="10px" tt="uppercase" lts={0.6} c="dimmed">
                  User
                </Text>
                <Paper
                  radius="md"
                  p="sm"
                  style={{
                    borderRadius: "10px 10px 2px 10px",
                    background: cappyPalette.bgAccent,
                    color: cappyPalette.textAccent,
                    maxWidth: "100%",
                  }}
                >
                  <Stack gap="xs" align="flex-end">
                    {hasImages ? (
                      <Group gap={6}>
                        {group.message.images!.map((img, i) => (
                          <img
                            key={i}
                            src={img.dataUrl}
                            alt={`Anexo ${String(i + 1)}`}
                            className={styles.messageImage}
                          />
                        ))}
                      </Group>
                    ) : null}
                    <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {group.message.content}
                    </Text>
                  </Stack>
                </Paper>
              </Stack>
            </Box>
          );
        }
        if (group.type === "tools") {
          return <ToolGroup key={`tools-${String(gi)}`} messages={group.messages} />;
        }
        return (
          <Box key={`assistant-${String(gi)}`} component="article" w="100%" style={{ alignSelf: "flex-start" }}>
            <Stack gap={4} align="flex-start">
              <Text size="10px" tt="uppercase" lts={0.6} c="dimmed">
                Assistant
              </Text>
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
                <Group gap={6} align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Box className={styles.markdown ?? ""} style={{ flex: 1, minWidth: 0 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{group.message.content}</ReactMarkdown>
                  </Box>
                  {isStreaming && group.originalIndex === lastAssistantMessageIndex ? (
                    <span className={styles.cursor} aria-hidden="true" />
                  ) : null}
                </Group>
              </Paper>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

function ToolGroup({ messages }: { messages: Message[] }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const summary =
    messages.length === 1
      ? truncateToolContent(messages[0]!.content, 80)
      : `${String(messages.length)} tool calls`;
  const rawDiffs = messages.map((m) => m.fileDiff).filter((d): d is NonNullable<typeof d> => d !== undefined);
  const mergedDiffs = mergeFileDiffsForDisplay(rawDiffs);
  const uniqueFileCount = new Set(rawDiffs.map((d) => d.path)).size;

  return (
    <Stack gap="xs" style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
      {mergedDiffs.map((diff, i) => (
        <FileDiffMini key={`diff-${diff.path}-${String(i)}`} diff={diff} />
      ))}
      <Button
        type="button"
        variant="default"
        size="compact-xs"
        justify="flex-start"
        h="auto"
        py={4}
        px="sm"
        onClick={() => setExpanded((prev) => !prev)}
        styles={{
          root: {
            background: cappyPalette.bgSunken,
            borderColor: cappyPalette.borderSubtle,
          },
        }}
      >
        <Group gap={6} wrap="nowrap">
          <Text span size="xs" c="dimmed">
            {expanded ? "▾" : "▸"}
          </Text>
          <Text span size="xs" c="dimmed" truncate>
            {summary}
          </Text>
        </Group>
      </Button>
      {expanded ? (
        <Paper withBorder radius="sm" p={0} style={{ maxHeight: 200, overflow: "auto", background: cappyPalette.bgSunken }}>
          {messages.map((msg, i) => (
            <Text
              key={i}
              component="pre"
              size="xs"
              c="dimmed"
              p="sm"
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                borderBottom: `1px solid ${cappyPalette.borderSubtle}`,
              }}
            >
              {msg.content}
            </Text>
          ))}
        </Paper>
      ) : null}
      {uniqueFileCount > 0 ? (
        <Text size="xs" c="dimmed" ml={4}>
          {uniqueFileCount === 1 ? "1 ficheiro alterado" : `${String(uniqueFileCount)} ficheiros alterados`}
        </Text>
      ) : null}
    </Stack>
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
