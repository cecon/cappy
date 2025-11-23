/**
 * @fileoverview Critic Agent State
 * @module agents/critic/state
 */

import type { BaseAgentState } from '../common/state';

export interface CriticState extends BaseAgentState {
  /** Plan to critique */
  plan?: string;
  
  /** Identified issues */
  issues?: string[];
  
  /** Suggestions for improvement */
  suggestions?: string[];
  
  /** Approval status */
  approved?: boolean;
}

export function createCriticState(sessionId: string): CriticState {
  return {
    sessionId,
    messages: [],
    phase: 'critique',
    awaitingUser: false
  };
}
