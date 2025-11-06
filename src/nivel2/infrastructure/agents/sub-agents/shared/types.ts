/**
 * @fileoverview Types and interfaces for sub-agent architecture
 * @module sub-agents/shared/types
 */

import type { Message } from '../../../../../domains/chat/entities/message'

/**
 * Category of user request
 */
export type IntentCategory = 
  | 'feature-implementation'
  | 'bug-fix'
  | 'refactoring'
  | 'documentation'
  | 'testing'
  | 'architecture'
  | 'greeting'
  | 'clarification'
  | 'general'

/**
 * User intent extracted from message
 */
export interface Intent {
  /** Main objective described by user */
  readonly objective: string
  
  /** Technical terms found in the message */
  readonly technicalTerms: readonly string[]
  
  /** Category of the request */
  readonly category: IntentCategory
  
  /** Confidence score 0-1 (how clear the intent is) */
  readonly clarityScore: number
  
  /** Ambiguous parts that need clarification */
  readonly ambiguities: readonly string[]
  
  /** Original raw message */
  readonly rawMessage: string
}

/**
 * Context provided to sub-agents
 */
export interface SubAgentContext {
  /** Current user message */
  readonly userMessage: string
  
  /** Extracted intent (if available) */
  readonly intent?: Intent
  
  /** Conversation history */
  readonly history?: readonly Message[]
  
  /** Unique session identifier */
  readonly sessionId?: string
  
  /** Clarification state (if in clarification flow) */
  readonly clarificationState?: ClarificationState
  
  /** Callback to request user input during processing */
  readonly onPromptRequest?: (prompt: PromptRequest) => Promise<string>
  
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Metadata attached to agent responses
 */
export interface ResponseMetadata {
  /** Name of the agent that generated the response */
  readonly agentName: string
  
  /** Priority level of the agent */
  readonly agentPriority: number
  
  /** Processing time in milliseconds */
  readonly processingTimeMs?: number
  
  /** Number of contexts retrieved from database */
  readonly retrievalCount?: number
  
  /** Confidence score of the response (0-1) */
  readonly confidence?: number
  
  /** Additional data specific to agent type */
  readonly [key: string]: unknown
}

/**
 * Response from a sub-agent
 */
export interface SubAgentResponse {
  /** Response content to show user */
  readonly content: string
  
  /** Whether more information is needed from user */
  readonly needsMoreInfo: boolean
  
  /** Suggested next agent to invoke (optional) */
  readonly nextAgent?: string
  
  /** Rich metadata about the response */
  readonly metadata: ResponseMetadata
}

/**
 * Request for user input during agent processing
 */
export interface PromptRequest {
  /** Unique identifier for this prompt */
  readonly messageId: string
  
  /** The question or prompt to show the user */
  readonly prompt: string
  
  /** Optional suggestions/options for the user */
  readonly suggestions?: readonly string[]
  
  /** Type of prompt (question, confirmation, choice) */
  readonly type?: 'question' | 'confirmation' | 'choice'
}

/**
 * State maintained during clarification conversation
 */
export interface ClarificationState {
  /** Original intent that triggered clarification */
  readonly originalIntent: Intent
  
  /** Questions that have been asked */
  readonly questionsAsked: string[]
  
  /** Answers received from user */
  readonly answersReceived: string[]
  
  /** Current clarity progress (0-1) */
  readonly clarityProgress: number
  
  /** Enriched intent after clarification */
  readonly enrichedIntent?: Intent
}

/**
 * Base interface for all sub-agents
 */
export interface SubAgent {
  /** Unique identifier for the agent */
  readonly name: string
  
  /** Priority level (higher = runs first) */
  readonly priority: number
  
  /**
   * Determines if this agent can handle the given context
   * @param context - User context and intent
   * @returns true if agent can handle, false otherwise
   */
  canHandle(context: SubAgentContext): boolean | Promise<boolean>
  
  /**
   * Process the context and generate a response
   * @param context - User context and intent
   * @returns Complete response with metadata
   */
  process(context: SubAgentContext): Promise<SubAgentResponse>
  
  /**
   * Process the context with streaming support (optional)
   * @param context - User context and intent
   * @returns AsyncIterable of response chunks
   */
  processStream?(context: SubAgentContext): AsyncIterable<string>
}

/**
 * Decision made by orchestrator when selecting an agent
 */
export interface AgentDecision {
  /** The agent selected to handle the request */
  readonly selectedAgent: SubAgent
  
  /** Confidence in this selection (0-1) */
  readonly confidence: number
  
  /** Human-readable reason for selection */
  readonly reason: string
  
  /** Timestamp of decision */
  readonly timestamp: Date
  
  /** All agents that were considered */
  readonly consideredAgents?: readonly string[]
}
