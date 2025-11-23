/**
 * @fileoverview Brain Agent State - Coordinates research, summarization and debate
 * @module agents/brain/state
 */

import type { BrainState } from '../common/state';

export type { BrainState };

export function createBrainState(sessionId: string): BrainState {
  return {
    sessionId,
    messages: [],
    phase: 'research',
    awaitingUser: false,
    researchResults: [],
    summaries: [],
    debateConclusions: []
  };
}
