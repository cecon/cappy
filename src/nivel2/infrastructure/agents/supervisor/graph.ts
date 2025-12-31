/**
 * @fileoverview Supervisor graph - Conversational agent orchestrator
 * @module agents/supervisor/graph
 */

import type { SupervisorState } from './state';
import type { ProgressCallback } from '../common/types';
import { runConversationalAgent } from '../conversational/graph';

/**
 * Simple supervisor that delegates all work to conversational agent
 */
export function createSupervisorGraph(progressCallback?: ProgressCallback) {
  return {
    invoke: async (state: SupervisorState): Promise<SupervisorState> => {
      const currentState = { ...state };
      
      try {
        // Run conversational agent with thinking loop
        const result = await runConversationalAgent(
          currentState.messages,
          progressCallback
        );

        return {
          ...currentState,
          phase: 'completed',
          metadata: {
            ...currentState.metadata,
            response: result.response
          }
        };
        
      } catch (error) {
        console.error('❌ [Supervisor] Error:', error);
        return {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            error: error instanceof Error ? error.message : String(error)
          }
        };
      }
    }
  };
}
