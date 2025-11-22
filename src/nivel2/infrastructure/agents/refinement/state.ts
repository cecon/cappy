/**
 * @fileoverview Refinement Agent State
 * @module agents/refinement/state
 */

import type { BaseAgentState } from '../common/state';

export interface RefinementState extends BaseAgentState {
  /** Original intent from intention agent */
  intent?: string;
  
  /** Refined requirements */
  requirements?: string[];
  
  /** Questions for user */
  questions?: string[];
  
  /** Clarifications received */
  clarifications?: Record<string, string>;
}

export function createRefinementState(sessionId: string): RefinementState {
  return {
    sessionId,
    messages: [],
    phase: 'refinement',
    awaitingUser: false,
    requirements: [],
    questions: []
  };
}
