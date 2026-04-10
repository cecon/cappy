import { Badge, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type { McpTool } from "../lib/types";

const bridge = getBridge();
const DESTRUCTIVE_KEYWORDS = ["write", "delete", "remove", "create", "execute", "run"] as const;

/**
 * Lists MCP tools grouped by server and flagged by risk profile.
 */
export function McpToolsPanel(): JSX.Element {
  const [tools, setTools] = useState<McpTool[]>([]);

  useEffect(() => {
    const unsubscribe = bridge.onMessage((message: IncomingMessage) => {
      if (message.type === "mcp:tools") {
        setTools(message.tools);
      }
    });

    bridge.send({ type: "mcp:list" });
    return unsubscribe;
  }, []);

  const groupedTools = useMemo(() => {
    return tools.reduce<Record<string, McpTool[]>>((accumulator, tool) => {
      const group = accumulator[tool.serverName] ?? [];
      group.push(tool);
      accumulator[tool.serverName] = group;
      return accumulator;
    }, {});
  }, [tools]);

  const serverNames = useMemo(() => Object.keys(groupedTools).sort(), [groupedTools]);

  return (
    <Stack gap="md" h="100%" style={{ overflow: "auto" }}>
      <Title order={2} size="h4">
        Tools MCP
      </Title>
      {serverNames.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nenhuma tool MCP disponível.
        </Text>
      ) : null}

      {serverNames.map((serverName) => (
        <Paper key={serverName} p="md" radius="md" withBorder>
          <Title order={3} size="md" mb="sm">
            {serverName}
          </Title>
          <Stack gap="sm">
            {(groupedTools[serverName] ?? []).map((tool) => {
              const destructive = isDestructiveTool(tool.name);
              return (
                <Paper key={`${tool.serverName}__${tool.name}`} p="sm" radius="sm" withBorder bg="dark.7">
                  <Stack gap={6}>
                    <Stack gap={4} align="flex-start">
                      <Text size="sm" fw={600} style={{ wordBreak: "break-word" }}>
                        {tool.name}
                      </Text>
                      <Badge size="sm" color={destructive ? "red" : "teal"} variant="light">
                        {destructive ? "Destrutiva" : "Segura"}
                      </Badge>
                    </Stack>
                    <Text size="sm" c="dimmed" style={{ wordBreak: "break-word" }}>
                      {tool.description || "Sem descrição."}
                    </Text>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

/**
 * Checks whether one tool name implies destructive behavior.
 */
function isDestructiveTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  return DESTRUCTIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
