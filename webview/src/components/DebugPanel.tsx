import { ActionIcon, Badge, Box, Group, ScrollArea, Stack, Tabs, Text } from "@mantine/core";
import { useEffect, useRef } from "react";
import type { DebugEntry } from "../hooks/useDebugLog";
import type { ChatState } from "../domain/entities/ChatState";
import { cappyPalette } from "../theme";

interface DebugPanelProps {
  log: DebugEntry[];
  state: ChatState;
  onClear: () => void;
}

const CATEGORY_COLOR: Record<DebugEntry["category"], string> = {
  send: "blue",
  stream: "teal",
  tool: "grape",
  pipeline: "orange",
  error: "red",
  system: "gray",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function DebugPanel({ log, state, onClear }: DebugPanelProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  const toolSummary = {
    total: state.toolRows.length,
    done: state.toolRows.filter((r) => r.status === "done").length,
    running: state.toolRows.filter((r) => r.status === "running").length,
    pending: state.toolRows.filter((r) => r.status === "pending").length,
    rejected: state.toolRows.filter((r) => r.status === "rejected").length,
  };

  const msgSummary = {
    total: state.messages.length,
    user: state.messages.filter((m) => m.role === "user").length,
    assistant: state.messages.filter((m) => m.role === "assistant").length,
    tool: state.messages.filter((m) => m.role === "tool").length,
  };

  return (
    <Box
      style={{
        borderTop: `1px solid ${cappyPalette.borderSurface}`,
        background: cappyPalette.bgSunken,
        flexShrink: 0,
      }}
    >
      <Tabs defaultValue="events" keepMounted={false}>
        <Group justify="space-between" px={8} pt={4} pb={0} align="center">
          <Tabs.List style={{ borderBottom: "none" }}>
            <Tabs.Tab value="events" fz={10} py={4} px={8}>
              Eventos
              <Badge size="xs" variant="light" color="gray" ml={4} radius="sm">
                {log.length}
              </Badge>
            </Tabs.Tab>
            <Tabs.Tab value="state" fz={10} py={4} px={8}>
              Estado
            </Tabs.Tab>
          </Tabs.List>

          <ActionIcon
            size="xs"
            variant="subtle"
            color="dimmed"
            aria-label="Limpar log"
            title="Limpar log"
            onClick={onClear}
          >
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </ActionIcon>
        </Group>

        <Tabs.Panel value="events">
          <ScrollArea h={180} viewportRef={scrollRef}>
            <Stack gap={0} px={8} pb={6}>
              {log.length === 0 ? (
                <Text size="xs" c="dimmed" py={8} ta="center">
                  Nenhum evento ainda.
                </Text>
              ) : (
                log.map((entry, i) => (
                  <Group key={i} gap={6} wrap="nowrap" align="baseline" py={1}>
                    <Text size="10px" c="dimmed" ff="monospace" style={{ flexShrink: 0 }}>
                      {formatTime(entry.ts)}
                    </Text>
                    <Badge
                      size="xs"
                      color={CATEGORY_COLOR[entry.category]}
                      variant="light"
                      radius="sm"
                      style={{ flexShrink: 0, fontFamily: "monospace", fontSize: 9 }}
                    >
                      {entry.type}
                    </Badge>
                    {entry.detail ? (
                      <Text size="10px" c="dimmed" ff="monospace" style={{ wordBreak: "break-all" }}>
                        {entry.detail}
                      </Text>
                    ) : null}
                  </Group>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="state">
          <ScrollArea h={180}>
            <Stack gap={6} px={8} py={6}>
              <StateRow label="streaming" value={String(state.isStreaming)} highlight={state.isStreaming} />
              <StateRow label="mensagens" value={`${msgSummary.total} (user:${msgSummary.user} asst:${msgSummary.assistant} tool:${msgSummary.tool})`} />
              <StateRow label="tools" value={`${toolSummary.total} — done:${toolSummary.done} running:${toolSummary.running} pending:${toolSummary.pending} rejected:${toolSummary.rejected}`} />
              <StateRow label="pendingConfirms" value={String(state.pendingConfirms.length)} highlight={state.pendingConfirms.length > 0} />
              <StateRow label="errorMessage" value={state.errorMessage ?? "—"} highlight={state.errorMessage !== null} />
              <StateRow
                label="pipeline"
                value={
                  state.pipeline
                    ? `${state.pipeline.name} — stage ${state.pipeline.currentStageIndex + 1}/${state.pipeline.stages.length}${state.pipeline.awaitingApproval ? " (aguardando)" : ""}`
                    : "—"
                }
              />
              <StateRow
                label="contextUsage"
                value={
                  state.contextUsage
                    ? `${state.contextUsage.usedTokens.toLocaleString()} / ${state.contextUsage.limitTokens.toLocaleString()} tokens`
                    : "—"
                }
              />
              <StateRow label="modelo" value={state.runtimeConfig?.openrouter.model ?? "—"} />
              <StateRow label="planMode" value={String(state.planMode)} />
              <StateRow label="hitlPolicy" value={`destructive=${state.hitlPolicy.destructiveTools}`} />
            </Stack>
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

interface StateRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function StateRow({ label, value, highlight }: StateRowProps): JSX.Element {
  return (
    <Group gap={8} wrap="nowrap" align="flex-start">
      <Text size="10px" ff="monospace" c="dimmed" style={{ minWidth: 110, flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="10px" ff="monospace" c={highlight ? "yellow.4" : "dimmed"} style={{ wordBreak: "break-all" }}>
        {value}
      </Text>
    </Group>
  );
}
