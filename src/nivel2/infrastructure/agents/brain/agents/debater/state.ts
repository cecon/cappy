/**
 * @fileoverview Debater Agent State
 * @module agents/brain/agents/debater/state
 */

import type { BaseAgentState } from '../../../common/state';

export interface DebaterState extends BaseAgentState {
  /** Research summary */
  summary?: string;
  
  /** Alternatives to discuss */
  alternatives?: string[];
  
  /** Debate results */
  recommendation?: string;
  
  /** Pros and cons */
  analysis?: {
    pros: string[];
    cons: string[];
  };
}

export function createDebaterState(sessionId: string): DebaterState {
  return {
    sessionId,
    messages: [],
    phase: 'debate',
    awaitingUser: false
  };
}
