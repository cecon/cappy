/**
 * @fileoverview Action types for agent execution
 * @module codeact/core/actions
 * 
 * Inspired by OpenHands action system
 */

/**
 * Base type for all actions
 */
export interface Action {
  type: 'action'
  action: string
  timestamp: number
  source: 'user' | 'assistant'
}

/**
 * Message action (conversation)
 */
export interface MessageAction extends Action {
  action: 'message'
  content: string
}

/**
 * Tool call action
 */
export interface ToolCallAction extends Action {
  action: 'tool_call'
  toolName: string
  input: Record<string, unknown>
  callId: string
}

/**
 * Think action (internal reasoning)
 */
export interface ThinkAction extends Action {
  action: 'think'
  thought: string
}

/**
 * Finish action (end conversation)
 */
export interface FinishAction extends Action {
  action: 'finish'
  outputs?: Record<string, unknown>
  summary?: string
}

/**
 * Union type of all possible actions
 */
export type AnyAction = MessageAction | ToolCallAction | ThinkAction | FinishAction

/**
 * Helper to create a message action
 */
export function createMessageAction(content: string, source: 'user' | 'assistant'): MessageAction {
  return {
    type: 'action',
    action: 'message',
    content,
    timestamp: Date.now(),
    source
  }
}

/**
 * Helper to create a tool call action
 */
export function createToolCallAction(
  toolName: string,
  input: Record<string, unknown>,
  callId: string
): ToolCallAction {
  return {
    type: 'action',
    action: 'tool_call',
    toolName,
    input,
    callId,
    timestamp: Date.now(),
    source: 'assistant'
  }
}

/**
 * Helper to create a think action
 */
export function createThinkAction(thought: string): ThinkAction {
  return {
    type: 'action',
    action: 'think',
    thought,
    timestamp: Date.now(),
    source: 'assistant'
  }
}

/**
 * Helper to create a finish action
 */
export function createFinishAction(outputs?: Record<string, unknown>, summary?: string): FinishAction {
  return {
    type: 'action',
    action: 'finish',
    outputs,
    summary,
    timestamp: Date.now(),
    source: 'assistant'
  }
}
