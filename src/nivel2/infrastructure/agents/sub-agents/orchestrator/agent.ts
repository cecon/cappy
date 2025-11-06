/**
 * @fileoverview Orchestrator agent - selects and delegates to sub-agents
 * @module sub-agents/orchestrator/agent
 */

import type { SubAgent, SubAgentContext, SubAgentResponse, AgentDecision } from '../shared/types'

/**
 * OrchestratorAgent
 * 
 * Responsible for:
 * 1. Receiving user context
 * 2. Evaluating all available sub-agents
 * 3. Selecting the best agent based on priority and canHandle
 * 4. Delegating execution to selected agent
 * 5. Returning unified response
 * 
 * Decision logic:
 * - Sort agents by priority (descending)
 * - Find first agent where canHandle returns true
 * - Execute that agent's process method
 * - Return response with decision metadata
 */
export class OrchestratorAgent {
  private readonly agents: SubAgent[] = []
  
  /**
   * Register a sub-agent
   */
  registerAgent(agent: SubAgent): void {
    this.agents.push(agent)
    // Keep sorted by priority (highest first)
    this.agents.sort((a, b) => b.priority - a.priority)
    console.log(`[Orchestrator] Registered agent: ${agent.name} (priority: ${agent.priority})`)
  }
  
  /**
   * Get all registered agents
   */
  getAgents(): readonly SubAgent[] {
    return this.agents
  }
  
  /**
   * Main orchestration method - delegates to appropriate sub-agent
   */
  async orchestrate(context: SubAgentContext): Promise<SubAgentResponse> {
    const startTime = Date.now()
    
    console.log('[Orchestrator] Starting orchestration...')
    console.log(`[Orchestrator] User message: "${context.userMessage}"`)
    console.log(`[Orchestrator] Available agents: ${this.agents.length}`)
    
    if (this.agents.length === 0) {
      console.error('[Orchestrator] No agents registered!')
      return this.createFallbackResponse('No agents available to handle request')
    }
    
    // Find best agent
    const decision = await this.selectAgent(context)
    
    if (!decision) {
      console.warn('[Orchestrator] No agent could handle the request')
      return this.createFallbackResponse('Unable to process request - no suitable agent found')
    }
    
    console.log(`[Orchestrator] ✅ Selected: ${decision.selectedAgent.name}`)
    console.log(`[Orchestrator] Confidence: ${decision.confidence}`)
    console.log(`[Orchestrator] Reason: ${decision.reason}`)
    
    // Execute selected agent
    try {
      const response = await decision.selectedAgent.process(context)
      
      const elapsedTime = Date.now() - startTime
      console.log(`[Orchestrator] ✅ Response generated in ${elapsedTime}ms`)
      console.log(`[Orchestrator] Needs more info: ${response.needsMoreInfo}`)
      
      // Enrich response with orchestration metadata
      return {
        ...response,
        metadata: {
          ...response.metadata,
          orchestrationTimeMs: elapsedTime,
          selectedAgent: decision.selectedAgent.name,
          decisionConfidence: decision.confidence
        }
      }
      
    } catch (error) {
      console.error(`[Orchestrator] Error executing agent ${decision.selectedAgent.name}:`, error)
      return this.createFallbackResponse(
        `Error processing request with ${decision.selectedAgent.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Streaming orchestration - delegates to sub-agent's processStream if available
   */
  async *orchestrateStream(context: SubAgentContext): AsyncIterable<string> {
    const startTime = Date.now()
    
    console.log('[Orchestrator] Starting streaming orchestration...')
    console.log(`[Orchestrator] User message: "${context.userMessage}"`)
    console.log(`[Orchestrator] Available agents: ${this.agents.length}`)
    
    if (this.agents.length === 0) {
      console.error('[Orchestrator] No agents registered!')
      yield 'No agents available to handle request'
      return
    }
    
    // Find best agent
    const decision = await this.selectAgent(context)
    
    if (!decision) {
      console.warn('[Orchestrator] No agent could handle the request')
      yield 'Unable to process request - no suitable agent found'
      return
    }
    
    console.log(`[Orchestrator] ✅ Selected: ${decision.selectedAgent.name}`)
    console.log(`[Orchestrator] Confidence: ${decision.confidence}`)
    console.log(`[Orchestrator] Reason: ${decision.reason}`)
    
    // Execute selected agent with streaming if available
    try {
      const agent = decision.selectedAgent
      
      // Check if agent supports streaming
      if ('processStream' in agent && typeof agent.processStream === 'function') {
        console.log(`[Orchestrator] Using streaming mode for ${agent.name}`)
        yield* agent.processStream(context)
      } else {
        // Fallback to non-streaming
        console.log(`[Orchestrator] Using non-streaming mode for ${agent.name}`)
        const response = await agent.process(context)
        yield response.content
      }
      
      const elapsedTime = Date.now() - startTime
      console.log(`[Orchestrator] ✅ Streaming complete in ${elapsedTime}ms`)
      
    } catch (error) {
      console.error(`[Orchestrator] Error executing agent ${decision.selectedAgent.name}:`, error)
      yield `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
  
  /**
   * Select the best agent for the given context
   */
  private async selectAgent(context: SubAgentContext): Promise<AgentDecision | null> {
    const consideredAgents: string[] = []
    
    // Try each agent in priority order
    for (const agent of this.agents) {
      consideredAgents.push(agent.name)
      
      console.log(`[Orchestrator] Checking ${agent.name} (priority: ${agent.priority})...`)
      
      try {
        const canHandle = await agent.canHandle(context)
        
        if (canHandle) {
          console.log(`[Orchestrator] ✅ ${agent.name} can handle this request`)
          
          return {
            selectedAgent: agent,
            confidence: this.calculateConfidence(agent, context),
            reason: this.buildReason(agent, context),
            timestamp: new Date(),
            consideredAgents
          }
        } else {
          console.log(`[Orchestrator] ❌ ${agent.name} cannot handle this request`)
        }
        
      } catch (error) {
        console.error(`[Orchestrator] Error checking ${agent.name}:`, error)
        // Continue to next agent
      }
    }
    
    // No agent could handle
    console.warn('[Orchestrator] No agent could handle the request after checking all agents')
    return null
  }
  
  /**
   * Calculate confidence score for agent selection
   */
  private calculateConfidence(agent: SubAgent, context: SubAgentContext): number {
    // Base confidence on priority and intent clarity
    let confidence = agent.priority / 100 // Normalize priority to 0-1 range
    
    if (context.intent) {
      // Boost confidence if intent is clear
      confidence = confidence * 0.5 + context.intent.clarityScore * 0.5
    }
    
    return Math.min(confidence, 1)
  }
  
  /**
   * Build human-readable reason for agent selection
   */
  private buildReason(agent: SubAgent, context: SubAgentContext): string {
    const parts: string[] = []
    
    parts.push(`Selected ${agent.name} based on priority ${agent.priority}`)
    
    if (context.intent) {
      parts.push(`Intent clarity: ${(context.intent.clarityScore * 100).toFixed(0)}%`)
      
      if (agent.name === 'GreetingAgent') {
        parts.push('Detected greeting pattern')
      } else if (agent.name === 'ClarificationAgent') {
        parts.push(`Unclear request needs clarification`)
      } else if (agent.name === 'AnalysisAgent') {
        parts.push(`Clear objective: ${context.intent.objective}`)
      }
    }
    
    return parts.join('. ')
  }
  
  /**
   * Create fallback response when orchestration fails
   */
  private createFallbackResponse(message: string): SubAgentResponse {
    return {
      content: message,
      needsMoreInfo: false,
      metadata: {
        agentName: 'OrchestratorAgent',
        agentPriority: 0,
        processingTime: 0,
        isFallback: true
      }
    }
  }
}
