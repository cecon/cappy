/**
 * @fileoverview Researcher Agent State
 * @module agents/brain/agents/researcher/state
 */

import type { BaseAgentState } from '../../../common/state';

export interface ResearcherState extends BaseAgentState {
  /** Search queries */
  queries?: string[];
  
  /** Research findings */
  findings?: Array<{
    source: string;
    content: string;
    relevance: number;
  }>;
}

export function createResearcherState(sessionId: string): ResearcherState {
  return {
    sessionId,
    messages: [],
    phase: 'research',
    awaitingUser: false,
    findings: []
  };
}
