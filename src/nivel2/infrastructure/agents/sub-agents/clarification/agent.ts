/**
 * @fileoverview Clarification agent - handles unclear requests
 * @module sub-agents/clarification/agent
 */

import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse } from '../shared/types'
import { buildClarificationPrompt, buildClarificationWithOptions, GENERIC_CLARIFICATION } from './prompts'

/**
 * ClarificationAgent
 * 
 * Handles requests that are unclear or vague
 * Asks for more information without looping
 * 
 * Priority: 90 (high - check before analysis)
 */
export class ClarificationAgent extends BaseSubAgent {
  readonly name = 'ClarificationAgent'
  readonly priority = 90
  
  private readonly CLARITY_THRESHOLD = 0.5
  
  /**
   * Can handle if clarity score is low
   */
  canHandle(context: SubAgentContext): boolean {
    const clarityScore = this.getClarityScore(context)
    const needsClarification = clarityScore < this.CLARITY_THRESHOLD
    
    if (needsClarification) {
      this.log(`✅ Low clarity score (${clarityScore}), needs clarification`)
    }
    
    return needsClarification
  }
  
  /**
   * Process unclear request - ask for clarification ONCE
   */
  async process(context: SubAgentContext): Promise<SubAgentResponse> {
    this.log('Asking for clarification...')
    
    const { userMessage, intent } = context
    let clarificationMessage: string
    
    if (!intent) {
      // No intent extracted - generic clarification
      clarificationMessage = GENERIC_CLARIFICATION
    } else if (intent.ambiguities && intent.ambiguities.length > 0) {
      // Has specific ambiguities - mention them
      clarificationMessage = buildClarificationPrompt(userMessage, Array.from(intent.ambiguities))
    } else {
      // Has category but unclear - offer options
      clarificationMessage = buildClarificationWithOptions(userMessage, intent.category)
    }
    
    this.log('Clarification message prepared')
    
    return this.createResponse(
      clarificationMessage,
      true, // needs more info
      'AnalysisAgent' // next agent to handle clarified request
    )
  }
}
