import type { SessionMeta } from "../../src/chat/protocol.js";

interface Props {
  sessions: SessionMeta[];
  currentSessionId: string | null;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onClose: () => void;
}

export function SessionsPanel({
  sessions,
  currentSessionId,
  onResume,
  onDelete,
  onClose,
}: Props): JSX.Element {
  return (
    <aside
      className="cappy-sessions-panel"
      role="dialog"
      aria-label="Past conversations"
    >
      <header className="cappy-sessions-head">
        <span>Past conversations</span>
        <button
          type="button"
          className="cappy-icon-button"
          title="Close"
          onClick={onClose}
        >
          <span className="codicon codicon-close" />
        </button>
      </header>
      {sessions.length === 0 ? (
        <p className="cappy-sessions-empty cappy-dim">
          No saved sessions yet. Send a message to start one.
        </p>
      ) : (
        <ul className="cappy-sessions-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={`cappy-session-item${
                s.id === currentSessionId ? " cappy-session-item--active" : ""
              }`}
            >
              <button
                type="button"
                className="cappy-session-row"
                onClick={() => onResume(s.id)}
                title={s.id}
              >
                <span className="cappy-session-title">{s.title || s.id}</span>
                <span className="cappy-session-meta">
                  {formatDate(s.updatedAt)} · {s.messageCount} msg
                </span>
              </button>
              <button
                type="button"
                className="cappy-icon-button"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
              >
                <span className="codicon codicon-trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
