import { useEffect, useMemo, useState } from "react";

import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type { McpTool } from "../lib/types";
import styles from "./McpToolsPanel.module.css";

const bridge = getBridge();
const DESTRUCTIVE_KEYWORDS = ["write", "delete", "remove", "create", "execute", "run"] as const;

/**
 * Lists MCP tools grouped by server and flagged by risk profile.
 */
export function McpToolsPanel(): JSX.Element {
  const [tools, setTools] = useState<McpTool[]>([]);

  useEffect(() => {
    bridge.onMessage((message: IncomingMessage) => {
      if (message.type === "mcp:tools") {
        setTools(message.tools);
      }
    });

    bridge.send({ type: "mcp:list" });
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
    <section className={styles.container}>
      <h2 className={styles.title}>Tools MCP</h2>
      {serverNames.length === 0 ? <p className={styles.empty}>Nenhuma tool MCP disponível.</p> : null}

      {serverNames.map((serverName) => (
        <article key={serverName} className={styles.serverCard}>
          <h3 className={styles.serverName}>{serverName}</h3>
          <ul className={styles.toolList}>
            {(groupedTools[serverName] ?? []).map((tool) => {
              const destructive = isDestructiveTool(tool.name);
              return (
                <li key={`${tool.serverName}__${tool.name}`} className={styles.toolItem}>
                  <div className={styles.toolHeader}>
                    <strong className={styles.toolName}>{tool.name}</strong>
                    <span className={destructive ? styles.badgeDestructive : styles.badgeSafe}>
                      {destructive ? "Destrutiva" : "Segura"}
                    </span>
                  </div>
                  <p className={styles.toolDescription}>{tool.description || "Sem descrição."}</p>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </section>
  );
}

/**
 * Checks whether one tool name implies destructive behavior.
 */
function isDestructiveTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  return DESTRUCTIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
