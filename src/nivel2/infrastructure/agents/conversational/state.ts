/**
 * @fileoverview Conversational Agent State
 * @module agents/conversational/state
 */

import type { BaseAgentState } from '../../../common/state';

/**
 * State for conversational interactions (greetings, smalltalk)
 */
export interface ConversationalState extends BaseAgentState {
  /**
   * Conversational response
   */
  response?: string;
}
