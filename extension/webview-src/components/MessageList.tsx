import { useEffect, useRef } from "react";

import type { ChatMessage, ToolCall } from "../../src/chat/protocol.js";

interface Props {
  messages: ChatMessage[];
  streamingId: string | null;
}

export function MessageList({ messages, streamingId }: Props): JSX.Element {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div ref={scroller} className="cappy-messages">
      {messages.map((m) => (
        <Message
          key={m.id}
          message={m}
          isStreaming={streamingId === m.id}
        />
      ))}
    </div>
  );
}

function Message({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}): JSX.Element {
  return (
    <article className={`cappy-message cappy-message--${message.role}`}>
      <div className="cappy-message-role">
        {roleLabel(message.role)}
        {isStreaming ? <span className="cappy-typing-dot" /> : null}
      </div>
      {message.text ? (
        <div className="cappy-message-body">{message.text}</div>
      ) : null}
      {message.toolCalls && message.toolCalls.length > 0 ? (
        <ul className="cappy-tool-list">
          {message.toolCalls.map((tc) => (
            <ToolRow key={tc.id} call={tc} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ToolRow({ call }: { call: ToolCall }): JSX.Element {
  const result =
    typeof call.input === "object" && call.input !== null
      ? (call.input as { __result?: { ok: boolean; output?: unknown; error?: string } }).__result
      : undefined;
  const status = result === undefined ? "pending" : result.ok ? "ok" : "error";
  return (
    <li className={`cappy-tool cappy-tool--${status}`}>
      <span
        className={`codicon ${
          status === "ok"
            ? "codicon-check"
            : status === "error"
              ? "codicon-error"
              : "codicon-loading codicon-modifier-spin"
        }`}
      />
      <span className="cappy-tool-name">{call.name}</span>
      <span className="cappy-tool-preview">{previewArgs(call.input)}</span>
    </li>
  );
}

function previewArgs(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const obj = input as Record<string, unknown>;
  for (const key of ["command", "path", "pattern", "query", "url", "name"]) {
    const val = obj[key];
    if (typeof val === "string" && val.length > 0) {
      return `${key}: ${val.length > 60 ? `${val.slice(0, 60)}…` : val}`;
    }
  }
  return "";
}

function roleLabel(role: ChatMessage["role"]): string {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Cappy";
    case "tool":
      return "Tool";
    case "system":
      return "System";
  }
}
