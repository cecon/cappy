import { getBridge } from "../lib/vscode-bridge";
import styles from "./HistoryPanel.module.css";

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
    <section className={styles.container}>
      <h2 className={styles.title}>Histórico</h2>
      <ul className={styles.list}>
        {MOCK_SESSIONS.map((session) => (
          <li key={session.sessionId}>
            <button type="button" className={styles.item} onClick={() => handleLoadHistory(session.sessionId)}>
              <span className={styles.itemTitle}>{session.title}</span>
              <span className={styles.itemMeta}>
                {session.relativeDate} · {session.messageCount} mensagens
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
