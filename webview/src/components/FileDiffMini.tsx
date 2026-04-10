import { Box, Group, Paper, Text } from "@mantine/core";
import type { KeyboardEvent } from "react";

import { getBridge } from "../lib/vscode-bridge";
import type { FileDiffPayload } from "../lib/types";
import styles from "./FileDiffMini.module.css";

const bridge = getBridge();

interface FileDiffMiniProps {
  diff: FileDiffPayload;
}

/**
 * Compact diff card (Cursor-style) for one file change.
 */
export function FileDiffMini({ diff }: FileDiffMiniProps): JSX.Element {
  const label = diff.path.split("/").pop() ?? diff.path;
  const ext = label.includes(".") ? label.split(".").pop()?.toLowerCase() ?? "" : "";
  const iconLabel =
    ext === "ts" || ext === "tsx"
      ? "TS"
      : ext === "js" || ext === "jsx"
        ? "JS"
        : ext.length > 0
          ? ext.slice(0, 2).toUpperCase()
          : "∙";

  function handleOpen(): void {
    bridge.send({ type: "file:open", path: diff.path });
  }

  function handleOpenKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  }

  return (
    <Paper
      radius="md"
      withBorder
      mb="sm"
      style={{ maxWidth: "100%", cursor: "pointer", overflow: "hidden" }}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleOpenKeyDown}
      title="Clique para abrir no editor"
    >
      <Group
        component="header"
        gap="sm"
        px="sm"
        py={6}
        wrap="nowrap"
        justify="space-between"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <Box className={styles.fileIcon ?? ""} aria-hidden>
            {iconLabel}
          </Box>
          <Text size="xs" fw={500} truncate style={{ flex: 1 }} title={diff.path}>
            {label}
          </Text>
        </Group>
        <Group gap={6} wrap="nowrap" fz="xs" style={{ fontVariantNumeric: "tabular-nums" }}>
          {diff.additions > 0 ? (
            <Text span c="green.4" fw={600}>
              +{diff.additions}
            </Text>
          ) : null}
          {diff.deletions > 0 ? (
            <Text span c="red.4" fw={600}>
              -{diff.deletions}
            </Text>
          ) : null}
          {diff.additions === 0 && diff.deletions === 0 ? (
            <Text span c="dimmed">
              0
            </Text>
          ) : null}
        </Group>
      </Group>
      {diff.hunks.length > 0 ? (
        <div className={styles.hunks}>
          {diff.hunks.map((hunk, hi) => (
            <pre key={hi} className={styles.hunk}>
              {hunk.lines.map((line, li) => (
                <div
                  key={li}
                  className={
                    line.type === "add" ? styles.lineAdd : line.type === "del" ? styles.lineDel : styles.lineCtx
                  }
                >
                  <span className={styles.lineInner}>{line.text || " "}</span>
                </div>
              ))}
            </pre>
          ))}
        </div>
      ) : null}
    </Paper>
  );
}
