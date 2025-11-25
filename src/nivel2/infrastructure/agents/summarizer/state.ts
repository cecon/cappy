/**
 * @fileoverview Summarizer Agent State
 * @module agents/summarizer/state
 */

import type { BaseAgentState } from '../common/state';

export interface SummarizerState extends BaseAgentState {
  /** Research findings to summarize */
  findings?: Array<{
    source: string;
    content: string;
    relevance: number;
  }>;
  
  /** Content to summarize */
  content?: string[];
  
  /** Generated summary */
  summary?: string;
}

export function createSummarizerState(sessionId: string): SummarizerState {
  return {
    sessionId,
    messages: [],
    phase: 'summarize',
    awaitingUser: false
  };
}
