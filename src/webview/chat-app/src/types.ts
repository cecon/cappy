export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  streaming?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentContextItem {
  type: 'file' | 'task' | 'project' | 'search' | 'prevention';
  name: string;
  data: unknown;
}

export interface AgentTool {
  name: string;
  displayName: string;
  icon: string;
  description: string;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'local' | 'azure';
  available: boolean;
}

export interface StreamingState {
  active: boolean;
  messageId?: string;
  fullText: string;
}
