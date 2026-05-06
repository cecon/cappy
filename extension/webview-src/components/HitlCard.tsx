import type { ToolCall } from "../../src/chat/protocol.js";

interface Props {
  tool: ToolCall;
  onDecide: (approved: boolean) => void;
}

export function HitlCard({ tool, onDecide }: Props): JSX.Element {
  return (
    <aside className="cappy-hitl">
      <div className="cappy-hitl-head">
        <span className="codicon codicon-warning" />
        <span>Approve tool call?</span>
      </div>
      <div className="cappy-hitl-body">
        <div className="cappy-hitl-tool-name">{tool.name}</div>
        <pre className="cappy-hitl-input">
          {safeStringify(tool.input)}
        </pre>
      </div>
      <div className="cappy-hitl-actions">
        <button
          type="button"
          className="cappy-button cappy-button--secondary"
          onClick={() => onDecide(false)}
        >
          Reject
        </button>
        <button
          type="button"
          className="cappy-button"
          onClick={() => onDecide(true)}
        >
          Approve
        </button>
      </div>
    </aside>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
