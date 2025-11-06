/**
 * @fileoverview Adapter to integrate CappyAgent with ChatAgentPort
 * @module codeact/cappy-agent-adapter
 */

import { CappyAgent } from './cappy-agent'
import { AgentController } from './agent-controller'
import type { ChatAgentPort, ChatContext } from '../../../../domains/chat/ports/agent-port'
import type { Message } from '../../../../domains/chat/entities/message'
import type { RetrieveContextUseCase } from '../../../../domains/retrieval/use-cases/retrieve-context-use-case'
import type { AgentConfig } from './core/base-agent'
import type { AnyAction, MessageAction, ToolCallAction } from './core/actions'
import type { AnyObservation } from './core/observations'

/**
 * Simple adapter that bridges CappyAgent with ChatAgentPort (OpenHands pattern)
 * 
 * Responsibilities:
 * - Create and initialize agent
 * - Feed messages to controller
 * - Stream formatted output
 */
export class CappyAgentAdapter implements ChatAgentPort {
  private controller: AgentController
  private agent: CappyAgent
  
  constructor(
    config: AgentConfig = {},
    retrieveUseCase?: RetrieveContextUseCase
  ) {
    this.agent = new CappyAgent(config, retrieveUseCase)
    this.controller = new AgentController(
      this.agent,
      'default-session',  // Could generate unique ID per session
      config.maxIterations || 5
    )
  }
  
  /**
   * Initialize the agent (must be called before processMessage)
   */
  async initialize(): Promise<void> {
    await this.agent.initialize()
  }
  
  /**
   * Process user message with streaming response (OpenHands pattern)
   */
  async *processMessage(
    message: Message,
    context: ChatContext
  ): AsyncIterable<string> {
    try {
      // Add history to persistent state (only if needed)
      if (context.history && context.history.length > 0) {
        this.controller.addHistory(context.history)
      }
      
      // Add current user message
      this.controller.addUserMessage(message.content)
      
      console.log('[CappyAgentAdapter] Starting controller execution')
      
      // Run controller and stream results
      for await (const step of this.controller.run()) {
        // Stream action output
        if (step.action) {
          const actionOutput = this.formatAction(step.action)
          if (actionOutput) {
            yield actionOutput
          }
        }
        
        // Stream observation output
        if (step.observation) {
          const obsOutput = this.formatObservation(step.observation)
          if (obsOutput) {
            yield obsOutput
          }
        }
        
        // Stop if complete
        if (step.isComplete) {
          console.log('[CappyAgentAdapter] Agent completed')
          break
        }
      }
      
    } catch (error) {
      console.error('[CappyAgentAdapter] Error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
      yield `❌ Error: ${errorMsg}\n\n`
    }
  }
  
  /**
   * Format action for streaming output
   */
  private formatAction(action: AnyAction): string | null {
    if (action.action === 'message') {
      const msg = action as MessageAction
      return `${msg.content}\n\n`
    }
    
    if (action.action === 'tool_call') {
      const tool = action as ToolCallAction
      // Show tool being called in a cleaner way (except think - it's internal)
      if (tool.toolName === 'think') {
        return null // Don't show think tool calls - they're internal reasoning
      }
      return `\n*Using ${tool.toolName}...*\n\n`
    }
    
    if (action.action === 'think') {
      // Think is internal reasoning - don't show to user
      return null
    }
    
    return null
  }
  
  /**
   * Format observation for streaming output (Copilot-style)
   */
  private formatObservation(observation: AnyObservation): string | null {
    if (observation.observation === 'tool_result') {
      const result = observation as { success: boolean; result: unknown; toolName: string }
      
      // Hide internal tools (think)
      if (result.toolName === 'think') {
        return null // Think results are internal, don't show to user
      }
      
      // Check if this is the finish tool result
      if (result.success && result.toolName === 'finish' && typeof result.result === 'object') {
        const finishResult = result.result as { summary?: string; completed?: boolean }
        if (finishResult.completed) {
          return '' // Don't show finish result, just complete silently
        }
      }
      
      // For file_read tool, show clean summary
      if (result.toolName === 'file_read' && result.success && typeof result.result === 'object') {
        const fileResult = result.result as { path?: string; content?: string; lineCount?: number; message?: string }
        if (fileResult.message) {
          return `✓ ${fileResult.message}\n\n`
        }
      }
      
      // For retrieve_context, format nicely
      if (result.toolName === 'retrieve_context' && result.success && typeof result.result === 'object') {
        return this.formatRetrievalResult(result.result as Record<string, unknown>)
      }
      
      // For bash commands, show output cleanly
      if (result.toolName === 'bash' && result.success && typeof result.result === 'string') {
        if (result.result.trim()) {
          return `\`\`\`\n${result.result}\n\`\`\`\n\n`
        }
        return '' // Don't show empty output
      }
      
      // For other successful tools, show minimal feedback
      if (result.success && result.toolName !== 'think' && result.toolName !== 'finish') {
        // Only show result if it's meaningful
        if (typeof result.result === 'string' && result.result !== 'Success' && result.result.trim()) {
          return `✓ ${result.result}\n\n`
        } else if (typeof result.result === 'object' && result.result !== null) {
          // Show object results in a compact way
          const summary = this.summarizeObject(result.result)
          if (summary) {
            return `✓ ${summary}\n\n`
          }
        }
        return '' // Success but no meaningful output to show
      }
      
      // Show errors clearly
      if (!result.success) {
        return `❌ ${result.result}\n\n`
      }
    } else if (observation.observation === 'error') {
      const error = observation as { error: string }
      return `❌ ${error.error}\n\n`
    }
    
    return null
  }
  
  /**
   * Summarize object result in a compact way
   */
  private summarizeObject(obj: unknown): string | null {
    if (typeof obj !== 'object' || obj === null) return null
    
    const record = obj as Record<string, unknown>
    
    // Check for common patterns
    if (record.message) return String(record.message)
    if (record.summary) return String(record.summary)
    if (record.success !== undefined) return record.success ? 'Done' : 'Failed'
    
    return null
  }
  
  /**
   * Format retrieval result for nice display
   */
  private formatRetrievalResult(result: Record<string, unknown>): string {
    const contexts = result.contexts as Array<{
      rank: number
      score: number
      source: string
      content: string
      filePath?: string
      metadata?: Record<string, unknown>
    }>
    
    if (!contexts || contexts.length === 0) {
      return '📭 No relevant context found.\n\n'
    }
    
    let output = `📚 **Found ${contexts.length} relevant context(s):**\n\n`
    
    for (const ctx of contexts.slice(0, 3)) { // Show top 3
      const filePath = ctx.filePath ? `\`${ctx.filePath}\`` : ctx.source
      const score = (ctx.score * 100).toFixed(0)
      
      output += `**${ctx.rank}.** ${filePath} (${score}% relevant)\n`
      output += `\`\`\`\n${ctx.content.substring(0, 200)}...\n\`\`\`\n\n`
    }
    
    return output
  }
}
