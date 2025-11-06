/**
 * Tool Call Confirmation Types
 * Tipos compartilhados para o sistema de confirmação de ferramentas
 */

export interface PendingToolCall {
  messageId: string;
  toolName: string;
  args: Record<string, unknown>;
  question: string;
  resolver: (approved: boolean) => void;
}

export interface PendingTextPrompt {
  messageId: string;
  question: string;
  suggestions?: string[];
  resolver: (response: string) => void;
}

export interface ToolCallActions {
  approveToolCall: (messageId: string) => void;
  denyToolCall: (messageId: string) => void;
}

export interface TextPromptActions {
  respondToPrompt: (messageId: string, response: string) => void;
}
