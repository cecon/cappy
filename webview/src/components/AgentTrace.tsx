import { Accordion, Badge, Group, Stack, Text } from "@mantine/core";
import type { ToolRowItem, ToolRowStatus } from "../domain/entities/ChatState";

interface AgentTraceProps {
  toolRows: ToolRowItem[];
}

function statusColor(status: ToolRowStatus): string {
  switch (status) {
    case "done": return "green";
    case "running": return "blue";
    case "rejected": return "red";
    default: return "yellow";
  }
}

function statusLabel(status: ToolRowStatus): string {
  switch (status) {
    case "done": return "ok";
    case "running": return "executando";
    case "rejected": return "rejeitado";
    default: return "aguardando";
  }
}

function summarizeInput(input: Record<string, unknown>): string {
  const path = (input["path"] ?? input["file_path"] ?? input["filePath"]) as string | undefined;
  if (path) return String(path).split("/").slice(-2).join("/");
  const cmd = input["command"] as string | undefined;
  if (cmd) return String(cmd).slice(0, 60);
  const query = (input["query"] ?? input["pattern"]) as string | undefined;
  if (query) return String(query).slice(0, 60);
  const keys = Object.keys(input);
  if (keys.length > 0) return `${keys[0]}: ${String(input[keys[0]!]).slice(0, 40)}`;
  return "";
}

export function AgentTrace({ toolRows }: AgentTraceProps): JSX.Element | null {
  if (toolRows.length === 0) return null;

  const doneCount = toolRows.filter((r) => r.status === "done").length;

  return (
    <Accordion variant="contained" radius="sm" chevronPosition="right">
      <Accordion.Item value="trace" style={{ border: "none" }}>
        <Accordion.Control px="xs" py={4}>
          <Group gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" lts={0.4}>
              Rastro
            </Text>
            <Badge size="xs" variant="light" color="gray" radius="sm">
              {doneCount}/{toolRows.length}
            </Badge>
          </Group>
        </Accordion.Control>
        <Accordion.Panel px="xs" pb="xs">
          <Stack gap={4}>
            {toolRows.map((row, i) => {
              const detail = summarizeInput(row.input);
              return (
                <Group key={row.id} gap="sm" align="flex-start" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 18, textAlign: "right", flexShrink: 0 }}>
                    {i + 1}.
                  </Text>
                  <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap" align="center">
                      <Text size="xs" ff="monospace" style={{ flexShrink: 0 }}>
                        {row.name}
                      </Text>
                      {detail ? (
                        <Text size="xs" c="dimmed" truncate style={{ minWidth: 0 }}>
                          {detail}
                        </Text>
                      ) : null}
                      <Badge
                        size="xs"
                        color={statusColor(row.status)}
                        variant="light"
                        style={{ flexShrink: 0, marginLeft: "auto" }}
                      >
                        {statusLabel(row.status)}
                      </Badge>
                    </Group>
                  </Stack>
                </Group>
              );
            })}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
