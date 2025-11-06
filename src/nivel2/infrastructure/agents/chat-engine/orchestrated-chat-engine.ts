/**
 * @fileoverview Simplified chat engine using orchestrator pattern
 * @module chat-engine/orchestrated-chat-engine
 */

import * as vscode from 'vscode'
import type { ChatAgentPort, ChatContext } from '../../../../domains/chat/ports/agent-port'
import type { Message } from '../../../../domains/chat/entities/message'
import type { SubAgentContext, Intent } from '../sub-agents/shared/types'
import { OrchestratorAgent } from '../sub-agents/orchestrator/agent'
import { GreetingAgent } from '../sub-agents/greeting/agent'
import { ClarificationAgent } from '../sub-agents/clarification/agent'
import { PlanningAgent } from '../sub-agents/planning/agent'
// import { ContextOrganizerAgent } from '../sub-agents/context-organizer/agent' // DISABLED: blocks flow
import { AnalysisAgent } from '../sub-agents/analysis/agent'
import type { RetrieveContextUseCase } from '../../../../domains/retrieval/use-cases/retrieve-context-use-case'

/**
 * OrchestratedChatEngine
 * 
 * Simplified chat engine that:
 * 1. Extracts intent from user message
 * 2. Delegates to OrchestratorAgent
 * 3. Streams response back to user
 * 
 * Uses Assistant UI reasoning parts for thinking blocks.
 */
export class OrchestratedChatEngine implements ChatAgentPort {
  private orchestrator: OrchestratorAgent
  private readonly pendingToolApprovals: Map<string, (approved: boolean) => void> = new Map()
  private readonly pendingPromptResponses: Map<string, (response: string) => void> = new Map()
  
  constructor(retrieveContextUseCase?: RetrieveContextUseCase) {
    this.orchestrator = this.createOrchestrator(retrieveContextUseCase)
    console.log('[OrchestratedChatEngine] Initialized with 4 sub-agents (Greeting, Clarification, Planning, Analysis)')
  }
  
  /**
   * Create a new orchestrator with sub-agents
   */
  private createOrchestrator(retrieveContextUseCase?: RetrieveContextUseCase): OrchestratorAgent {
    const orchestrator = new OrchestratorAgent()
    orchestrator.registerAgent(new GreetingAgent())
    orchestrator.registerAgent(new ClarificationAgent())
    orchestrator.registerAgent(new PlanningAgent())
    // orchestrator.registerAgent(new ContextOrganizerAgent()) // DISABLED: blocks flow without executing retrieval
    orchestrator.registerAgent(new AnalysisAgent(retrieveContextUseCase))
    return orchestrator
  }
  
  /**
   * Update retrieval capability with a new use case
   */
  updateRetrievalCapability(retrieveContextUseCase: RetrieveContextUseCase): void {
    console.log('[OrchestratedChatEngine] Updating with new RetrieveContextUseCase')
    this.orchestrator = this.createOrchestrator(retrieveContextUseCase)
    console.log('[OrchestratedChatEngine] Orchestrator updated with retrieval capability')
  }
  
  /**
   * Process user message and stream response with reasoning parts
   */
  async *processMessage(message: Message, context: ChatContext): AsyncIterable<string> {
    try {
      console.log('[OrchestratedChatEngine] Processing message:', message.content)
      
      // Step 1: Extract intent
      const intent = await this.extractIntent(message.content)
      
      // Step 2: Build sub-agent context with onPromptRequest
      const subAgentContext: SubAgentContext = {
        userMessage: message.content,
        intent,
        history: context.history || [],
        sessionId: context.sessionId,
        onPromptRequest: context.onPromptRequest ? async (prompt) => {
          // Create a promise that will be resolved when user responds
          const responsePromise = new Promise<string>((resolve) => {
            this.pendingPromptResponses.set(prompt.messageId, resolve)
          })
          
          // Convert SubAgent PromptRequest to domain UserPrompt and send to UI
          const userPrompt = {
            messageId: prompt.messageId,
            question: prompt.prompt,
            suggestions: prompt.suggestions,
            toolCall: undefined
          }
          context.onPromptRequest!(userPrompt)
          
          // Wait for user response (will be resolved via handleUserPromptResponse)
          const response = await responsePromise
          return response
        } : undefined
      }
      
      console.log('[OrchestratedChatEngine] Intent extracted:', {
        objective: intent?.objective,
        category: intent?.category,
        clarityScore: intent?.clarityScore
      })
      
      // Step 3: Check if this is a greeting (skip reasoning for instant responses)
      const isGreeting = intent?.category === 'greeting'
      
      // Step 4: Generate initial reasoning part for non-greetings
      if (!isGreeting) {
        // Send initial reasoning as a separate message part
        const reasoningText = this.buildInitialReasoningText(intent)
        
        // Emit reasoning part using special markers that Assistant UI understands
        yield `__REASONING_START__\n${reasoningText}\n`
        
        // Note: We don't close __REASONING_END__ yet - the sub-agent will add more
        // reasoning and close it when ready
      }
      
      // Step 5: Orchestrate with streaming
      // The orchestrator will delegate to sub-agents and stream their responses
      yield* this.orchestrator.orchestrateStream(subAgentContext)
      
      console.log('[OrchestratedChatEngine] ✅ Streaming completed')
      
    } catch (error) {
      console.error('[OrchestratedChatEngine] Error:', error)
      yield `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
  
  /**
   * Build initial reasoning text from intent (before retrieval)
   */
  private buildInitialReasoningText(intent: Intent | undefined): string {
    if (!intent) {
      return '🧠 **Analisando sua solicitação...**\n\n'
    }
    
    const technicalTermsText = intent.technicalTerms.length > 0
      ? `**Termos técnicos:** ${intent.technicalTerms.join(', ')}\n`
      : ''
    
    const clarityPercent = (intent.clarityScore * 100).toFixed(0)
    const clarityWarning = intent.clarityScore < 0.7
      ? '\n⚠️ *Atenção: A solicitação pode precisar de mais detalhes*\n'
      : ''
    
    const ambiguitiesText = intent.ambiguities.length > 0
      ? '\n**Pontos de atenção:**\n' + intent.ambiguities.map(a => `- ${a}`).join('\n') + '\n'
      : ''
    
    return `🧠 **Analisando sua solicitação...**

**Objetivo identificado:** ${intent.objective}
${technicalTermsText}**Categoria:** ${intent.category}
**Clareza:** ${clarityPercent}%
${clarityWarning}${ambiguitiesText}
`
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
    let cleaned = response.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '')
    
    // Remove comments
    cleaned = cleaned.replaceAll(/\/\/.*$/gm, '')
    
    // Find JSON object
    const jsonRegex = /\{[\s\S]*\}/
    const jsonMatch = jsonRegex.exec(cleaned)
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
        clarityScore: 1,
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
   * Handle user prompt response (for multi-turn conversations)
   */
  handleUserPromptResponse(messageId: string, response: string): void {
    console.log('[OrchestratedChatEngine] User response:', messageId, response)
    
    // Check if it's a prompt response
    const promptResolver = this.pendingPromptResponses.get(messageId)
    if (promptResolver) {
      console.log(`[OrchestratedChatEngine] Resolving prompt: ${messageId}`)
      promptResolver(response)
      this.pendingPromptResponses.delete(messageId)
      return
    }
    
    // Check if it's a tool approval
    const toolResolver = this.pendingToolApprovals.get(messageId)
    if (toolResolver) {
      const approved = response === 'yes'
      console.log(`[OrchestratedChatEngine] Tool ${approved ? 'approved' : 'rejected'}: ${messageId}`)
      toolResolver(approved)
      this.pendingToolApprovals.delete(messageId)
      return
    }
    
    console.warn(`[OrchestratedChatEngine] No pending request found for message: ${messageId}`)
  }
}
