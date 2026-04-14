import { ActionIcon, Badge, Box, Collapse, Group, Paper, Text, Tooltip } from "@mantine/core";
import { useState } from "react";

interface PlanModePanelProps {
  content: string | null;
  filePath: string | null;
  onOpenFile: () => void;
  onApprove: () => void;
}

/**
 * Shown above the InputBar while the agent is in plan mode.
 * Displays the current plan content (collapsible) and action buttons.
 */
export function PlanModePanel({ content, filePath, onOpenFile, onApprove }: PlanModePanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const hasContent = content !== null && content.trim().length > 0;
  const previewLines = hasContent
    ? content.split("\n").slice(0, 4).join("\n")
    : null;

  return (
    <Paper
      p="sm"
      radius="md"
      withBorder
      style={{
        borderColor: "var(--mantine-color-blue-6, #4dabf7)",
        backgroundColor: "var(--vscode-editor-background)",
      }}
    >
      {/* Header row */}
      <Group justify="space-between" align="center" wrap="nowrap" mb={hasContent ? "xs" : 0}>
        <Group gap="xs" align="center" wrap="nowrap">
          <Badge
            size="sm"
            variant="light"
            color="blue"
            style={{ letterSpacing: 0.5, flexShrink: 0 }}
          >
            PLAN MODE
          </Badge>

          {hasContent ? (
            <Text
              size="xs"
              c="dimmed"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Recolher plano" : "Ver plano"}
            </Text>
          ) : (
            <Text size="xs" c="dimmed">
              A aguardar plano… use PlanWrite para registar.
            </Text>
          )}
        </Group>

        <Group gap={4} wrap="nowrap">
          {filePath ? (
            <Tooltip label="Abrir ficheiro de plano no editor" position="top" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={onOpenFile}
                aria-label="Abrir ficheiro de plano"
              >
                {/* file icon (codicon-like inline svg) */}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9.5 1.5v3h3l-3-3zM3 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.5L9.5 1.5H3z" />
                </svg>
              </ActionIcon>
            </Tooltip>
          ) : null}

          <Tooltip label="Aprovar plano e iniciar implementação" position="top" withArrow>
            <ActionIcon
              size="sm"
              variant="filled"
              color="green"
              onClick={onApprove}
              aria-label="Aprovar plano"
            >
              {/* check icon */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
              </svg>
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Collapsible plan content */}
      {hasContent ? (
        <>
          {/* Always-visible preview */}
          {!expanded ? (
            <Box
              onClick={() => setExpanded(true)}
              style={{
                cursor: "pointer",
                borderRadius: 4,
                padding: "4px 6px",
                backgroundColor: "var(--vscode-textCodeBlock-background, rgba(128,128,128,0.1))",
              }}
            >
              <Text
                size="xs"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.8 }}
              >
                {previewLines}
                {content!.split("\n").length > 4 ? "\n…" : ""}
              </Text>
            </Box>
          ) : null}

          <Collapse in={expanded}>
            <Box
              style={{
                maxHeight: 320,
                overflowY: "auto",
                borderRadius: 4,
                padding: "6px 8px",
                backgroundColor: "var(--vscode-textCodeBlock-background, rgba(128,128,128,0.1))",
              }}
            >
              <Text
                size="xs"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {content}
              </Text>
            </Box>
          </Collapse>
        </>
      ) : null}
    </Paper>
  );
}
