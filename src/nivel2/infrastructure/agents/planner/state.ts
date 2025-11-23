/**
 * @fileoverview Planner Agent State
 * @module agents/planner/state
 */

import type { PlanningState } from '../common/state';

export type { PlanningState };

export function createPlannerState(sessionId: string): PlanningState {
  return {
    sessionId,
    messages: [],
    phase: 'planning',
    awaitingUser: false
  };
}
