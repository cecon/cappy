/**
 * @fileoverview State management for agent execution
 * @module codeact/core/state
 * 
 * Inspired by OpenHands State class
 */

import type { Event } from './events'
import type { MessageAction } from './actions'
import { isAction } from './events'

/**
 * Workspace information
 */
export interface WorkspaceInfo {
  rootPath: string
  name: string
}

/**
 * Metrics for agent execution
 */
export interface Metrics {
  iterations: number
  toolCalls: number
  retrievalCalls: number
  tokensUsed?: number
  startTime: number
  endTime?: number
}

/**
 * Agent execution status
 */
export type AgentStatus = 'idle' | 'running' | 'waiting_user' | 'error' | 'finished'

/**
 * Retry context for tracking failed attempts
 */
export interface RetryContext {
  actionId: string
  attempts: number
  lastError?: string
  strategies: string[]
  startTime: number
}

/**
 * Clarification request tracking
 */
export interface ClarificationRecord {
  id: string
  questions: string[]
  reason: string
  assumptions?: string[]
  alternatives?: string[]
  userResponses?: string[]
  timestamp: number
  resolved: boolean
}

/**
 * Unified state management for agent execution
 * Tracks history, metrics, context, and current status
 */
export class State {
  // Conversation & Execution
  history: Event[] = []
  currentTask: string | null = null
  
  // Metrics
  metrics: Metrics = {
    iterations: 0,
    toolCalls: 0,
    retrievalCalls: 0,
    startTime: Date.now()
  }
  
  // Context
  sessionId: string
  workspaceInfo?: WorkspaceInfo
  
  // Status
  status: AgentStatus = 'idle'
  lastError?: Error
  
  // Retry tracking
  private retryContexts: Map<string, RetryContext> = new Map()
  
  // Clarification tracking
  private clarificationHistory: ClarificationRecord[] = []
  
  // Additional metadata
  metadata: Record<string, unknown> = {}
  
  constructor(sessionId: string) {
    this.sessionId = sessionId
  }
  
  /**
   * Get last N events from history
   */
  getRecentHistory(n: number): Event[] {
    return this.history.slice(-n)
  }
  
  /**
   * Get last user message from history
   */
  getLastUserMessage(): MessageAction | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const event = this.history[i]
      if (
        isAction(event) &&
        event.action === 'message' &&
        event.source === 'user'
      ) {
        return event as MessageAction
      }
    }
    return null
  }
  
  /**
   * Add event to history
   */
  addEvent(event: Event): void {
    this.history.push(event)
    
    // Update metrics
    if (isAction(event)) {
      if (event.action === 'tool_call') {
        this.metrics.toolCalls++
        
        // Check if it's a retrieval call
        const toolCall = event as { toolName: string }
        if (toolCall.toolName === 'retrieve_context') {
          this.metrics.retrievalCalls++
        }
      }
    }
  }
  
  /**
   * Start a new iteration
   */
  startIteration(): void {
    this.metrics.iterations++
    this.status = 'running'
  }
  
  /**
   * Mark state as finished
   */
  finish(): void {
    this.status = 'finished'
    this.metrics.endTime = Date.now()
  }
  
  /**
   * Mark state as error
   */
  setError(error: Error): void {
    this.status = 'error'
    this.lastError = error
  }
  
  /**
   * Mark state as waiting for user input
   */
  waitForUser(): void {
    this.status = 'waiting_user'
    console.log('[State] Status changed to waiting_user')
  }
  
  /**
   * Get execution duration in milliseconds
   */
  getDuration(): number {
    const endTime = this.metrics.endTime || Date.now()
    return endTime - this.metrics.startTime
  }
  
  /**
   * Convert state to summary object
   */
  toSummary(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      status: this.status,
      iterations: this.metrics.iterations,
      toolCalls: this.metrics.toolCalls,
      retrievalCalls: this.metrics.retrievalCalls,
      duration: this.getDuration(),
      historyLength: this.history.length,
      currentTask: this.currentTask
    }
  }
  
  /**
   * Reset state for new conversation
   */
  reset(): void {
    this.history = []
    this.currentTask = null
    this.metrics = {
      iterations: 0,
      toolCalls: 0,
      retrievalCalls: 0,
      startTime: Date.now()
    }
    this.status = 'idle'
    this.lastError = undefined
    this.retryContexts = new Map()
    this.metadata = {}
  }

  /**
   * Registra tentativa de ação
   */
  recordAttempt(actionId: string, error?: string): RetryContext {
    const existing = this.retryContexts.get(actionId)

    if (existing) {
      existing.attempts++
      existing.lastError = error
      return existing
    }

    const context: RetryContext = {
      actionId,
      attempts: 1,
      lastError: error,
      strategies: [],
      startTime: Date.now()
    }

    this.retryContexts.set(actionId, context)
    return context
  }

  /**
   * Verifica se deve tentar novamente
   */
  shouldRetry(actionId: string, maxAttempts = 3): boolean {
    const context = this.retryContexts.get(actionId)
    return !context || context.attempts < maxAttempts
  }

  /**
   * Limpa contexto de retry após sucesso
   */
  clearRetry(actionId: string): void {
    this.retryContexts.delete(actionId)
  }

  /**
   * Get retry context para informar próximo step
   */
  getRetryContext(actionId: string): RetryContext | undefined {
    return this.retryContexts.get(actionId)
  }

  /**
   * Get all active retry contexts
   */
  getActiveRetries(): RetryContext[] {
    return Array.from(this.retryContexts.values())
  }
  
  /**
   * Mark state as running after receiving user input
   */
  resumeExecution(): void {
    if (this.status === 'waiting_user') {
      this.status = 'running'
      console.log('[State] Status changed to running - resuming execution')
    }
  }
  
  /**
   * Check if currently waiting for user clarification
   */
  isWaitingForClarification(): boolean {
    return this.status === 'waiting_user' && this.getLastUnresolvedClarification() !== null
  }
  
  /**
   * Get context from resolved clarifications for prompt building
   */
  getClarificationContext(): string {
    const resolved = this.getResolvedClarifications()
    if (resolved.length === 0) return ''
    
    let context = '\n## User-Provided Context from Previous Clarifications:\n\n'
    
    for (const clarification of resolved) {
      context += `**Questions asked:**\n`
      clarification.questions.forEach((q, i) => {
        context += `${i + 1}. ${q}\n`
      })
      
      if (clarification.userResponses && clarification.userResponses.length > 0) {
        context += `\n**User's answers:**\n`
        clarification.userResponses.forEach((r, i) => {
          context += `${i + 1}. ${r}\n`
        })
      }
      context += '\n'
    }
    
    return context
  }
  
  /**
   * Record a clarification request from the agent
   */
  recordClarification(questions: string[], reason: string, id: string, assumptions?: string[], alternatives?: string[]): ClarificationRecord {
    const record: ClarificationRecord = {
      id,
      questions,
      reason,
      assumptions,
      alternatives,
      timestamp: Date.now(),
      resolved: false
    }
    
    this.clarificationHistory.push(record)
    console.log(`[State] Recorded clarification request: ${id} with ${questions.length} questions`)
    return record
  }
  
  /**
   * Add user responses to a clarification
   */
  addClarificationResponses(id: string, responses: string[]): boolean {
    const clarification = this.clarificationHistory.find(c => c.id === id)
    if (clarification) {
      clarification.userResponses = responses
      clarification.resolved = true
      console.log(`[State] Added responses to clarification: ${id}`)
      return true
    }
    console.warn(`[State] Clarification not found: ${id}`)
    return false
  }
  
  /**
   * Get the last unresolved clarification (if any)
   */
  getLastUnresolvedClarification(): ClarificationRecord | null {
    for (let i = this.clarificationHistory.length - 1; i >= 0; i--) {
      const clarification = this.clarificationHistory[i]
      if (!clarification.resolved) {
        return clarification
      }
    }
    return null
  }
  
  /**
   * Get all clarifications (for context building)
   */
  getAllClarifications(): ClarificationRecord[] {
    return [...this.clarificationHistory]
  }
  
  /**
   * Get resolved clarifications that might provide useful context
   */
  getResolvedClarifications(): ClarificationRecord[] {
    return this.clarificationHistory.filter(c => c.resolved)
  }
}
