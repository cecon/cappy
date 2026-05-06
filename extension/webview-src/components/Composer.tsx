import { useEffect, useRef, useState } from "react";

import type { MentionRef, WebviewSettings } from "../../src/chat/protocol.js";

interface Props {
  settings: WebviewSettings;
  pendingMention: MentionRef | null;
  onMentionConsumed: () => void;
  focusToken: number;
  onSend: (text: string, mentions: MentionRef[]) => void;
  disabled: boolean;
}

export function Composer(props: Props): JSX.Element {
  const { settings, pendingMention, onMentionConsumed, focusToken, onSend, disabled } = props;
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<MentionRef[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    if (!pendingMention) return;
    const tag = `@${pendingMention.label}${
      pendingMention.range
        ? `:${pendingMention.range.startLine}-${pendingMention.range.endLine}`
        : ""
    } `;
    setText((prev) => (prev.endsWith(" ") || prev.length === 0 ? prev + tag : `${prev} ${tag}`));
    setMentions((prev) => [...prev, pendingMention]);
    onMentionConsumed();
    taRef.current?.focus();
  }, [pendingMention, onMentionConsumed]);

  const submit = (): void => {
    if (disabled) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed, mentions);
    setText("");
    setMentions([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== "Enter") return;
    const sendCombo = settings.useCtrlEnterToSend
      ? e.ctrlKey || e.metaKey
      : !e.shiftKey;
    if (!sendCombo) return;
    e.preventDefault();
    submit();
  };

  return (
    <form
      className="cappy-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={taRef}
        className="cappy-composer-input"
        placeholder={
          disabled
            ? "Cappy is working… click stop to interrupt."
            : settings.useCtrlEnterToSend
              ? "Ask Cappy… (Ctrl/Cmd+Enter to send)"
              : "Ask Cappy… (Enter to send, Shift+Enter for newline)"
        }
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <div className="cappy-composer-row">
        <span className="cappy-dim">
          {mentions.length > 0
            ? `${mentions.length} mention${mentions.length === 1 ? "" : "s"}`
            : ""}
        </span>
        <button
          type="submit"
          className="cappy-send-button"
          disabled={disabled || text.trim().length === 0}
        >
          Send
          <span className="codicon codicon-send" />
        </button>
      </div>
    </form>
  );
}
