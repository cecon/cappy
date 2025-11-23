/**
 * @fileoverview Refiner Agent State
 * @module agents/refiner/state
 */

import type { BaseAgentState } from '../common/state';

export interface RefinerState extends BaseAgentState {
  /** Original plan */
  originalPlan?: string;
  
  /** Issues from critic */
  issues?: string[];
  
  /** Suggestions from critic */
  suggestions?: string[];
  
  /** Critiques to address */
  critiques?: string[];
  
  /** Refined plan */
  refinedPlan?: string;
}

export function createRefinerState(sessionId: string): RefinerState {
  return {
    sessionId,
    messages: [],
    phase: 'refinement-plan',
    awaitingUser: false
  };
}
