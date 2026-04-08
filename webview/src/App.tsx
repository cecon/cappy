import { useMemo, useState } from "react";

import { Chat } from "./components/Chat";
import { ConfigPanel } from "./components/ConfigPanel";
import styles from "./App.module.css";

/**
 * Root app for webview scaffold.
 */
export default function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<"chat" | "config">("chat");

  const environmentLabel = useMemo(() => {
    return typeof window.acquireVsCodeApi === "function" ? "VS Code" : "Browser + cli-mock";
  }, []);

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Cappy</h1>
      <p className={styles.environment}>Ambiente detectado: {environmentLabel}</p>

      <nav className={styles.tabs} aria-label="Navegação principal">
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "chat" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "config" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("config")}
        >
          Config
        </button>
      </nav>

      <div className={activeTab === "chat" ? styles.panelVisible : styles.panelHidden}>
        <Chat />
      </div>
      <div className={activeTab === "config" ? styles.panelVisible : styles.panelHidden}>
        <ConfigPanel />
      </div>
    </main>
  );
}
