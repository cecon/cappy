import { Box, Group, Text } from "@mantine/core";
import type { ToolRowItem } from "../domain/entities/ChatState";
import { AGENT_TOOL_NAMES, extractAgentTask } from "../lib/agentUtils";
import { cappyPalette } from "../theme";

interface Props {
  toolRows: ToolRowItem[];
}

interface WorkerInfo {
  id: string;
  task: string;
  status: ToolRowItem["status"];
}

const STATUS_DOT: Record<ToolRowItem["status"], string> = {
  pending: "○",
  running: "●",
  done: "✓",
  rejected: "✗",
};

const STATUS_COLOR: Record<ToolRowItem["status"], string> = {
  pending: cappyPalette.textMuted,
  running: cappyPalette.textAccent,
  done: cappyPalette.greenMid,
  rejected: cappyPalette.redSoft,
};

/**
 * Shows a compact list of agent workers derived from toolRows.
 * Rendered only when at least one Agent/ExploreAgent tool row exists.
 */
export function WorkersPanel({ toolRows }: Props): JSX.Element | null {
  const workers: WorkerInfo[] = toolRows
    .filter((r) => AGENT_TOOL_NAMES.has(r.name))
    .map((r) => ({ id: r.id, task: extractAgentTask(r.input), status: r.status }));

  if (workers.length === 0) return null;

  const running = workers.filter((w) => w.status === "running").length;
  const done = workers.filter((w) => w.status === "done").length;

  return (
    <Box
      px={8}
      py={6}
      style={{
        background: cappyPalette.bgSunken,
        borderTop: `1px solid ${cappyPalette.borderSubtle}`,
        flexShrink: 0,
      }}
    >
      <Group gap="xs" mb={4} align="center">
        <Text size="xs" c="dimmed" tt="uppercase" lts={0.5}>Workers</Text>
        {running > 0 && (
          <Box px={5} py={1} style={{ borderRadius: 999, background: `${cappyPalette.textAccent}22`, border: `1px solid ${cappyPalette.textAccent}` }}>
            <Text size="xs" style={{ color: cappyPalette.textAccent, lineHeight: 1 }}>{running} ativos</Text>
          </Box>
        )}
        {done > 0 && running === 0 && (
          <Text size="xs" style={{ color: cappyPalette.greenMid }}>{done}/{workers.length} concluídos</Text>
        )}
      </Group>

      <Box style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {workers.map((w) => (
          <Group key={w.id} gap={6} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
            <Text size="xs" style={{ color: STATUS_COLOR[w.status], fontFamily: "monospace", flexShrink: 0, lineHeight: 1.4 }}>
              {STATUS_DOT[w.status]}
            </Text>
            <Text
              size="xs"
              {...(w.status === "pending" ? { c: "dimmed" } : {})}
              style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {w.task || `Worker ${w.id.slice(0, 6)}`}
            </Text>
          </Group>
        ))}
      </Box>
    </Box>
  );
}
