import { useState } from "react";
import { Box, Group, Text } from "@mantine/core";
import type { PipelineTemplate } from "../lib/types";
import { cappyPalette } from "../theme";

interface Props {
  templates: PipelineTemplate[];
  onLaunch: (pipelineId: string, text: string) => void;
}

/**
 * Compact pipeline launcher shown above the InputBar when the agent is idle.
 * Lets the user pick a predefined template and enter the task description.
 */
export function PipelineLauncher({ templates, onLaunch }: Props): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");

  const selectedTemplate = templates.find((t) => t.id === selected);

  function handleConfirm(): void {
    if (!selected || !text.trim()) return;
    onLaunch(selected, text.trim());
    setSelected(null);
    setText("");
  }

  return (
    <Box
      px={8}
      py={6}
      style={{
        background: cappyPalette.bgSunken,
        borderTop: `1px solid ${cappyPalette.borderSubtle}`,
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase" lts={0.5} mb={6}>
        Pipeline
      </Text>

      <Group gap={4} mb={selected ? 6 : 0}>
        {templates.map((t) => (
          <Box
            key={t.id}
            component="button"
            onClick={() => setSelected(selected === t.id ? null : t.id)}
            px={8}
            py={3}
            style={{
              background: selected === t.id ? `${cappyPalette.accentFill}22` : "transparent",
              border: `1px solid ${selected === t.id ? cappyPalette.accentFill : cappyPalette.borderSurface}`,
              borderRadius: 999,
              color: selected === t.id ? cappyPalette.textAccent : cappyPalette.textSecondary,
              fontSize: "0.7rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.name}
            <Text component="span" size="xs" c="dimmed" ml={4}>
              ({t.stageCount} stages)
            </Text>
          </Box>
        ))}
      </Group>

      {selectedTemplate ? (
        <Group gap={4} align="flex-end" mt={4}>
          <Box
            component="input"
            value={text}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleConfirm(); }
            }}
            placeholder={`Descreva a tarefa para "${selectedTemplate.name}"…`}
            style={{
              flex: 1,
              background: cappyPalette.bgBase,
              border: `1px solid ${cappyPalette.borderSurface}`,
              borderRadius: 6,
              color: cappyPalette.textPrimary,
              fontSize: "0.75rem",
              padding: "4px 8px",
              outline: "none",
            }}
          />
          <Box
            component="button"
            onClick={handleConfirm}
            disabled={!text.trim()}
            px={10}
            py={4}
            style={{
              background: text.trim() ? cappyPalette.accentFill : cappyPalette.bgSurface,
              border: "none",
              borderRadius: 6,
              color: text.trim() ? "#fff" : cappyPalette.textMuted,
              fontSize: "0.7rem",
              fontWeight: 600,
              cursor: text.trim() ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Iniciar
          </Box>
        </Group>
      ) : null}
    </Box>
  );
}
