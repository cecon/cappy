/**
 * Tool Call Confirmation View
 * Componente visual para confirmação de execução de ferramentas
 */

import { CheckIcon, XIcon } from "lucide-react";
import type { PendingToolCall, ToolCallActions } from './types';

interface ToolCallConfirmationProps {
  pendingTool: PendingToolCall;
  actions: ToolCallActions;
}

export function ToolCallConfirmation({ 
  pendingTool, 
  actions 
}: ToolCallConfirmationProps) {
  const handleApprove = () => {
    actions.approveToolCall(pendingTool.messageId);
  };

  const handleDeny = () => {
    actions.denyToolCall(pendingTool.messageId);
  };

  return (
    <div className="my-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm mb-1">
            🔧 {pendingTool.toolName}
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {pendingTool.question}
          </div>
          {Object.keys(pendingTool.args).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View parameters
              </summary>
              <pre className="mt-2 overflow-auto max-h-32 p-2 rounded bg-muted">
                {JSON.stringify(pendingTool.args, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleApprove}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <CheckIcon className="size-3" />
          Allow
        </button>
        <button
          onClick={handleDeny}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <XIcon className="size-3" />
          Deny
        </button>
      </div>
    </div>
  );
}
