/**
 * @fileoverview Conversational Agent State
 * @module agents/brain/agents/conversational/state
 */

import type { BaseAgentState } from '../../../common/state';

/**
 * State for conversational interactions (greetings, smalltalk)
 */
export interface ConversationalState extends BaseAgentState {
  /**
   * Type of conversation detected
   */
  conversationType?: 'greeting' | 'thanks' | 'goodbye' | 'question' | 'general';
  
  /**
   * Conversational response
   */
  response?: string;
}
