/**
 * @fileoverview Executor Agent State
 * @module agents/executor/state
 */

import type { ExecutionState } from '../common/state';

export type { ExecutionState };

export function createExecutorState(sessionId: string): ExecutionState {
  return {
    sessionId,
    messages: [],
    phase: 'execution',
    awaitingUser: false,
    executionResults: [],
    deliverables: []
  };
}
