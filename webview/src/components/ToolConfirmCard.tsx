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
  const formattedArguments = JSON.stringify(toolCall.arguments, null, 2);

  return (
    <div className={styles.card}>
      <span className={styles.toolName}>{toolCall.name}</span>
      <pre className={styles.arguments}>{formattedArguments}</pre>
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
