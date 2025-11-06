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
    this.metadata = {}
  }
}
