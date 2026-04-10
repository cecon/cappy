import { ActionIcon, Box, Flex, Group, Menu, Text } from "@mantine/core";
import { useCallback, useMemo, useState } from "react";

import { Chat } from "./components/Chat";
import { ConfigPanel } from "./components/ConfigPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { McpToolsPanel } from "./components/McpToolsPanel";
import { CappyLogo } from "./components/CappyLogo";
import { CAPPY_NEW_SESSION_EVENT } from "./lib/session-events";
import { getBridge } from "./lib/vscode-bridge";
import { cappyPalette } from "./theme";
import styles from "./App.module.css";

type PanelKey = "config" | "mcp" | "history" | "chat";

const bridge = getBridge();

const NAV_ITEMS: {
  id: PanelKey;
  label: string;
  icon: JSX.Element;
}[] = [
  {
    id: "chat",
    label: "Chat",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.5V16h-.3A2.5 2.5 0 0 1 4 13.5Z" />
      </svg>
    ),
  },
  {
    id: "config",
    label: "Config",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Z" />
        <path d="m4.8 13.4l-1.3.7l.7 2.1l1.5-.1a7.8 7.8 0 0 0 1.1 1.2l-.2 1.5l2 .8l.8-1.3c.5.1 1 .2 1.6.2l.8 1.3l2-.8l-.2-1.5c.4-.3.8-.7 1.1-1.2l1.5.1l.7-2.1l-1.3-.7c0-.3.1-.6.1-.9s0-.6-.1-.9l1.3-.7l-.7-2.1l-1.5.1a7.8 7.8 0 0 0-1.1-1.2l.2-1.5l-2-.8l-.8 1.3a8.1 8.1 0 0 0-1.6 0l-.8-1.3l-2 .8l.2 1.5c-.4.3-.8.7-1.1 1.2l-1.5-.1l-.7 2.1l1.3.7c0 .3-.1.6-.1.9s0 .6.1.9Z" />
      </svg>
    ),
  },
  {
    id: "mcp",
    label: "MCP",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
        <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
        <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
        <path d="M17.3 14v2.7H14.6v1.6h2.7V21h1.6v-2.7h2.7v-1.6h-2.7V14Z" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "Histórico",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
        <path d="M4.5 5.5v4.3h4.3" />
        <path d="M12 8.5v4.2l2.7 1.8" />
      </svg>
    ),
  },
];

export default function App(): JSX.Element {
  const [activePanel, setActivePanel] = useState<PanelKey>("chat");
  const isExtension = useMemo(() => typeof window.acquireVsCodeApi === "function", []);
  const shellClassName = [styles.shell, isExtension ? styles.shellExtension : styles.shellBrowser].filter(Boolean).join(" ");

  /**
   * Nova sessão: na extensão dispara reload do webview; no dev (cli-mock) recebe-se `session:cleared`.
   */
  const handleNewSession = useCallback(() => {
    setActivePanel("chat");
    window.dispatchEvent(new CustomEvent(CAPPY_NEW_SESSION_EVENT));
    bridge.send({ type: "session:new" });
  }, []);

  return (
    <Box component="main" className={shellClassName}>
      <Box className={styles.frame ?? ""}>
        <Box
          component="header"
          className={styles.header ?? ""}
          style={{
            background: cappyPalette.bgBase,
            borderBottom: `1px solid ${cappyPalette.borderSubtle}`,
          }}
        >
          <Flex
            direction="row"
            align="center"
            justify="space-between"
            gap="md"
            px="md"
            py="sm"
            wrap="nowrap"
            style={{ minWidth: 0 }}
          >
            <Group gap="sm" wrap="nowrap" align="center" style={{ minWidth: 0, flexShrink: 1 }}>
              <CappyLogo size={36} />
              <Text component="h1" size="sm" fw={700} lh={1.2} truncate>
                Cappy
              </Text>
            </Group>

            <Group
              component="nav"
              gap={4}
              wrap="nowrap"
              justify="flex-end"
              align="center"
              aria-label="Navegação e sessão"
              style={{ flexShrink: 0 }}
            >
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <ActionIcon
                    type="button"
                    variant="subtle"
                    color="gray"
                    size="lg"
                    radius="md"
                    aria-label="Mais opções"
                    title="Mais opções"
                    styles={{
                      root: { color: cappyPalette.textPrimary },
                      icon: { color: cappyPalette.textPrimary },
                    }}
                  >
                    <span className={styles.overflowGlyph} aria-hidden>
                      ⋯
                    </span>
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {NAV_ITEMS.map((item) => (
                    <Menu.Item
                      key={item.id}
                      leftSection={<span className={styles.navIcon}>{item.icon}</span>}
                      onClick={() => setActivePanel(item.id)}
                    >
                      {item.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>

              <ActionIcon
                type="button"
                variant="subtle"
                color="gray"
                size="lg"
                radius="md"
                aria-label="Nova sessão"
                title="Nova sessão"
                onClick={handleNewSession}
                styles={{
                  root: { color: cappyPalette.textPrimary },
                  icon: { color: cappyPalette.textPrimary },
                }}
              >
                <span className={styles.navIcon}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </ActionIcon>
            </Group>
          </Flex>
        </Box>

        <Box className={styles.content ?? ""}>
          <div style={{ display: activePanel === "config" ? "contents" : "none" }}>
            <ConfigPanel />
          </div>
          <div style={{ display: activePanel === "mcp" ? "contents" : "none" }}>
            <McpToolsPanel />
          </div>
          <div style={{ display: activePanel === "history" ? "contents" : "none" }}>
            <HistoryPanel />
          </div>
          <div style={{ display: activePanel === "chat" ? "contents" : "none" }}>
            <Chat />
          </div>
        </Box>
      </Box>
    </Box>
  );
}
