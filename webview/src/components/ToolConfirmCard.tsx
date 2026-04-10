import { Button, Code, Group, Menu, Paper, Stack, Text } from "@mantine/core";

import type { ToolCall } from "../lib/types";
import { cappyPalette } from "../theme";

export interface HitlToolActionsProps {
  toolCallId: string;
  onApprove: (toolCallId: string) => void;
  onApproveSession: (toolCallId: string) => void;
  onApprovePersist: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
  /** Texto do botão principal (ex.: Enter no terminal). */
  approveButtonLabel?: string;
  /**
   * `terminal`: aprovação principal à direita; rejeitar e menu à esquerda (painel Terminal).
   */
  layout?: "default" | "terminal";
}

/**
 * Botões HITL partilhados entre o cartão genérico e o bloco unificado do terminal.
 */
export function HitlToolActions({
  toolCallId,
  onApprove,
  onApproveSession,
  onApprovePersist,
  onReject,
  approveButtonLabel = "Aprovar",
  layout = "default",
}: HitlToolActionsProps): JSX.Element {
  const secondary = (
    <>
      <Button type="button" size="xs" variant="light" color="red" onClick={() => onReject(toolCallId)}>
        Rejeitar
      </Button>
      <Menu shadow="md" width={300} position="bottom-start">
        <Menu.Target>
          <Button type="button" size="xs" variant="light" color="teal">
            Aprovar mais ▾
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => onApproveSession(toolCallId)}>Aprovar todos (esta sessão)</Menu.Item>
          <Menu.Item onClick={() => onApprovePersist(toolCallId)}>Aprovar todos e guardar no projeto</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );

  const primaryApprove = (
    <Button type="button" size="xs" color="teal" onClick={() => onApprove(toolCallId)}>
      {approveButtonLabel}
    </Button>
  );

  if (layout === "terminal") {
    return (
      <Group gap="xs" wrap="wrap" align="center" justify="space-between" w="100%">
        <Group gap="xs" wrap="wrap">
          {secondary}
        </Group>
        {primaryApprove}
      </Group>
    );
  }

  return (
    <Group gap="xs" wrap="wrap" align="flex-start">
      {primaryApprove}
      <Menu shadow="md" width={300} position="bottom-start">
        <Menu.Target>
          <Button type="button" size="xs" variant="light" color="teal">
            Aprovar mais ▾
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => onApproveSession(toolCallId)}>Aprovar todos (esta sessão)</Menu.Item>
          <Menu.Item onClick={() => onApprovePersist(toolCallId)}>Aprovar todos e guardar no projeto</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Button type="button" size="xs" variant="light" color="red" onClick={() => onReject(toolCallId)}>
        Rejeitar
      </Button>
    </Group>
  );
}

interface ToolConfirmCardProps {
  toolCall: ToolCall;
  onApprove: (toolCallId: string) => void;
  onApproveSession: (toolCallId: string) => void;
  onApprovePersist: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
  approveButtonLabel?: string;
  hideCommandPreview?: boolean;
}

/**
 * Cartão HITL antes de executar tools destrutivas (shell, escrita, etc.) — uso fora do terminal integrado.
 */
export function ToolConfirmCard({
  toolCall,
  onApprove,
  onApproveSession,
  onApprovePersist,
  onReject,
  approveButtonLabel = "Aprovar",
  hideCommandPreview = false,
}: ToolConfirmCardProps): JSX.Element {
  const commandPreview = getCommandPreview(toolCall);

  return (
    <Paper
      p="sm"
      radius="md"
      withBorder
      style={{
        borderLeftWidth: 3,
        borderLeftColor: cappyPalette.toolBorder,
        maxWidth: "100%",
      }}
    >
      <Stack gap="sm">
        <Text size="xs" tt="uppercase" lts={0.6} fw={700} c="yellow.4">
          {toolCall.name}
        </Text>
        {hideCommandPreview ? null : (
          <Code block fz="xs" p="xs" style={{ backgroundColor: cappyPalette.bgSunken }}>
            $ {commandPreview}
          </Code>
        )}
        <HitlToolActions
          toolCallId={toolCall.id}
          onApprove={onApprove}
          onApproveSession={onApproveSession}
          onApprovePersist={onApprovePersist}
          onReject={onReject}
          approveButtonLabel={approveButtonLabel}
        />
      </Stack>
    </Paper>
  );
}

/**
 * Builds one readable command preview from tool args.
 */
export function toolCallCommandPreview(toolCall: ToolCall): string {
  const rawCommand = toolCall.arguments.command;
  if (typeof rawCommand === "string" && rawCommand.trim().length > 0) {
    return rawCommand.trim();
  }
  return JSON.stringify(toolCall.arguments);
}

function getCommandPreview(toolCall: ToolCall): string {
  return toolCallCommandPreview(toolCall);
}
