import { Button, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";

import { getBridge } from "../lib/vscode-bridge";

interface HistorySession {
  sessionId: string;
  title: string;
  relativeDate: string;
  messageCount: number;
}

const bridge = getBridge();
const MOCK_SESSIONS: HistorySession[] = [
  {
    sessionId: "sess_001",
    title: "Refatoração do fluxo de autenticação no backend com logs estruturados",
    relativeDate: "há 2 horas",
    messageCount: 28,
  },
  {
    sessionId: "sess_002",
    title: "Plano para migração incremental de componentes para CSS Modules",
    relativeDate: "ontem",
    messageCount: 16,
  },
  {
    sessionId: "sess_003",
    title: "Investigação de timeout em chamadas MCP no modo browser",
    relativeDate: "há 3 dias",
    messageCount: 41,
  },
  {
    sessionId: "sess_004",
    title: "Revisão de PR com ajustes de tipagem estrita no webview",
    relativeDate: "semana passada",
    messageCount: 12,
  },
];

/**
 * Exibe sessões anteriores e dispara carregamento de histórico.
 */
export function HistoryPanel(): JSX.Element {
  function handleLoadHistory(sessionId: string): void {
    bridge.send({ type: "history:load", sessionId });
  }

  return (
    <Paper p="md" radius="md" withBorder h="100%" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Title order={2} size="h4" mb="md">
        Histórico
      </Title>
      <ScrollArea flex={1} offsetScrollbars type="auto">
        <Stack gap={4}>
          {MOCK_SESSIONS.map((session) => (
            <Button
              key={session.sessionId}
              type="button"
              variant="subtle"
              color="gray"
              justify="flex-start"
              h="auto"
              py="xs"
              px="sm"
              fullWidth
              styles={{ inner: { alignItems: "flex-start", flexDirection: "column", gap: 4 } }}
              onClick={() => handleLoadHistory(session.sessionId)}
            >
              <Text size="sm" fw={500} lineClamp={2} ta="left" c="var(--mantine-color-text)">
                {session.title}
              </Text>
              <Text size="xs" c="dimmed" ta="left">
                {session.relativeDate} · {session.messageCount} mensagens
              </Text>
            </Button>
          ))}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
