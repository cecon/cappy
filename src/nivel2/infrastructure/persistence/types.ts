/**
 * @fileoverview Persistence Types - Core types for state persistence
 * @module persistence/types
 */

/**
 * Message stored in conversation history
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  /** Index in API conversation history */
  conversationHistoryIndex?: number;
  /** Metadata for the message */
  metadata?: Record<string, unknown>;
}

/**
 * Task metadata stored in history
 */
export interface TaskHistoryItem {
  id: string;
  ulid: string;
  ts: number;
  task: string;
  tokensIn: number;
  tokensOut: number;
  totalCost: number;
  conversationHistoryDeletedRange?: [number, number];
  checkpointHash?: string;
  isFavorited?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Task state stored on disk
 */
export interface TaskState {
  taskId: string;
  ulid: string;
  messages: AgentMessage[];
  conversationHistoryDeletedRange?: [number, number];
  checkpointManagerErrorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
  hash: string;
  timestamp: number;
  messageIndex: number;
  description?: string;
}
