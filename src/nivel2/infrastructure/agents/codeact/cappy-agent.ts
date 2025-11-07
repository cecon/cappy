/**
 * @fileoverview Main Cappy Agent implementing CodeAct pattern
 * @module codeact/cappy-agent
 * 
 * Inspired by OpenHands CodeActAgent
 */

import * as vscode from 'vscode'
import { BaseAgent } from './core/base-agent'
import type { AgentConfig } from './core/base-agent'
import type { State } from './core/state'
import type { AnyAction, ToolCallAction } from './core/actions'
import type { AnyObservation, ToolResultObservation } from './core/observations'
import { createMessageAction, createToolCallAction } from './core/actions'
import type { Tool } from './core/tool'
import { ThinkTool } from './tools/think-tool'
import { FinishTool } from './tools/finish-tool'
import { RetrieveContextTool } from './tools/retrieve-context-tool'
import { BashTool } from './tools/bash-tool'
import { FileReadTool } from './tools/file-read-tool'
import { FileWriteTool } from './tools/file-write-tool'
import { EditFileTool } from './tools/edit-file-tool'
import type { HybridRetriever } from '../../services/hybrid-retriever'
import { ContextAnalyzer, type ContextNeed } from './services/context-analyzer'

/**
 * System prompt for Cappy agent
 */
const SYSTEM_PROMPT = `You are Cappy, an advanced AI coding assistant that can interact with the VS Code workspace to solve technical problems.

<ROLE>
You assist developers by executing commands, modifying code, analyzing codebases, and solving technical problems.
* Answer questions directly and clearly
* Use tools when you need to read files, search code, or execute commands
* Work within a VS Code workspace with full access to files, terminal, and context retrieval
</ROLE>

<WORKFLOW>
1. **Understand** the user's request
2. **Respond** with helpful information or ask clarifying questions if needed
3. **Use tools** if you need to read files, search, or execute actions
4. **Finish** when done by calling the finish tool

For simple questions: Answer directly, then call finish.
For complex tasks: Use tools as needed, provide updates, then call finish when done.
</WORKFLOW>

<AVAILABLE_TOOLS>
- think: Internal reasoning (use for complex problems)
- retrieve_context: Semantic search across codebase
- read_file: Read file contents
- write_file: Create or overwrite files
- edit_file: Search and replace in files
- bash: Execute shell commands (PowerShell on Windows)
- finish: Call when your work is complete (completed=true) or when waiting for user (completed=false)
</AVAILABLE_TOOLS>

<IMPORTANT>
* Always respond to the user before finishing
* Use finish tool to signal task completion
* For simple greetings or questions, answer directly
* Use tools only when necessary
</IMPORTANT>

Answer in the same language as the user unless explicitly instructed otherwise.
`.trim()

/**
 * Additional guardrails for plan mode
 */
const PLAN_MODE_PROMPT = `PLAN MODE POLICY

You are in planning-only mode. Create plans, do NOT implement code.

WORKFLOW:
1. If unclear → Ask ONE clarifying question → Call finish with completed=false
2. If clear → Provide complete plan → Call finish with completed=true

CONSTRAINTS:
- Do NOT propose code changes
- Do NOT suggest implementation
- Do NOT modify files or run commands
- Do NOT include diffs or patches

PLAN FORMAT:
## Context Summary
[What you know with file citations]

## Plan
1. [Step 1]
2. [Step 2]
...

## Validation Criteria
- [Measurable PASS/FAIL criteria]

## Risks and Mitigations
- Risk: [X], Mitigation: [Y]

## Rollback Strategy
[How to undo if needed]

## Estimated Effort
[Time estimate]

## Confirmation Question
[ONE question to confirm understanding]

Call finish tool when done providing plan.`.trim()

/**
 * Additional guardrails for code mode (optional guidance)
 */
const CODE_MODE_PROMPT = `CODE MODE POLICY

You may propose concrete code changes and use tools. Prefer minimal, focused edits. Summarize intent first, then proceed. Validate with build/tests when possible.`.trim()

/**
 * Main Cappy Agent implementing CodeAct pattern
 * 
 * This agent consolidates all capabilities into a single, powerful agent
 * following the OpenHands CodeActAgent architecture.
 */
export class CappyAgent extends BaseAgent {
  private llmModel: vscode.LanguageModelChat | null = null
  private readonly retriever?: HybridRetriever
  private readonly contextAnalyzer: ContextAnalyzer
  
  constructor(
    config: AgentConfig = {},
    retriever?: HybridRetriever
  ) {
    super(config)
    this.retriever = retriever
    this.contextAnalyzer = new ContextAnalyzer()
    this.tools = this.initializeTools()
  }
  
  /**
   * Initialize LLM model
   */
  async initialize(): Promise<void> {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    })
    
    if (models.length > 0) {
      this.llmModel = models[0]
      console.log('[CappyAgent] Initialized with model:', this.llmModel.name)
    } else {
      console.warn('[CappyAgent] No LLM model available')
    }
  }
  
  /**
   * Initialize tools for Cappy
   */
  protected initializeTools(): Tool[] {
    const tools: Tool[] = []
    
    if (this.config.enableThinking) {
      tools.push(new ThinkTool())
    }
    
    // File operation tools
    tools.push(new FileReadTool())
    
    // In plan mode, restrict to read-only + retrieval + finish
    if (this.config.mode !== 'plan') {
      tools.push(new FileWriteTool())
      tools.push(new EditFileTool())
      
      // Terminal/execution tool
      tools.push(new BashTool())
    }
    
    // Context retrieval (unified system)
    tools.push(new RetrieveContextTool(this.retriever))
    
    // Completion tool (should be last)
    tools.push(new FinishTool())
    
    console.log(`[CappyAgent] Initialized (${this.config.mode || 'default'} mode) with ${tools.length} tools:`, tools.map(t => t.name).join(', '))
    return tools
  }
  
  /**
   * Execute one step: decide next action (OpenHands pattern)
   * ONLY decides - does NOT execute
   */
  async step(state: State): Promise<AnyAction> {
    console.log(`[CappyAgent] step() called - iteration ${state.metrics.iterations}`)
    
    // 1. Check if we have an LLM
    if (!this.llmModel) {
      console.error('[CappyAgent] No LLM model available')
      return createMessageAction(
        'Error: No LLM model available. Please ensure GitHub Copilot is installed and active.',
        'assistant'
      )
    }
    
    // 2. Build messages for LLM from state history
    const messages = this.buildMessages(state)
    
    console.log(`[CappyAgent] Sending ${(await messages).length} messages to LLM`)
    
    // 3. Call LLM with tools
    const toolSchemas = this.tools.map(t => this.toolToVSCodeSchema(t))
    console.log(`[CappyAgent] Available tools: ${toolSchemas.map(t => t.name).join(', ')}`)
    
    try {
      const request = await this.llmModel.sendRequest(
        await messages,
        {
          justification: 'Cappy agent processing user request',
          tools: toolSchemas
        },
        new vscode.CancellationTokenSource().token
      )
      
      // 4. Parse response into ONE action
      const action = await this.parseResponse(request)
      
      if (!action) {
        // No action returned, create a default message
        return createMessageAction('I need more information to help you.', 'assistant')
      }
      
      console.log(`[CappyAgent] Decided action: ${action.action}`)
      return action  // ← Return action, NOT execute it
      
    } catch (error) {
      console.error('[CappyAgent] Error calling LLM:', error)
      return createMessageAction(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'assistant'
      )
    }
  }
  
  /**
   * Decide if agent should continue after observation
   * This gives the agent control over iteration flow
   */
  shouldContinue(observation: AnyObservation, state: State): boolean {
    console.log(`[CappyAgent] shouldContinue called for observation: ${observation.observation}`)
    
    // 1. Check if finish tool was called
    if (observation.observation === 'tool_result') {
      const result = observation as ToolResultObservation
      
      if (result.toolName === 'finish') {
        console.log('[CappyAgent] Finish tool called - stopping')
        return false // Always stop after finish
      }
    }
    
    // 2. In PLAN mode, special logic
    if (this.config.mode === 'plan') {
      return this.shouldContinuePlanMode(observation, state)
    }
    
    // 3. Check for terminal errors
    if (observation.observation === 'error') {
      const recentErrors = this.countRecentErrors(state)
      
      if (recentErrors >= 3) {
        console.log('[CappyAgent] Too many consecutive errors - stopping')
        return false
      }
      
      // Continue to try recovery
      console.log('[CappyAgent] Error observed but will try to recover')
      return true
    }
    
    // 4. Check if we've completed a meaningful action
    if (observation.observation === 'success') {
      // Check if this was after a user-facing message
      const lastAction = this.getLastAction(state)
      
      if (lastAction?.action === 'message') {
        console.log('[CappyAgent] Message sent - should call finish next')
        // Continue ONE more time to call finish
        return true
      }
    }
    
    // 5. Safety: check iteration limit
    if (state.metrics.iterations >= this.config.maxIterations!) {
      console.log('[CappyAgent] Max iterations reached - stopping')
      return false
    }
    
    // Default: continue
    return true
  }
  
  /**
   * Plan mode specific continuation logic
   */
  private shouldContinuePlanMode(_observation: AnyObservation, state: State): boolean {
    const recentHistory = state.getRecentHistory(5)
    
    // Count messages without finish
    let messagesCount = 0
    let hasFinish = false
    
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      const event = recentHistory[i]
      
      if (event.type === 'action') {
        if (event.action === 'message' && (event as { source?: string }).source === 'assistant') {
          messagesCount++
        } else if (event.action === 'tool_call') {
          const toolCall = event as ToolCallAction
          if (toolCall.toolName === 'finish') {
            hasFinish = true
            break
          }
        }
      }
    }
    
    // PLAN MODE RULE: After sending message, must call finish
    if (messagesCount > 0 && !hasFinish) {
      console.log('[CappyAgent] Plan mode: message sent, expecting finish call')
      // Continue ONLY if we haven't called finish yet
      
      // But if we sent message in THIS iteration, stop - don't keep iterating
      const lastAction = this.getLastAction(state)
      if (lastAction?.action === 'message') {
        console.log('[CappyAgent] Plan mode: just sent message, stopping to force finish next time')
        return false // Stop here, user will see message, next turn should be finish
      }
      
      return true
    }
    
    // If we called finish, stop
    if (hasFinish) {
      console.log('[CappyAgent] Plan mode: finish called, stopping')
      return false
    }
    
    return true
  }
  
  /**
   * Count consecutive errors in recent history
   */
  private countRecentErrors(state: State): number {
    const recent = state.getRecentHistory(10)
    let errorCount = 0
    
    for (let i = recent.length - 1; i >= 0; i--) {
      const event = recent[i]
      
      if (event.type === 'observation') {
        if (event.observation === 'error') {
          errorCount++
        } else if (event.observation === 'success' || event.observation === 'tool_result') {
          // Success breaks the error streak
          const toolResult = event as ToolResultObservation
          if (toolResult.success !== false) {
            break
          }
        }
      }
    }
    
    return errorCount
  }
  
  /**
   * Get last action from state
   */
  private getLastAction(state: State): AnyAction | null {
    const recent = state.getRecentHistory(5)
    
    for (let i = recent.length - 1; i >= 0; i--) {
      const event = recent[i]
      if (event.type === 'action') {
        return event as AnyAction
      }
    }
    
    return null
  }
  
  /**
   * Build messages array for LLM from state history
   */
  private async buildMessages(state: State): Promise<vscode.LanguageModelChatMessage[]> {
    const messages: vscode.LanguageModelChatMessage[] = []

    // Add system prompt
    messages.push(vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT))

    // Mode-specific guardrails
    if (this.config.mode === 'plan') {
      messages.push(vscode.LanguageModelChatMessage.User(PLAN_MODE_PROMPT))
    } else if (this.config.mode === 'code') {
      messages.push(vscode.LanguageModelChatMessage.User(CODE_MODE_PROMPT))
    }

    // ✨ AUTOMATIC CONTEXT INJECTION (only if needed)
    const recentHistory = state.getRecentHistory(10)
    const hasRecentContextRetrieval = recentHistory.some(event => 
      event.type === 'action' && event.action === 'tool_call' && event.toolName === 'retrieve_context'
    )
    const isEarlyConversation = recentHistory.length < 3

    if (isEarlyConversation || !hasRecentContextRetrieval) {
      const contextNeeds = await this.contextAnalyzer.analyzeNeeds(state)
      if (contextNeeds.length > 0) {
        const contextMessage = await this.buildContextMessage(contextNeeds)
        messages.push(vscode.LanguageModelChatMessage.User(contextMessage))
      }
    }
    
    // Track tool calls to pair with results
    const pendingToolCalls = new Map<string, vscode.LanguageModelToolCallPart>()
    
    // Convert events to messages
    for (const event of recentHistory) {
      if (event.type === 'action') {
        if (event.action === 'message') {
          const msg = event as { source: string; content: string }
          if (msg.source === 'user') {
            messages.push(vscode.LanguageModelChatMessage.User(msg.content))
          } else {
            messages.push(vscode.LanguageModelChatMessage.Assistant(msg.content))
          }
        } else if (event.action === 'tool_call') {
          const toolCall = event as ToolCallAction
          const part = new vscode.LanguageModelToolCallPart(
            toolCall.callId,
            toolCall.toolName,
            toolCall.input
          )
          pendingToolCalls.set(toolCall.callId, part)
          messages.push(vscode.LanguageModelChatMessage.Assistant([part]))
        } else if (event.action === 'think') {
          // Skip internal thinking for LLM messages to avoid confusion
          continue
        }
      } else if (event.type === 'observation') {
        if (event.observation === 'tool_result') {
          const result = event as ToolResultObservation
          
          // Only add tool result if we have the corresponding tool call
          if (pendingToolCalls.has(result.callId)) {
            const content = typeof result.result === 'string'
              ? result.result
              : JSON.stringify(result.result, null, 2)
            
            const part = new vscode.LanguageModelToolResultPart(
              result.callId,
              [new vscode.LanguageModelTextPart(content)]
            )
            messages.push(vscode.LanguageModelChatMessage.User([part]))
            pendingToolCalls.delete(result.callId)
          }
        }
      }
    }
    
    return messages
  }

  /**
   * Build context message from analyzed needs
   */
  private async buildContextMessage(needs: ContextNeed[]): Promise<string> {
    let message = '<AUTOMATIC_CONTEXT>\n'
    message += 'The following context has been automatically retrieved based on the current situation:\n\n'

    // Limit to top 5 most important contexts
    for (const need of needs.slice(0, 5)) {
      message += `## ${need.reason}\n`

      for (const path of need.paths.slice(0, 3)) { // Max 3 files per need
        const content = await this.readFileContent(path)
        if (content) {
          message += `\n### ${path}\n`
          message += `\`\`\`\n${content.substring(0, 1000)}\n...\n\`\`\`\n`
        }
      }

      message += '\n'
    }

    message += '</AUTOMATIC_CONTEXT>\n'
    return message
  }

  private async readFileContent(path: string): Promise<string | null> {
    try {
      const uri = vscode.Uri.file(path)
      const content = await vscode.workspace.fs.readFile(uri)
      return Buffer.from(content).toString('utf-8')
    } catch {
      return null
    }
  }
  
  /**
   * Parse LLM response into single action (OpenHands pattern)
   */
  private async parseResponse(
    request: vscode.LanguageModelChatResponse
  ): Promise<AnyAction | null> {
    let textContent = ''
    const toolCalls: vscode.LanguageModelToolCallPart[] = []
    
    // Collect all parts from stream
    for await (const part of request.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        textContent += part.value
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push(part)
      }
    }
    
    // Priority: tool calls over text (following OpenHands pattern)
    if (toolCalls.length > 0) {
      // Return first tool call only
      const toolCall = toolCalls[0]
      return createToolCallAction(
        toolCall.name,
        toolCall.input as Record<string, unknown>,
        toolCall.callId
      )
    }
    
    // Fallback to text message if no tool calls
    if (textContent.trim().length > 0) {
      return createMessageAction(textContent.trim(), 'assistant')
    }
    
    // No action found
    return null
  }
  
  /**
   * Convert Tool to VS Code schema
   */
  private toolToVSCodeSchema(tool: Tool): vscode.LanguageModelToolInformation {
    const schema = tool.toSchema()
    
    return {
      name: schema.name,
      description: schema.description,
      tags: [],
      inputSchema: schema.inputSchema as vscode.LanguageModelToolInformation['inputSchema']
    }
  }
  
  /**
   * Reset agent state
   */
  reset(): void {
    // Reset agent state (no pending actions in OpenHands pattern)
  }
}
