/**
 * @fileoverview Common state management for the Intelligent Agent system
 * @module agents/common/state
 */

import type { AgentMessage } from './types';

/**
 * Base state shared across all agents
 */
export interface BaseAgentState {
  /** Unique session identifier */
  sessionId: string;
  
  /** Current conversation messages */
  messages: AgentMessage[];
  
  /** Current phase of planning */
  phase: string;
  
  /** Whether awaiting user input */
  awaitingUser: boolean;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Supervisor state - orchestrates all agents
 */
export interface SupervisorState extends BaseAgentState {
  /** Current active agent */
  currentAgent: string | null;
  
  /** Plan confirmed by user */
  planConfirmed?: boolean;
  
  /** Ready for execution */
  readyForExecution?: boolean;
}

/**
 * Brain state - research and analysis
 */
export interface BrainState extends BaseAgentState {
  /** Research results */
  researchResults?: string[];
  
  /** Summaries */
  summaries?: string[];
  
  /** Debate conclusions */
  debateConclusions?: string[];
}

/**
 * Planning state
 */
export interface PlanningState extends BaseAgentState {
  /** Recommended approach */
  recommendation?: string;
  
  /** Generated plan */
  plan?: string;
  
  /** Plan critiques */
  critiques?: string[];
  
  /** Refined plan */
  refinedPlan?: string;
}

/**
 * Execution state
 */
export interface ExecutionState extends BaseAgentState {
  /** Approved plan */
  plan?: string;
  
  /** Execution results */
  executionResults?: string[];
  
  /** Deliverables */
  deliverables?: string[];
}
