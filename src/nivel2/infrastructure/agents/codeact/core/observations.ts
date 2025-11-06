/**
 * @fileoverview Observation types for action results
 * @module codeact/core/observations
 * 
 * Inspired by OpenHands observation system
 */

/**
 * Base type for all observations
 */
export interface Observation {
  type: 'observation'
  observation: string
  timestamp: number
}

/**
 * Tool result observation
 */
export interface ToolResultObservation extends Observation {
  observation: 'tool_result'
  toolName: string
  callId: string
  result: string | Record<string, unknown>
  success: boolean
}

/**
 * Error observation
 */
export interface ErrorObservation extends Observation {
  observation: 'error'
  error: string
  details?: unknown
}

/**
 * Success observation (generic success)
 */
export interface SuccessObservation extends Observation {
  observation: 'success'
  message?: string
}

/**
 * Union type of all possible observations
 */
export type AnyObservation = ToolResultObservation | ErrorObservation | SuccessObservation

/**
 * Helper to create a tool result observation
 */
export function createToolResultObservation(
  toolName: string,
  callId: string,
  result: string | Record<string, unknown>,
  success: boolean
): ToolResultObservation {
  return {
    type: 'observation',
    observation: 'tool_result',
    toolName,
    callId,
    result,
    success,
    timestamp: Date.now()
  }
}

/**
 * Helper to create an error observation
 */
export function createErrorObservation(error: string, details?: unknown): ErrorObservation {
  return {
    type: 'observation',
    observation: 'error',
    error,
    details,
    timestamp: Date.now()
  }
}

/**
 * Helper to create a success observation
 */
export function createSuccessObservation(message?: string): SuccessObservation {
  return {
    type: 'observation',
    observation: 'success',
    message,
    timestamp: Date.now()
  }
}
