/**
 * @fileoverview Supervisor agent - orchestrates all specialized agents
 * @module agents/supervisor/state
 */

import type { SupervisorState } from '../common/state';

export type { SupervisorState };

/**
 * Creates initial supervisor state
 */
export function createSupervisorState(sessionId: string): SupervisorState {
  return {
    sessionId,
    messages: [],
    phase: 'conversational', // Start conversational-first
    awaitingUser: false,
    currentAgent: null,
    metadata: {}
  };
}
