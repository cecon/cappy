/**
 * Types and interfaces for Chat Tools system
 */

import * as vscode from 'vscode'

/**
 * Base interface for tool metadata
 */
export interface ToolMetadata {
  /** Unique tool identifier (with cappy_ prefix) */
  id: string
  /** Human-readable name */
  name: string
  /** Tool description */
  description: string
  /** Tool category */
  category: ToolCategory
  /** Tool version */
  version: string
  /** Whether tool requires user confirmation */
  requiresConfirmation: boolean
  /** Estimated execution time in milliseconds */
  estimatedDuration?: number
}

/**
 * Tool categories
 */
export const ToolCategory = {
  /** Native VS Code integrations */
  NATIVE: 'native',
  /** Cappy-specific tools */
  CAPPY: 'cappy',
  /** External service integrations */
  EXTERNAL: 'external',
  /** File system operations */
  FILESYSTEM: 'filesystem',
  /** Network operations */
  NETWORK: 'network',
  /** Code analysis */
  ANALYSIS: 'analysis',
  /** Task management */
  TASK: 'task'
} as const

export type ToolCategory = typeof ToolCategory[keyof typeof ToolCategory]

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Whether execution was successful */
  success: boolean
  /** Result message */
  message: string
  /** Additional data */
  data?: unknown
  /** Error if execution failed */
  error?: Error
  /** Execution duration in milliseconds */
  duration?: number
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** User who triggered the tool */
  user?: string
  /** Session ID */
  sessionId: string
  /** Message ID that triggered the tool */
  messageId: string
  /** Timestamp */
  timestamp: Date
  /** Workspace folder */
  workspaceFolder?: vscode.WorkspaceFolder
}

/**
 * Tool confirmation request
 */
export interface ToolConfirmationRequest {
  /** Unique message ID for this confirmation */
  messageId: string
  /** Confirmation question */
  question: string
  /** Tool call information */
  toolCall: {
    name: string
    input: unknown
  }
}

/**
 * Tool confirmation response
 */
export interface ToolConfirmationResponse {
  /** Message ID this response is for */
  messageId: string
  /** User response ('yes' or 'no') */
  response: 'yes' | 'no'
}

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry {
  /** Tool metadata */
  metadata: ToolMetadata
  /** Tool instance */
  tool: vscode.LanguageModelTool<unknown>
  /** VS Code disposable for cleanup */
  disposable: vscode.Disposable
}

/**
 * Tool usage metrics
 */
export interface ToolUsageMetrics {
  /** Tool ID */
  toolId: string
  /** Total invocations */
  totalInvocations: number
  /** Successful invocations */
  successfulInvocations: number
  /** Failed invocations */
  failedInvocations: number
  /** User cancellations */
  userCancellations: number
  /** Average execution time */
  averageExecutionTime: number
  /** Last used timestamp */
  lastUsed?: Date
}

/**
 * Tool error types
 */
export const ToolErrorType = {
  /** Input validation failed */
  VALIDATION_ERROR: 'validation_error',
  /** Execution failed */
  EXECUTION_ERROR: 'execution_error',
  /** User cancelled */
  USER_CANCELLED: 'user_cancelled',
  /** Timeout */
  TIMEOUT: 'timeout',
  /** Permission denied */
  PERMISSION_DENIED: 'permission_denied',
  /** Not found */
  NOT_FOUND: 'not_found',
  /** Unknown error */
  UNKNOWN: 'unknown'
} as const

export type ToolErrorType = typeof ToolErrorType[keyof typeof ToolErrorType]

/**
 * Tool error
 */
export class ToolError extends Error {
  type: ToolErrorType
  cause?: Error

  constructor(
    type: ToolErrorType,
    message: string,
    cause?: Error
  ) {
    super(message)
    this.name = 'ToolError'
    this.type = type
    this.cause = cause
  }
}

/**
 * Tool input validator
 */
export interface ToolInputValidator<T> {
  /** Validate input */
  validate(input: unknown): input is T
  /** Get validation error message */
  getErrorMessage(input: unknown): string
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  /** Timeout in milliseconds */
  timeout?: number
  /** Whether to skip user confirmation */
  skipConfirmation?: boolean
  /** Retry attempts on failure */
  retryAttempts?: number
  /** Context for execution */
  context?: ToolExecutionContext
}
