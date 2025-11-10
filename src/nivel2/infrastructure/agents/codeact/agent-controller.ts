/**
 * @fileoverview Agent Controller - orchestrates the agent loop
 * @module codeact/agent-controller
 * 
 * Following OpenHands AgentController pattern
 */

import type { BaseAgent } from './core/base-agent'
import { State } from './core/state'
import type { AnyAction, ToolCallAction } from './core/actions'
import type { AnyObservation, ToolResultObservation, ErrorObservation } from './core/observations'
import { createMessageAction } from './core/actions'
import { createToolResultObservation, createErrorObservation, createSuccessObservation } from './core/observations'
import { ErrorClassifier, ErrorCategory, type ClassifiedError } from './core/error-classifier'

/**
 * Controller that orchestrates agent execution loop (OpenHands pattern)
 * Agent now controls when to continue/stop via shouldContinue()
 * 
 * Responsibilities:
 * 1. Manages persistent State
 * 2. Calls agent.step() to get actions
 * 3. Executes actions and generates observations
 * 4. Asks agent if it wants to continue
 */
export class AgentController {
  private agent: BaseAgent
  private state: State  // ← State persists here!
  private maxIterations: number
  private errorClassifier: ErrorClassifier
  
  constructor(
    agent: BaseAgent,
    sessionId: string,
    maxIterations = 10
  ) {
    this.agent = agent
    this.state = new State(sessionId)  // ← Created once, persists across messages
    this.maxIterations = maxIterations
    this.errorClassifier = new ErrorClassifier()
  }
  
  /**
   * Add user message to state
   */
  addUserMessage(content: string, isResponseToClarification = false): void {
    const action = createMessageAction(content, 'user')
    
    // If this is a response to a clarification request, link them
    if (isResponseToClarification) {
      const lastClarification = this.state.getLastUnresolvedClarification()
      if (lastClarification) {
        // Mark clarification as resolved with user's response
        this.state.addClarificationResponses(lastClarification.id, [content])
        
        // Add metadata to the action for context
        action.metadata = {
          respondsTo: lastClarification.id,
          type: 'clarification_response',
          originalQuestions: lastClarification.questions
        }
        
        console.log(`[AgentController] ✅ User responded to clarification: ${lastClarification.id}`)
        console.log(`[AgentController] Original questions: ${lastClarification.questions.length}`)
        console.log(`[AgentController] Resuming execution with user-provided context`)
        
        // Resume execution
        this.state.resumeExecution()
      } else {
        console.warn('[AgentController] isResponseToClarification=true but no unresolved clarification found')
      }
    }
    
    this.state.addEvent(action)
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
   * Run agent until it decides to stop (agent-controlled iteration)
   * Yields both actions and observations for streaming
   */
  async *run(): AsyncIterable<{
    action?: AnyAction
    observation?: AnyObservation
    isComplete: boolean
    iteration: number
  }> {
    console.log('[AgentController] Starting execution (agent-controlled)')
    
    let iteration = 0
    
    // Loop until agent decides to stop
    while (iteration < this.maxIterations) {
      iteration++
      this.state.startIteration()
      
      console.log(`[AgentController] Iteration ${iteration}/${this.maxIterations}`)
      
      try {
        // 1. Agent DECIDES action
        const action = await this.agent.step(this.state)
        this.state.addEvent(action)
        
        console.log(`[AgentController] Action decided: ${action.action}`)
        
        // Yield action for streaming
        yield { action, isComplete: false, iteration }
        
        // 2. Controller EXECUTES action
        const observation = await this.executeActionWithRetry(action)
        this.state.addEvent(observation)
        
        console.log(`[AgentController] Observation generated: ${observation.observation}`)
        
        // 3. Ask agent if it wants to continue
        const shouldContinue = this.agent.shouldContinue(observation, this.state)
        
        console.log(`[AgentController] Agent shouldContinue: ${shouldContinue}`)
        
        // Yield observation
        yield { observation, isComplete: !shouldContinue, iteration }
        
        // 4. Stop if agent says so
        if (!shouldContinue) {
          this.state.finish()
          console.log('[AgentController] Agent decided to stop')
          break
        }
        
      } catch (error) {
        console.error('[AgentController] Error in agent step:', error)
        const errorObs = createErrorObservation(
          error instanceof Error ? error.message : 'Unknown error'
        )
        this.state.addEvent(errorObs)
        
        // Ask agent if it wants to continue despite error
        const shouldContinue = this.agent.shouldContinue(errorObs, this.state)
        
        yield { observation: errorObs, isComplete: !shouldContinue, iteration }
        
        if (!shouldContinue) {
          this.state.finish()
          break
        }
      }
    }
    
    // Safety: exceeded max iterations
    if (iteration >= this.maxIterations) {
      console.warn('[AgentController] Reached max iterations - forcing stop')
      this.state.finish()
    }
    
    console.log('[AgentController] Execution completed')
  }
  
  /**
   * Execute action with automatic retry logic
   */
  private async executeActionWithRetry(
    action: AnyAction,
    maxAttempts = 3
  ): Promise<AnyObservation> {
    const actionId = this.generateActionId(action)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[AgentController] Executing ${action.action} (attempt ${attempt}/${maxAttempts})`)

      const observation = await this.executeAction(action)

      // Success - clear retry context
      if (this.isSuccessObservation(observation)) {
        this.state.clearRetry(actionId)
        return observation
      }

      // Failed - classify error
      const errorMsg = this.extractErrorMessage(observation)
      this.state.recordAttempt(actionId, errorMsg)

      const classified = this.errorClassifier.classify(errorMsg, {
        toolName: action.action === 'tool_call' ? (action as ToolCallAction).toolName : action.action,
        input: action.action === 'tool_call' ? (action as ToolCallAction).input : {},
        previousAttempts: attempt
      })

      console.log(`[AgentController] Error classified as: ${classified.category}`)

      // Terminal error - don't retry
      if (classified.category === ErrorCategory.TERMINAL) {
        return observation
      }

      // User input needed - don't retry
      if (classified.category === ErrorCategory.USER_INPUT) {
        return observation
      }

      // Retriable - wait and retry
      if (classified.category === ErrorCategory.RETRIABLE && attempt < maxAttempts) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`[AgentController] Retrying after ${backoff}ms...`)
        await this.sleep(backoff)
        continue
      }

      // Fixable - add suggestions to observation and let agent try different strategy
      if (classified.category === ErrorCategory.FIXABLE && attempt < maxAttempts) {
        // Don't auto-retry fixable errors - let agent see the error
        // and decide on different strategy
        return this.enrichObservationWithSuggestions(observation, classified)
      }

      // Last attempt - return error
      if (attempt === maxAttempts) {
        return observation
      }
    }

    // Should never reach here
    return createErrorObservation('Maximum retry attempts exceeded')
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

        // 🔍 Track clarification requests
        if (toolCall.toolName === 'clarify_requirements' && result.success && typeof result.result === 'object' && result.result !== null) {
          const resultObj = result.result as Record<string, unknown>
          const questions = resultObj.questions as string[] || []
          const reason = resultObj.reason as string || 'Clarification needed'
          const assumptions = resultObj.assumptions as string[] | undefined
          const alternatives = resultObj.alternatives as string[] | undefined
          
          this.state.recordClarification(
            questions,
            reason,
            toolCall.callId,
            assumptions,
            alternatives
          )
          
          console.log(`[AgentController] ⏸️  PAUSED: Waiting for user to answer ${questions.length} questions`)
          console.log(`[AgentController] Clarification ID: ${toolCall.callId}`)
          console.log(`[AgentController] Reason: ${reason}`)
          if (assumptions && assumptions.length > 0) {
            console.log(`[AgentController] Assumptions to validate: ${assumptions.length}`)
          }
          if (alternatives && alternatives.length > 0) {
            console.log(`[AgentController] Alternative approaches suggested: ${alternatives.length}`)
          }
        }

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

  private generateActionId(action: AnyAction): string {
    if (action.action === 'tool_call') {
      const tool = action as ToolCallAction
      return `${tool.toolName}-${tool.callId}`
    }
    return `${action.action}-${action.timestamp}`
  }

  private extractErrorMessage(observation: AnyObservation): string {
    if (observation.observation === 'error') {
      return (observation as ErrorObservation).error
    }
    if (observation.observation === 'tool_result') {
      const result = observation as ToolResultObservation
      if (!result.success) {
        return typeof result.result === 'string' ? result.result : JSON.stringify(result.result)
      }
    }
    return 'Unknown error'
  }

  private isSuccessObservation(observation: AnyObservation): boolean {
    if (observation.observation === 'success') return true
    if (observation.observation === 'tool_result') {
      return (observation as ToolResultObservation).success
    }
    return false
  }

  private enrichObservationWithSuggestions(
    observation: AnyObservation,
    classified: ClassifiedError
  ): AnyObservation {
    if (observation.observation === 'tool_result') {
      const result = observation as ToolResultObservation

      let enrichedResult = result.result

      if (typeof enrichedResult === 'string') {
        enrichedResult = `${enrichedResult}\n\nSuggestions:\n${classified.alternativeStrategies?.join('\n') || classified.suggestion || ''}`
      } else if (typeof enrichedResult === 'object') {
        enrichedResult = {
          ...enrichedResult as Record<string, unknown>,
          suggestions: classified.alternativeStrategies || [classified.suggestion],
          errorCategory: classified.category
        }
      }

      return {
        ...result,
        result: enrichedResult
      }
    }

    return observation
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}