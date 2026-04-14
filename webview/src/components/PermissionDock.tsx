import { Box, Button, Code, Group, Menu, Paper, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

import type { ToolCall } from "../lib/types";
import { cappyPalette } from "../theme";

interface PermissionDockProps {
  /** The first pending tool call in the queue (FIFO). */
  toolCall: ToolCall;
  onApprove: (toolCallId: string) => void;
  onApproveSession: (toolCallId: string) => void;
  onApprovePersist: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
  /** How many more pending confirms are queued after this one. */
  remainingCount?: number;
}

function getCommandPreview(toolCall: ToolCall): string | null {
  const cmd = toolCall.arguments.command;
  if (typeof cmd === "string" && cmd.trim()) return cmd.trim();
  const path =
    typeof toolCall.arguments.path === "string" ? toolCall.arguments.path
    : typeof toolCall.arguments.filePath === "string" ? toolCall.arguments.filePath
    : null;
  if (path) return path;
  const entries = Object.entries(toolCall.arguments).slice(0, 2);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
}

function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    bash: "Terminal",
    run_terminal_cmd: "Terminal",
    runterminal: "Terminal",
    execute_command: "Terminal",
    write_to_file: "Escrever arquivo",
    writefile: "Escrever arquivo",
    write: "Escrever arquivo",
    create_file: "Criar arquivo",
    str_replace_based_edit: "Editar arquivo",
    edit_file: "Editar arquivo",
    edit: "Editar arquivo",
    apply_diff: "Aplicar diff",
    list_dir: "Listar diretório",
    search_files: "Pesquisar arquivos",
  };
  return labels[name.toLowerCase()] ?? name;
}

/**
 * PermissionDock — single unified approval surface for ALL tool types.
 *
 * Mirrors Kilo Code's PermissionDock:
 * - Rendered fixed BELOW the message scroll area, ABOVE the InputBar
 * - Same component for shell, file-write, and any other tool
 * - Shows queued count when multiple confirms are pending
 */
export function PermissionDock({
  toolCall,
  onApprove,
  onApproveSession,
  onApprovePersist,
  onReject,
  remainingCount = 0,
}: PermissionDockProps): JSX.Element {
  const preview = getCommandPreview(toolCall);
  const label = getToolLabel(toolCall.name);

  return (
    <Paper
      radius="md"
      withBorder
      style={{
        borderColor: cappyPalette.amber,
        background: cappyPalette.bgSurface,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <Group
        px="sm"
        py={6}
        gap="xs"
        style={{
          borderBottom: `1px solid ${cappyPalette.borderSubtle}`,
          background: cappyPalette.bgSunken,
        }}
      >
        <IconAlertTriangle size={13} style={{ color: cappyPalette.amber, flexShrink: 0 }} />
        <Text size="xs" fw={600} style={{ color: cappyPalette.amber, flex: 1 }}>
          {label}
        </Text>
        {remainingCount > 0 ? (
          <Text size="xs" c="dimmed">
            +{remainingCount} na fila
          </Text>
        ) : null}
      </Group>

      {/* Body */}
      <Stack gap="xs" px="sm" py="xs">
        {preview ? (
          <Code
            block
            style={{
              background: cappyPalette.bgSunken,
              color: cappyPalette.textSecondary,
              fontSize: "var(--mantine-font-size-xs)",
              padding: "6px 8px",
              borderRadius: 4,
              maxHeight: 120,
              overflowY: "auto",
              wordBreak: "break-all",
              whiteSpace: "pre-wrap",
            }}
          >
            $ {preview}
          </Code>
        ) : null}

        {/* Actions */}
        <Group gap="xs" justify="flex-end" wrap="wrap">
          <Button
            type="button"
            size="compact-xs"
            variant="light"
            color="red"
            onClick={() => onReject(toolCall.id)}
          >
            Rejeitar
          </Button>

          <Menu shadow="md" width={280} position="top-end">
            <Menu.Target>
              <Button type="button" size="compact-xs" variant="light" color="teal">
                Aprovar mais ▾
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onApproveSession(toolCall.id)}>
                <Stack gap={1}>
                  <Text size="xs" fw={500}>Aprovar todos (esta sessão)</Text>
                  <Text size="xs" c="dimmed">Não pede confirmação até reiniciar</Text>
                </Stack>
              </Menu.Item>
              <Menu.Item onClick={() => onApprovePersist(toolCall.id)}>
                <Stack gap={1}>
                  <Text size="xs" fw={500}>Aprovar sempre (guardar no projeto)</Text>
                  <Text size="xs" c="dimmed">Salva permissão permanente</Text>
                </Stack>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Button
            type="button"
            size="compact-xs"
            color="teal"
            onClick={() => onApprove(toolCall.id)}
          >
            Aprovar
          </Button>
        </Group>
      </Stack>

      {/* Keyboard hint */}
      <Box
        px="sm"
        py={4}
        style={{
          borderTop: `1px solid ${cappyPalette.borderSubtle}`,
          background: cappyPalette.bgSunken,
        }}
      >
        <Text size="10px" c="dimmed">
          Revise o comando antes de aprovar.
        </Text>
      </Box>
    </Paper>
  );
}
