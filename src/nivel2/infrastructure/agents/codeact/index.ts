/**
 * @fileoverview Main exports for CodeAct agent system
 * @module codeact
 */

// Core types and classes
export { State } from './core/state'
export type { AgentStatus, Metrics, WorkspaceInfo } from './core/state'

export type { Action, MessageAction, ToolCallAction, ThinkAction, FinishAction, AnyAction } from './core/actions'
export { createMessageAction, createToolCallAction, createThinkAction, createFinishAction } from './core/actions'

export type { Observation, ToolResultObservation, ErrorObservation, SuccessObservation, AnyObservation } from './core/observations'
export { createToolResultObservation, createErrorObservation, createSuccessObservation } from './core/observations'

export type { Event } from './core/events'
export { isAction, isObservation } from './core/events'

export type { Tool, ToolParameter, ToolResult, ToolSchema } from './core/tool'
export { BaseTool } from './core/tool'

export { BaseAgent } from './core/base-agent'
export type { AgentConfig } from './core/base-agent'

// Main agent
export { CappyAgent } from './cappy-agent'

// Tools
export { ThinkTool } from './tools/think-tool'
export { FinishTool } from './tools/finish-tool'
export { RetrieveContextTool } from './tools/retrieve-context-tool'
