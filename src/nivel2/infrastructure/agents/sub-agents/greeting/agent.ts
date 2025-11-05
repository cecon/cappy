/**
 * @fileoverview Greeting agent - handles simple greetings
 * @module sub-agents/greeting/agent
 */

import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse } from '../shared/types'
import { GREETING_RESPONSE } from './prompts'

/**
 * GreetingAgent
 * 
 * Handles simple greetings like "hi", "hello", "ola"
 * Returns a welcoming message and stops processing
 * 
 * Priority: 100 (highest - check first)
 */
export class GreetingAgent extends BaseSubAgent {
  readonly name = 'GreetingAgent'
  readonly priority = 100
  
  /**
   * Can handle if message is a simple greeting
   */
  canHandle(context: SubAgentContext): boolean {
    const isSimpleGreeting = this.isGreeting(context.userMessage)
    
    if (isSimpleGreeting) {
      this.log('✅ Detected simple greeting:', context.userMessage)
    }
    
    return isSimpleGreeting
  }
  
  /**
   * Process greeting - return welcoming message
   */
  async process(context: SubAgentContext): Promise<SubAgentResponse> {
    this.log('Processing greeting...')
    
    return this.createResponse(
      GREETING_RESPONSE,
      false // doesn't need more info
    )
  }
}
