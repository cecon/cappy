/**
 * @fileoverview Common types for the Intelligent Agent system
 * @module agents/common/types
 */

/**
 * Base message structure for agent communication
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Tool result from LangChain tools
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Agent execution result
 */
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  messages?: AgentMessage[];
}

/**
 * Progress callback for reporting status
 * Can be either a simple string message or a detailed progress event
 */
export type ProgressCallback = (message: string | import('../types/progress-events').AgentProgressEvent) => void;

/**
 * Router intention types
 */
export type RouterIntent = 'task' | 'question' | 'smalltalk' | 'unknown';

/**
 * Planning phase types
 */
export type PlanningPhase = 
  | 'intention'
  | 'refinement'
  | 'research'
  | 'planning'
  | 'critique'
  | 'refinement-plan'
  | 'execution'
  | 'completed';

/**
 * Session turn request
 */
export interface SessionTurnRequest {
  sessionId: string;
  message: string;
}

/**
 * Session turn result
 */
export interface SessionTurnResult {
  result: PlanningTurnResult;
  isContinuation: boolean;
}

/**
 * Planning turn result
 */
export interface PlanningTurnResult {
  phase: PlanningPhase;
  routerIntent?: RouterIntent;
  intentionSummary?: string;
  confirmed?: boolean;
  readyForExecution?: boolean;
  awaitingUser?: boolean;
  responseMessage?: string;
  finalResponse?: string;
  conversationLog?: AgentMessage[];
}
