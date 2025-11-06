/**
 * @fileoverview Agent Controller - orchestrates the agent loop
 * @module codeact/agent-controller
 * 
 * Following OpenHands AgentController pattern
 */

import type { BaseAgent } from './core/base-agent'
import { State } from './core/state'
import type { AnyAction, ToolCallAction } from './core/actions'
import type { AnyObservation, ToolResultObservation } from './core/observations'
import { createMessageAction } from './core/actions'
import { createToolResultObservation, createErrorObservation, createSuccessObservation } from './core/observations'

/**
 * Controller that orchestrates agent execution loop (OpenHands pattern)
 * 
 * Responsibilities:
 * 1. Manages persistent State
 * 2. Calls agent.step() to get actions
 * 3. Executes actions and generates observations
 * 4. Decides when to continue/stop
 */
export class AgentController {
  private agent: BaseAgent
  private state: State  // ← State persists here!
  private maxIterations: number
  
  constructor(
    agent: BaseAgent,
    sessionId: string,
    maxIterations = 10
  ) {
    this.agent = agent
    this.state = new State(sessionId)  // ← Created once, persists across messages
    this.maxIterations = maxIterations
  }
  
  /**
   * Add user message to state
   */
  addUserMessage(content: string): void {
    this.state.addEvent(createMessageAction(content, 'user'))
  }
  
  /**
   * Add history messages to state
   */
  addHistory(messages: Array<{ content: string; author: string }>): void {
    for (const msg of messages) {
      this.state.addEvent(
        createMessageAction(
          msg.content,
          msg.author === 'user' ? 'user' : 'assistant'
        )
      )
    }
  }
  
  /**
   * Run agent until finish (OpenHands pattern)
   * Yields both actions and observations for streaming
   */
  async *run(): AsyncIterable<{
    action?: AnyAction
    observation?: AnyObservation
    isComplete: boolean
    iteration: number
  }> {
    console.log('[AgentController] Starting execution')
    
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      this.state.startIteration()
      
      console.log(`[AgentController] Iteration ${iteration + 1}/${this.maxIterations}`)
      
      try {
        // 1. Agent DECIDES action (does not execute)
        const action = await this.agent.step(this.state)
        this.state.addEvent(action)
        
        console.log(`[AgentController] Action decided: ${action.action}`)
        
        // Yield action for streaming
        yield { action, isComplete: false, iteration: iteration + 1 }
        
        // 2. Controller EXECUTES action and generates observation
        const observation = await this.executeAction(action)
        this.state.addEvent(observation)
        
        console.log(`[AgentController] Observation generated: ${observation.observation}`)
        
        // 3. Check if finished
        const isFinish = this.isFinishObservation(observation)
        
        // Yield observation for streaming
        yield { observation, isComplete: isFinish, iteration: iteration + 1 }
        
        if (isFinish) {
          this.state.finish()
          console.log('[AgentController] Agent finished successfully')
          break
        }
        
      } catch (error) {
        console.error('[AgentController] Error in agent step:', error)
        const errorObs = createErrorObservation(
          error instanceof Error ? error.message : 'Unknown error'
        )
        this.state.addEvent(errorObs)
        yield { observation: errorObs, isComplete: true, iteration: iteration + 1 }
        break
      }
    }
    
    console.log('[AgentController] Execution completed')
  }
  
  /**
   * Execute action and return observation (Controller responsibility, not Agent)
   */
  private async executeAction(action: AnyAction): Promise<AnyObservation> {
    if (action.action === 'tool_call') {
      const toolCall = action as ToolCallAction
      const tool = this.agent.getTools().find(t => t.name === toolCall.toolName)
      
      if (!tool) {
        return createErrorObservation(`Tool not found: ${toolCall.toolName}`)
      }
      
      try {
        console.log(`[AgentController] Executing tool: ${toolCall.toolName}`)
        const result = await tool.execute(toolCall.input)
        
        const resultContent: string | Record<string, unknown> = result.success
          ? (result.result as (string | Record<string, unknown>) || 'Success')
          : (result.error || 'Error occurred')
        
        return createToolResultObservation(
          toolCall.toolName,
          toolCall.callId,
          resultContent,
          result.success
        )
      } catch (error) {
        return createErrorObservation(
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }
    
    // For non-tool actions (message, think), create success observation
    return createSuccessObservation('Action processed')
  }
  
  /**
   * Check if observation indicates completion
   */
  private isFinishObservation(observation: AnyObservation): boolean {
    if (observation.observation === 'tool_result') {
      const result = observation as ToolResultObservation
      
      if (result.toolName === 'finish' && result.success && typeof result.result === 'object') {
        const finishResult = result.result as { completed?: boolean }
        return finishResult.completed === true
      }
    }
    
    return false
  }
  
  /**
   * Get current state
   */
  getState(): State {
    return this.state
  }
  
  /**
   * Reset for new conversation
   */
  reset(): void {
    this.state.reset()
  }
}