import { Box, Collapse, Group, Loader, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";

import type { ToolRowStatus } from "../domain/entities/ChatState";
import { cappyPalette } from "../theme";
import styles from "./BasicTool.module.css";

export interface BasicToolProps {
  /** Icon element or character shown before the title. */
  icon: React.ReactNode;
  /** Primary label shown in the trigger row. */
  title: string;
  /** Secondary label (file path, command snippet, etc.) — hidden when pending/running. */
  subtitle?: string | undefined;
  /** Current lifecycle status of this tool call. */
  status: ToolRowStatus;
  /** Whether the collapsible body should start open. Defaults to false. */
  defaultOpen?: boolean;
  /** Expandable content (output, diff, etc.) shown when done and open. */
  children?: React.ReactNode;
}

/**
 * BasicTool — collapsible accordion row for a single tool call.
 *
 * Mirrors the Kilo Code BasicTool pattern:
 * - pending/running: animated title shimmer + spinner, no expand arrow
 * - done/rejected:   clickable trigger + chevron + collapsible body
 */
export function BasicTool({
  icon,
  title,
  subtitle,
  status,
  defaultOpen = false,
  children,
}: BasicToolProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const isPending = status === "pending" || status === "running";
  const hasContent = Boolean(children);
  const canToggle = !isPending && hasContent;

  const handleToggle = () => {
    if (!canToggle) return;
    setOpen((prev) => !prev);
  };

  return (
    <Box style={{ width: "100%" }}>
      <UnstyledButton
        component="div"
        onClick={handleToggle}
        className={`${styles.trigger ?? ""} ${canToggle ? "" : (styles.triggerNoClick ?? "")}`}
        style={{
          background: cappyPalette.bgSunken,
          border: `1px solid ${cappyPalette.borderSubtle}`,
        }}
        aria-expanded={canToggle ? open : undefined}
      >
        {/* Icon */}
        <Text span size="xs" style={{ flexShrink: 0, lineHeight: 1, opacity: 0.65 }}>
          {icon}
        </Text>

        {/* Title + subtitle */}
        <Box style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden" }}>
          <Text
            span
            size="xs"
            fw={500}
            className={isPending ? (styles.shimmer ?? "") : ""}
            style={{ flexShrink: 0, color: cappyPalette.textSecondary }}
          >
            {title}
          </Text>

          {!isPending && subtitle ? (
            <Text
              span
              size="xs"
              c="dimmed"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "var(--mantine-font-family-monospace)",
                fontSize: "var(--mantine-font-size-xs)",
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Box>

        {/* Right: spinner | rejected badge | chevron */}
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0, marginLeft: "auto", paddingLeft: 4 }}>
          {status === "rejected" ? (
            <Text span size="xs" c="red.5" style={{ lineHeight: 1 }}>
              ✕
            </Text>
          ) : isPending ? (
            <Loader size={10} type="dots" color="ideAccent" aria-label="executando" />
          ) : canToggle ? (
            <Text
              span
              size="xs"
              c="dimmed"
              style={{
                display: "inline-block",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 150ms ease",
                lineHeight: 1,
              }}
            >
              ▾
            </Text>
          ) : null}
        </Group>
      </UnstyledButton>

      {/* Collapsible body */}
      {hasContent ? (
        <Collapse in={open} transitionDuration={150}>
          <Box
            className={styles.body ?? ""}
            style={{
              marginTop: 1,
              border: `1px solid ${cappyPalette.borderSubtle}`,
              borderTop: "none",
              background: cappyPalette.bgSunken,
            }}
          >
            {children}
          </Box>
        </Collapse>
      ) : null}
    </Box>
  );
}
