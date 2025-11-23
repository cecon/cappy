/**
 * @fileoverview Intention Agent - Understands user intent
 * @module agents/intention/state
 */

import type { BaseAgentState } from '../common/state';

export interface IntentionState extends BaseAgentState {
  /** User's original request */
  userRequest?: string;
  
  /** Classified intent */
  intent?: 'task' | 'question' | 'smalltalk' | 'unknown';
  
  /** Summary of what was understood */
  summary?: string;
}

export function createIntentionState(sessionId: string): IntentionState {
  return {
    sessionId,
    messages: [],
    phase: 'intention',
    awaitingUser: false
  };
}
