/**
 * @fileoverview Base Agent class
 * @module codeact/core/base-agent
 * 
 * Inspired by OpenHands Agent base class
 */

import type { State } from './state'
import type { AnyAction } from './actions'
import type { Tool } from './tool'

/**
 * Configuration for agent
 */
export interface AgentConfig {
  maxIterations?: number
  temperature?: number
  enableThinking?: boolean
  enableTools?: boolean
}

/**
 * Abstract base class for all agents (OpenHands pattern)
 */
export abstract class BaseAgent {
  protected config: AgentConfig
  protected tools: Tool[]
  
  constructor(config: AgentConfig = {}) {
    this.config = {
      maxIterations: 10,
      temperature: 0.7,
      enableThinking: true,
      enableTools: true,
      ...config
    }
    this.tools = []
  }
  
  /**
   * Execute one step: decide next action (OpenHands pattern)
   * ONLY decides - does NOT execute
   * 
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
   * Reset agent state
   */
  reset(): void {
    // Override in subclasses if needed
  }
}
