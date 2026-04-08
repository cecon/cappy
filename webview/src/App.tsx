import { useMemo, useState } from "react";

import { Chat } from "./components/Chat";
import { ConfigPanel } from "./components/ConfigPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { McpToolsPanel } from "./components/McpToolsPanel";
import styles from "./App.module.css";

type PanelKey = "config" | "mcp" | "history" | "chat";

export default function App(): JSX.Element {
  const [activePanel, setActivePanel] = useState<PanelKey>("chat");
  const isExtension = useMemo(() => typeof window.acquireVsCodeApi === "function", []);

  return (
    <main className={`${styles.shell} ${isExtension ? styles.shellExtension : styles.shellBrowser}`}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandDot} aria-hidden="true" />
            <span className={styles.brandLabel}>Cappy</span>
          </div>
          <nav className={styles.navigation} aria-label="Navegação principal">
            <IconButton
              label="Config"
              isActive={activePanel === "config"}
              onClick={() => setActivePanel("config")}
              icon={
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Z" />
                  <path d="m4.8 13.4l-1.3.7l.7 2.1l1.5-.1a7.8 7.8 0 0 0 1.1 1.2l-.2 1.5l2 .8l.8-1.3c.5.1 1 .2 1.6.2l.8 1.3l2-.8l-.2-1.5c.4-.3.8-.7 1.1-1.2l1.5.1l.7-2.1l-1.3-.7c0-.3.1-.6.1-.9s0-.6-.1-.9l1.3-.7l-.7-2.1l-1.5.1a7.8 7.8 0 0 0-1.1-1.2l.2-1.5l-2-.8l-.8 1.3a8.1 8.1 0 0 0-1.6 0l-.8-1.3l-2 .8l.2 1.5c-.4.3-.8.7-1.1 1.2l-1.5-.1l-.7 2.1l1.3.7c0 .3-.1.6-.1.9s0 .6.1.9Z" />
                </svg>
              }
            />
            <IconButton
              label="MCP"
              isActive={activePanel === "mcp"}
              onClick={() => setActivePanel("mcp")}
              icon={
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
                  <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
                  <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
                  <path d="M17.3 14v2.7H14.6v1.6h2.7V21h1.6v-2.7h2.7v-1.6h-2.7V14Z" />
                </svg>
              }
            />
            <IconButton
              label="Histórico"
              isActive={activePanel === "history"}
              onClick={() => setActivePanel("history")}
              icon={
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
                  <path d="M4.5 5.5v4.3h4.3" />
                  <path d="M12 8.5v4.2l2.7 1.8" />
                </svg>
              }
            />
            <IconButton
              label="Chat"
              isActive={activePanel === "chat"}
              onClick={() => setActivePanel("chat")}
              icon={
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.5V16h-.3A2.5 2.5 0 0 1 4 13.5Z" />
                </svg>
              }
            />
          </nav>
        </header>

        <div className={styles.content}>
          {activePanel === "config" ? <ConfigPanel /> : null}
          {activePanel === "mcp" ? <McpToolsPanel /> : null}
          {activePanel === "history" ? <HistoryPanel /> : null}
          {activePanel === "chat" ? <Chat /> : null}
        </div>
      </div>
    </main>
  );
}

interface IconButtonProps {
  label: string;
  icon: JSX.Element;
  isActive: boolean;
  onClick: () => void;
}

function IconButton({ label, icon, isActive, onClick }: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${styles.iconButton} ${isActive ? styles.iconButtonActive : ""}`}
      onClick={onClick}
    >
      <span className={styles.iconGlyph}>{icon}</span>
      {isActive ? <span className={styles.activeDot} aria-hidden="true" /> : null}
    </button>
  );
}
