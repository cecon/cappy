import type { ToolCall } from "../lib/types";
import styles from "./ToolConfirmCard.module.css";

interface ToolConfirmCardProps {
  toolCall: ToolCall;
  onApprove: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
}

/**
 * HITL confirmation card before tool execution.
 */
export function ToolConfirmCard({
  toolCall,
  onApprove,
  onReject,
}: ToolConfirmCardProps): JSX.Element {
  const commandPreview = getCommandPreview(toolCall);

  return (
    <div className={styles.card}>
      <span className={styles.toolName}>{toolCall.name.toUpperCase()}</span>
      <pre className={styles.arguments}>{`$ ${commandPreview}`}</pre>
      <div className={styles.actions}>
        <button onClick={() => onApprove(toolCall.id)} type="button" className={styles.approve}>
          Aprovar
        </button>
        <button onClick={() => onReject(toolCall.id)} type="button" className={styles.reject}>
          Rejeitar
        </button>
      </div>
    </div>
  );
}

/**
 * Builds one readable command preview from tool args.
 */
function getCommandPreview(toolCall: ToolCall): string {
  const rawCommand = toolCall.arguments.command;
  if (typeof rawCommand === "string" && rawCommand.trim().length > 0) {
    return rawCommand.trim();
  }
  return JSON.stringify(toolCall.arguments);
}
