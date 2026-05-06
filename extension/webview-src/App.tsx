import { useEffect, useState } from "react";

import type {
  ChatMessage,
  HostToWebview,
  MentionRef,
  SessionMeta,
  ToolCall,
  WebviewSettings,
} from "../src/chat/protocol.js";

import { Composer } from "./components/Composer.js";
import { HitlCard } from "./components/HitlCard.js";
import { MessageList } from "./components/MessageList.js";
import { SessionsPanel } from "./components/SessionsPanel.js";
import { onHostMessage, postToHost } from "./vscodeApi.js";

const DEFAULT_SETTINGS: WebviewSettings = {
  useCtrlEnterToSend: false,
  preferredLocation: "sidebar",
  permissionMode: "confirm_each",
};

interface PendingHitl {
  toolCallId: string;
  tool: ToolCall;
}

export function App(): JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<WebviewSettings>(DEFAULT_SETTINGS);
  const [pendingMention, setPendingMention] = useState<MentionRef | null>(null);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [pendingHitl, setPendingHitl] = useState<PendingHitl | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  useEffect(() => {
    const off = onHostMessage((msg: HostToWebview) => {
      switch (msg.type) {
        case "init":
          setSessionId(msg.sessionId);
          setSessions(msg.sessions);
          setSettings(msg.settings);
          return;
        case "settings.update":
          setSettings(msg.settings);
          return;
        case "session.opened":
          setSessionId(msg.sessionId);
          setMessages(msg.history);
          setStreamingMessageId(null);
          setPendingHitl(null);
          setSessionsOpen(false);
          return;
        case "session.list":
          setSessions(msg.sessions);
          return;
        case "stream.start":
          setStreamingMessageId(msg.messageId);
          setMessages((prev) => [
            ...prev,
            {
              id: msg.messageId,
              role: "assistant",
              text: "",
              createdAt: Date.now(),
              toolCalls: [],
            },
          ]);
          return;
        case "stream.delta":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.messageId ? { ...m, text: m.text + msg.text } : m,
            ),
          );
          return;
        case "stream.tool":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.messageId
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), msg.tool] }
                : m,
            ),
          );
          return;
        case "stream.toolResult":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.messageId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls ?? []).map((tc) =>
                      tc.id === msg.result.id
                        ? { ...tc, input: { ...(tc.input as object), __result: msg.result } }
                        : tc,
                    ),
                  }
                : m,
            ),
          );
          return;
        case "stream.end":
          setStreamingMessageId(null);
          return;
        case "hitl.request":
          setPendingHitl({ toolCallId: msg.toolCallId, tool: msg.tool });
          return;
        case "command.newConversation":
          setSessionId(null);
          setMessages([]);
          setStreamingMessageId(null);
          setPendingHitl(null);
          return;
        case "command.focus":
          setComposerFocusToken((n) => n + 1);
          return;
        case "command.insertAtMention":
          setPendingMention(msg.ref);
          setComposerFocusToken((n) => n + 1);
          return;
        case "error":
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "system",
              text: msg.message,
              createdAt: Date.now(),
            },
          ]);
          setStreamingMessageId(null);
          return;
        default:
          return;
      }
    });
    postToHost({ type: "ready" });
    return off;
  }, []);

  const handleSend = (text: string, mentions: MentionRef[]): void => {
    const id = `u-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id, role: "user", text, createdAt: Date.now() },
    ]);
    postToHost({ type: "user.message", sessionId, text, mentions });
  };

  const handleNewConversation = (): void => {
    postToHost({ type: "session.new" });
    setSessionId(null);
    setMessages([]);
    setStreamingMessageId(null);
    setPendingHitl(null);
  };

  const handleAbort = (): void => {
    if (sessionId !== null) {
      postToHost({ type: "abort", sessionId });
    } else {
      postToHost({ type: "abort", sessionId: "" });
    }
  };

  const handleHitlDecision = (approved: boolean): void => {
    if (!pendingHitl) return;
    postToHost({
      type: "hitl.response",
      toolCallId: pendingHitl.toolCallId,
      approved,
    });
    setPendingHitl(null);
  };

  const openSessions = (): void => {
    postToHost({ type: "session.list" });
    setSessionsOpen(true);
  };

  const handleResumeSession = (id: string): void => {
    postToHost({ type: "session.resume", sessionId: id });
  };

  const handleDeleteSession = (id: string): void => {
    postToHost({ type: "session.delete", sessionId: id });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === sessionId) {
      setSessionId(null);
      setMessages([]);
    }
  };

  return (
    <div className="cappy-shell">
      <header className="cappy-header">
        <div className="cappy-header-title">
          <span className="codicon codicon-comment-discussion" />
          <span>Cappy</span>
          {sessionId ? <span className="cappy-session-id">{sessionId}</span> : null}
        </div>
        <div className="cappy-header-actions">
          {streamingMessageId ? (
            <button
              type="button"
              className="cappy-icon-button"
              title="Stop"
              onClick={handleAbort}
            >
              <span className="codicon codicon-debug-stop" />
            </button>
          ) : null}
          <button
            type="button"
            className="cappy-icon-button"
            title="New chat"
            onClick={handleNewConversation}
          >
            <span className="codicon codicon-add" />
          </button>
          <button
            type="button"
            className="cappy-icon-button"
            title="Past conversations"
            onClick={openSessions}
          >
            <span className="codicon codicon-history" />
          </button>
        </div>
      </header>
      <main className="cappy-main">
        {messages.length === 0 ? (
          <EmptyState count={sessions.length} />
        ) : (
          <MessageList messages={messages} streamingId={streamingMessageId} />
        )}
        {pendingHitl ? (
          <HitlCard tool={pendingHitl.tool} onDecide={handleHitlDecision} />
        ) : null}
        {sessionsOpen ? (
          <SessionsPanel
            sessions={sessions}
            currentSessionId={sessionId}
            onResume={handleResumeSession}
            onDelete={handleDeleteSession}
            onClose={() => setSessionsOpen(false)}
          />
        ) : null}
      </main>
      <footer className="cappy-footer">
        <Composer
          settings={settings}
          pendingMention={pendingMention}
          onMentionConsumed={() => setPendingMention(null)}
          focusToken={composerFocusToken}
          onSend={handleSend}
          disabled={streamingMessageId !== null || pendingHitl !== null}
        />
      </footer>
    </div>
  );
}

function EmptyState({ count }: { count: number }): JSX.Element {
  return (
    <div className="cappy-empty">
      <h2>What can I help you build?</h2>
      <p>
        Type a message below. Use <kbd>@</kbd> to mention files, <kbd>Alt</kbd>+<kbd>K</kbd>{" "}
        to insert the current selection.
      </p>
      {count > 0 ? (
        <p className="cappy-dim">
          {count} previous session{count === 1 ? "" : "s"} available.
        </p>
      ) : null}
    </div>
  );
}
