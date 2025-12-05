/**
 * @fileoverview Common state management for the Intelligent Agent system
 * @module agents/common/state
 */

import type { AgentMessage } from './types';

/**
 * Base state shared across all agents
 */
export interface BaseAgentState {
  /** Unique session identifier */
  sessionId: string;
  
  /** Current conversation messages */
  messages: AgentMessage[];
  
  /** Current phase of planning */
  phase: string;
  
  /** Whether awaiting user input */
  awaitingUser: boolean;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Supervisor state - simplified for conversational-only mode
 */
export interface SupervisorState extends BaseAgentState {
  /** Current active agent (always 'conversational') */
  currentAgent: string | null;
}
