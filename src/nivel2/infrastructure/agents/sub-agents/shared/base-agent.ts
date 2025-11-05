/**
 * @fileoverview Base class for sub-agents with common functionality
 * @module sub-agents/shared/base-agent
 */

import type { SubAgent, SubAgentContext, SubAgentResponse } from './types'

/**
 * Abstract base class for sub-agents
 * Provides common functionality and enforces interface
 */
export abstract class BaseSubAgent implements SubAgent {
  abstract readonly name: string
  abstract readonly priority: number
  
  /**
   * Determines if this agent can handle the given context
   */
  abstract canHandle(context: SubAgentContext): boolean | Promise<boolean>
  
  /**
   * Process the context and generate a response
   */
  abstract process(context: SubAgentContext): Promise<SubAgentResponse>
  
  /**
   * Helper: Create a response object
   */
  protected createResponse(
    content: string,
    needsMoreInfo: boolean = false,
    nextAgent?: string
  ): SubAgentResponse {
    return {
      content,
      needsMoreInfo,
      nextAgent,
      metadata: {
        agentName: this.name,
        processingTime: Date.now()
      }
    }
  }
  
  /**
   * Helper: Log agent activity
   */
  protected log(message: string, ...args: any[]): void {
    console.log(`[${this.name}]`, message, ...args)
  }
  
  /**
   * Helper: Detect if message is a simple greeting
   */
  protected isGreeting(message: string): boolean {
    const cleanMessage = message.trim().toLowerCase()
    const greetings = ['oi', 'ola', 'olá', 'hello', 'hi', 'hey', 'hola', 'bom dia', 'boa tarde', 'boa noite']
    const withoutPunctuation = cleanMessage.replace(/[.!?]+$/, '')
    return greetings.includes(withoutPunctuation)
  }
  
  /**
   * Helper: Calculate clarity score from intent
   */
  protected getClarityScore(context: SubAgentContext): number {
    return context.intent?.clarityScore ?? 0
  }
}
