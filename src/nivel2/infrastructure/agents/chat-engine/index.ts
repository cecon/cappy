// Main chat engine - using OrchestratedChatEngine with sub-agents
export { OrchestratedChatEngine } from './orchestrated-chat-engine'

// Types
export type * from './types'

// Phase handlers
export { PhaseOrchestrator } from './phases/phase-orchestrator'
export { IntentPhaseHandler } from './phases/intent-phase'
export { ContextPhaseHandler } from './phases/context-phase'
export { QuestionsPhaseHandler } from './phases/questions-phase'
export { OptionsPhaseHandler } from './phases/options-phase'
export { SpecPhaseHandler } from './phases/spec-phase'

// Utilities
export { detectGreeting, generateSessionId, shouldStopDueToMaxSteps } from './utils/conversation-utils'

// Parsers
export { parseJsonSafely, parseRetrievalResult, parseIntent, parseQuestions, parseOptions } from './parsers/json-parser'

// Prompts
export { ANALYST_SYSTEM_PROMPT, PHASE_PROMPTS, GREETING_RESPONSE } from './prompts/system-prompts-v2'