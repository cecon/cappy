/**
 * @fileoverview Base Agent class
 * @module codeact/core/base-agent
 * 
 * Inspired by OpenHands Agent base class
 */

import type { State } from './state'
import type { AnyAction } from './actions'
import type { AnyObservation, ToolResultObservation } from './observations'
import type { Tool } from './tool'

/**
 * Configuration for agent
 */
export interface AgentConfig {
  maxIterations?: number
  temperature?: number
  enableThinking?: boolean
  enableTools?: boolean
  mode?: 'plan' | 'code'
}

/**
 * Abstract base class for all agents (OpenHands pattern with agent-controlled iteration)
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
   * Decide if agent wants to continue after observing result
   * This gives the agent control over iteration flow
   * 
   * @param observation - Result of last action
   * @param state - Current state
   * @returns true if agent wants another iteration, false to stop
   */
  shouldContinue(observation: AnyObservation, state: State): boolean {
    // Default implementation: stop if finish tool was called successfully
    if (observation.observation === 'tool_result') {
      const result = observation as ToolResultObservation
      
      if (result.toolName === 'finish' && result.success) {
        return false // Stop after finish
      }
    }
    
    // Continue if error and haven't exceeded max iterations
    if (state.metrics.iterations >= this.config.maxIterations!) {
      return false // Safety limit
    }
    
    // Default: continue
    return true
  }
  
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
