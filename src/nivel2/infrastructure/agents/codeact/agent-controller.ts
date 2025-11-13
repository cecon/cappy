import type { BaseAgent } from './core/base-agent'
import { State } from './core/state'
import type { AnyAction, MessageAction } from './core/actions'
import type { AnyObservation } from './core/observations'
import { createMessageAction } from './core/actions'
import { createToolResultObservation, createErrorObservation } from './core/observations'

export class AgentController {
  private agent: BaseAgent
  private state: State
  
  constructor(agent: BaseAgent, sessionId: string) {
    this.agent = agent
    this.state = new State(sessionId)
  }
  
  /**
   * Add user message to state
   */
  addUserMessage(content: string): void {
    const action = createMessageAction(content, 'user')
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
   * Process one user message: decide action, execute, return result
   * No complex loop - just one turn
   */
  async *process(): AsyncIterable<{
    action?: AnyAction
    observation?: AnyObservation
    message?: string
  }> {
    try {
      // 1. Agent decides what to do
      const action = await this.agent.step(this.state)
      this.state.addEvent(action)
      
      console.log(`[AgentController] Action: ${action.action}`)
      
      // Yield action for streaming
      yield { action }
      
      // 2. Execute action
      const observation = await this.executeAction(action)
      this.state.addEvent(observation)
      
      console.log(`[AgentController] Observation: ${observation.observation}`)
      
      // Yield observation
      yield { observation }
      
      // 3. If it's a message action, yield the content for display
      if (action.action === 'message') {
        const msgAction = action as MessageAction
        yield { message: msgAction.content }
      }
      
    } catch (error) {
      console.error('[AgentController] Error:', error)
      const errorObs = createErrorObservation(
        error instanceof Error ? error.message : 'Unknown error'
      )
      this.state.addEvent(errorObs)
      yield { observation: errorObs }
    }
  }
  
  /**
   * Execute action and return observation
   */
  private async executeAction(action: AnyAction): Promise<AnyObservation> {
    // Tool call
    if (action.action === 'tool_call') {
      const toolCall = action as any // Cast necessário
      const tool = this.agent.getTools().find(t => t.name === toolCall.toolName)
      
      if (!tool) {
        return createErrorObservation(`Tool not found: ${toolCall.toolName}`)
      }
      
      try {
        console.log(`[AgentController] Executing tool: ${toolCall.toolName}`)
        const result = await tool.execute(toolCall.input)
        
        // Se é clarification, marca state
        if (toolCall.toolName === 'clarify_requirements' && result.success) {
          const resultObj = result.result as any
          this.state.recordClarification(
            resultObj.questions || [],
            resultObj.reason || 'Need more info',
            toolCall.callId
          )
        }
        
        const resultContent = result.success
          ? (result.result || 'Success')
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
    
    // Message action - just acknowledge
    if (action.action === 'message') {
      return createToolResultObservation(
        'message',
        'msg-' + Date.now(),
        'Message sent',
        true
      )
    }
    
    // Other actions
    return createToolResultObservation(
      action.action,
      'action-' + Date.now(),
      'Action processed',
      true
    )
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
