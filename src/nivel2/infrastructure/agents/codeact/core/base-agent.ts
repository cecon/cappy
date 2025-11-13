/**
 * @fileoverview Base Agent class
 * @module codeact/core/base-agent
 */

import type { State } from './state'
import type { AnyAction } from './actions'
import type { Tool } from './tool'

/**
 * Configuration for agent
 */
export interface AgentConfig {
  temperature?: number
  model?: string
}

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent {
  protected config: AgentConfig
  protected tools: Tool[]
  
  constructor(config: AgentConfig = {}) {
    this.config = {
      temperature: 0.7,
      model: 'claude-sonnet-4-20250514',
      ...config
    }
    this.tools = this.initializeTools()
  }
  
  /**
   * Decide next action based on current state
   * This is called once per user message
   * 
   * @param state - Current conversation state
   * @returns Action to be executed by the controller
   */
  abstract step(state: State): Promise<AnyAction>
  
  /**
   * Initialize tools available to this agent
   */
  protected abstract initializeTools(): Tool[]
  
  /**
   * Get tools available to this agent (for controller to execute)
   */
  getTools(): readonly Tool[] {
    return this.tools
  }
  
  /**
   * Reset agent state (if needed)
   */
  reset(): void {
    // Override in subclasses if needed
  }
}