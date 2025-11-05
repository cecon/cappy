/**
 * @fileoverview Simplified chat engine using orchestrator pattern
 * @module chat-engine/orchestrated-chat-engine
 */

import * as vscode from 'vscode'
import type { ChatAgentPort } from '../../../../domains/chat/ports/agent-port'
import type { Message } from '../../../../domains/chat/entities/message'
import type { SubAgentContext, Intent } from '../sub-agents/shared/types'
import { OrchestratorAgent } from '../sub-agents/orchestrator/agent'
import { GreetingAgent } from '../sub-agents/greeting/agent'
import { ClarificationAgent } from '../sub-agents/clarification/agent'
import { AnalysisAgent } from '../sub-agents/analysis/agent'
import type { RetrieveContextUseCase } from '../../../../domains/retrieval/use-cases/retrieve-context-use-case'

/**
 * OrchestrationResult - Complete result from orchestration
 */
interface OrchestrationResult {
  content: string
  needsMoreInfo: boolean
  metadata: {
    agentName: string
    agentPriority: number
    processingTime: number
    [key: string]: unknown
  }
}

/**
 * OrchestratedChatEngine
 * 
 * Simplified chat engine that:
 * 1. Extracts intent from user message
 * 2. Delegates to OrchestratorAgent
 * 3. Streams response back to user
 * 
 * No loops, no complex phase management - just clean delegation.
 */
export class OrchestratedChatEngine implements ChatAgentPort {
  private readonly orchestrator: OrchestratorAgent
  private readonly retrieveContextUseCase?: RetrieveContextUseCase
  
  constructor(retrieveContextUseCase?: RetrieveContextUseCase) {
    this.retrieveContextUseCase = retrieveContextUseCase
    this.orchestrator = new OrchestratorAgent()
    
    // Register all sub-agents in priority order
    this.orchestrator.registerAgent(new GreetingAgent())
    this.orchestrator.registerAgent(new ClarificationAgent())
    this.orchestrator.registerAgent(new AnalysisAgent(retrieveContextUseCase))
    
    console.log('[OrchestratedChatEngine] Initialized with 3 sub-agents')
  }
  
  /**
   * Process user message and stream response
   */
  async *processMessage(message: Message): AsyncIterable<string> {
    try {
      console.log('[OrchestratedChatEngine] Processing message:', message.content)
      
      // Step 1: Extract intent (simple version - can be enhanced)
      const intent = await this.extractIntent(message.content)
      
      // Step 2: Build context
      const context: SubAgentContext = {
        userMessage: message.content,
        intent,
        history: [],
        sessionId: this.generateSessionId()
      }
      
      console.log('[OrchestratedChatEngine] Intent extracted:', {
        objective: intent?.objective,
        category: intent?.category,
        clarityScore: intent?.clarityScore
      })
      
      // Step 3: Orchestrate (single call - no loops!)
      const result = await this.orchestrator.orchestrate(context)
      
      console.log('[OrchestratedChatEngine] Orchestration complete:', {
        agent: result.metadata.agentName,
        priority: result.metadata.agentPriority,
        needsMoreInfo: result.needsMoreInfo
      })
      
      // Step 4: Stream response
      yield result.content
      
      // Log final state
      if (result.needsMoreInfo) {
        console.log('[OrchestratedChatEngine] ⏸️  Waiting for user clarification')
      } else {
        console.log('[OrchestratedChatEngine] ✅ Request completed')
      }
      
    } catch (error) {
      console.error('[OrchestratedChatEngine] Error:', error)
      yield `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
  
  /**
   * Extract intent from user message using LLM
   */
  private async extractIntent(userMessage: string): Promise<Intent | undefined> {
    try {
      // Get Copilot model
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      })
      
      if (models.length === 0) {
        console.warn('[OrchestratedChatEngine] No LLM available for intent extraction')
        return this.createFallbackIntent(userMessage)
      }
      
      const model = models[0]
      
      // Intent extraction prompt
      const prompt = `Extract the intent from this user message. Respond with JSON only:

User message: "${userMessage}"

Respond with this exact JSON structure (no markdown, no explanation):
{
  "objective": "what the user wants to do (1 sentence)",
  "technicalTerms": ["array", "of", "technical", "terms"],
  "category": "feature-implementation|bug-fix|refactoring|documentation|testing|architecture|greeting|clarification|general",
  "clarityScore": 0.0-1.0,
  "ambiguities": ["what", "is", "unclear"],
  "rawMessage": "${userMessage}"
}`

      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ]
      
      const request = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token)
      
      let response = ''
      for await (const fragment of request.stream) {
        if (fragment instanceof vscode.LanguageModelTextPart) {
          response += fragment.value
        }
      }
      
      // Parse JSON response
      const cleaned = this.cleanJsonResponse(response)
      const intent = JSON.parse(cleaned) as Intent
      
      console.log('[OrchestratedChatEngine] Intent extracted successfully')
      return intent
      
    } catch (error) {
      console.error('[OrchestratedChatEngine] Error extracting intent:', error)
      return this.createFallbackIntent(userMessage)
    }
  }
  
  /**
   * Clean JSON from LLM response (remove markdown, comments, etc)
   */
  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    
    // Remove comments
    cleaned = cleaned.replace(/\/\/.*$/gm, '')
    
    // Find JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return jsonMatch[0]
    }
    
    return cleaned.trim()
  }
  
  /**
   * Create fallback intent when extraction fails
   */
  private createFallbackIntent(userMessage: string): Intent {
    // Simple heuristic-based intent
    const lowerMessage = userMessage.toLowerCase()
    
    // Check for greetings
    if (/^(oi|ola|olá|hello|hi|hey|e ai|eai)\b/.test(lowerMessage)) {
      return {
        objective: 'User is greeting',
        technicalTerms: [],
        category: 'greeting',
        clarityScore: 1.0,
        ambiguities: [],
        rawMessage: userMessage
      }
    }
    
    // Check for vague requests
    if (userMessage.split(' ').length < 5) {
      return {
        objective: userMessage,
        technicalTerms: [],
        category: 'clarification',
        clarityScore: 0.3,
        ambiguities: ['Request is too vague'],
        rawMessage: userMessage
      }
    }
    
    // Default to general request
    return {
      objective: userMessage,
      technicalTerms: [],
      category: 'general',
      clarityScore: 0.6,
      ambiguities: [],
      rawMessage: userMessage
    }
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Handle user prompt response (for multi-turn conversations)
   */
  handleUserPromptResponse(messageId: string, response: string): void {
    console.log('[OrchestratedChatEngine] User response:', messageId, response)
    // TODO: Implement multi-turn conversation handling
  }
}
