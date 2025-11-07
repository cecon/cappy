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
import type { ToolResultObservation } from './core/observations'
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
4. **Finish** after you've completed the request

For simple questions: Just answer directly, then use finish.
For complex tasks: Use tools as needed, provide updates, then finish when done.
</WORKFLOW>

<AVAILABLE_TOOLS>
- think: Internal reasoning (use for complex problems)
- retrieve_context: Semantic search across codebase
- file_read: Read file contents
- file_write: Create or overwrite files
- edit_file: Search and replace in files
- bash: Execute shell commands (PowerShell on Windows)
- finish: Mark the task as complete (use when done)
</AVAILABLE_TOOLS>

<IMPORTANT>
* Always respond to the user before using finish
* For simple greetings or questions, answer directly
* Use tools only when necessary
* Finish every interaction - don't leave conversations hanging
</IMPORTANT>

Answer in the same language as the user unless explicitly instructed otherwise.
`.trim()

/**
 * Additional guardrails for plan mode
 */
const PLAN_MODE_PROMPT = `PLAN MODE POLICY

You are operating in planning-only mode. Your job is to ask targeted questions, consult context, and produce a clear, actionable plan — then STOP.

Hard constraints:
- Do NOT propose code changes
- Do NOT suggest starting implementation
- Do NOT modify files or run commands
- Do NOT include diffs or patches

Turn-by-turn process:
1) If the request is under-specified, ask exactly ONE short, critical clarifying question. Then STOP and wait for the answer. Do NOT call tools in the same turn you ask a question.
2) Once you have enough information, use retrieve_context (at least once) and summarize key findings with file path citations when available.
3) Draft the plan. If information is still missing, mark relevant steps as "pending answer" and ask at most ONE follow-up question at the end. Do not repeat or rephrase earlier questions.

Required output sections (use concise bullets):
- (When asking a question) Only the single clarifying question, nothing else.
- (When planning) Context summary (with citations when available)
- (When planning) Plan (clear steps)
- (When planning) Validation criteria (measurable, PASS/FAIL)
- (When planning) Risks and mitigations
- (When planning) Rollback strategy
- (When planning) Estimated effort

Always end with exactly one confirmation question when presenting a plan.`.trim()

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
  
  constructor(
    config: AgentConfig = {},
    retriever?: HybridRetriever
  ) {
    super(config)
    this.retriever = retriever
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
    
    console.log(`[CappyAgent] Sending ${messages.length} messages to LLM`)
    
    // 3. Call LLM with tools
    const toolSchemas = this.tools.map(t => this.toolToVSCodeSchema(t))
    
    try {
      const request = await this.llmModel.sendRequest(
        messages,
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
   * Build messages array for LLM from state history
   */
  private buildMessages(state: State): vscode.LanguageModelChatMessage[] {
    const messages: vscode.LanguageModelChatMessage[] = []
    
    // Add system prompt
    messages.push(vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT))
    
    // Mode-specific guardrails
    if (this.config.mode === 'plan') {
      messages.push(vscode.LanguageModelChatMessage.User(PLAN_MODE_PROMPT))
    } else if (this.config.mode === 'code') {
      messages.push(vscode.LanguageModelChatMessage.User(CODE_MODE_PROMPT))
    }
    
    // Get recent history (limit to avoid context overflow)
    const recentHistory = state.getRecentHistory(10)
    
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
