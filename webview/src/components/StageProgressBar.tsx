import { Box, Group, Text } from "@mantine/core";
import type { PipelineUiState } from "../lib/types";
import { cappyPalette } from "../theme";

interface Props {
  pipeline: PipelineUiState;
  onAdvance?: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending: cappyPalette.borderSurface,
  running: cappyPalette.textAccent,
  done: cappyPalette.greenMid,
  "awaiting-approval": cappyPalette.amber,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "○",
  running: "●",
  done: "✓",
  "awaiting-approval": "⏸",
};

/**
 * Horizontal stage progress indicator shown at the top of the chat while a
 * pipeline is active.  Each stage node shows its status via color and glyph.
 * When the pipeline is paused at an approval gate, an "Advance" button appears.
 */
export function StageProgressBar({ pipeline, onAdvance }: Props): JSX.Element {
  return (
    <Box
      px={8}
      py={6}
      style={{
        background: cappyPalette.bgSunken,
        borderBottom: `1px solid ${cappyPalette.borderSubtle}`,
        flexShrink: 0,
      }}
    >
      <Group gap={0} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0, marginRight: 8 }} tt="uppercase" lts={0.5}>
          {pipeline.name}
        </Text>

        <Group gap={0} align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
          {pipeline.stages.map((stage, idx) => (
            <Group key={stage.id} gap={0} wrap="nowrap" align="center" style={{ flexShrink: 0 }}>
              {/* Arrow connector (not before the first node) */}
              {idx > 0 && (
                <Text size="xs" c="dimmed" mx={4} style={{ opacity: 0.5 }}>
                  →
                </Text>
              )}

              {/* Stage node */}
              <Box
                px={8}
                py={2}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${STATUS_COLOR[stage.status] ?? cappyPalette.borderSurface}`,
                  background:
                    stage.status === "running"
                      ? `${cappyPalette.textAccent}18`
                      : stage.status === "awaiting-approval"
                        ? `${cappyPalette.amber}18`
                        : stage.status === "done"
                          ? `${cappyPalette.greenMid}18`
                          : "transparent",
                  transition: "all 0.2s ease",
                }}
              >
                <Group gap={4} wrap="nowrap" align="center">
                  <Text
                    size="xs"
                    style={{
                      color: STATUS_COLOR[stage.status] ?? cappyPalette.textMuted,
                      fontFamily: "monospace",
                      lineHeight: 1,
                    }}
                  >
                    {STATUS_LABEL[stage.status] ?? "○"}
                  </Text>
                  <Text
                    size="xs"
                    style={{
                      color:
                        stage.status === "pending" ? cappyPalette.textMuted : cappyPalette.textPrimary,
                    }}
                  >
                    {stage.name}
                  </Text>
                </Group>
              </Box>
            </Group>
          ))}
        </Group>

        {/* Advance button shown only while waiting for approval */}
        {pipeline.awaitingApproval && onAdvance ? (
          <Box
            component="button"
            onClick={onAdvance}
            ml={10}
            px={10}
            py={4}
            style={{
              flexShrink: 0,
              background: cappyPalette.accentFill,
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: "0.7rem",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
            }}
          >
            Avançar →
          </Box>
        ) : null}
      </Group>
    </Box>
  );
}
