/**
 * Types for multi-agent planning system
 * Designed for Project Scoping and Requirements Analysis
 */

// ===============================
// CORE DOMAIN TYPES
// ===============================

/**
 * Project Context - Understanding the problem space
 */
export interface ProjectContext {
  problem: string
  objective: string
  targetUsers?: string[]
  businessGoals?: string[]
  existingSystem?: string
  filesAnalyzed: string[]
  patternsFound: string[]
  externalDependencies: string[]
}

/**
 * Functional Requirements - What the system must do
 */
export interface FunctionalRequirement {
  id: string
  description: string
  priority: 'must-have' | 'should-have' | 'nice-to-have'
  userStory?: string
  acceptanceCriteria: string[]
  relatedComponents: string[]
}

/**
 * Non-Functional Requirements - Quality attributes
 */
export interface NonFunctionalRequirement {
  id: string
  category: 'performance' | 'security' | 'scalability' | 'maintainability' | 'usability' | 'reliability'
  description: string
  metric?: string
  priority: 'must-have' | 'should-have' | 'nice-to-have'
}

/**
 * System Component - Building blocks
 */
export interface SystemComponent {
  id: string
  name: string
  type: 'service' | 'module' | 'database' | 'api' | 'ui' | 'library' | 'integration'
  description: string
  responsibilities: string[]
  dependencies: string[] // IDs of other components
  technology?: string
}

/**
 * User Flow - How users interact with the system
 */
export interface UserFlow {
  id: string
  name: string
  actor: string
  steps: string[]
  alternativePaths?: string[]
  requiredComponents: string[]
}

/**
 * Technical Decision - Architecture choices made
 */
export interface TechnicalDecision {
  id: string
  topic: string
  decision: string
  rationale: string
  alternatives?: string[]
  tradeoffs?: string
  status: 'proposed' | 'approved' | 'rejected'
}

/**
 * Question & Answer - Clarifications collected
 */
export interface QuestionAnswer {
  id: string
  question: string
  answer?: string
  critical: boolean
  relatedTo: string[] // Component IDs or requirement IDs
  askedAt: string
  answeredAt?: string
}

/**
 * Risk Assessment
 */
export interface ProjectRisk {
  id: string
  description: string
  category: 'technical' | 'resource' | 'timeline' | 'dependency' | 'scope'
  severity: 'low' | 'medium' | 'high' | 'critical'
  probability: 'low' | 'medium' | 'high'
  mitigation: string
  owner?: string
}

/**
 * Atomic Task - Executable work item
 */
export interface AtomicTask {
  id: string
  title: string
  description: string
  type: 'implementation' | 'refactoring' | 'testing' | 'documentation' | 'setup'
  estimatedEffort?: string
  file?: string
  lineStart?: number
  lineEnd?: number
  dependencies: string[] // IDs of other tasks
  validation: string
  status: 'pending' | 'ready' | 'in-progress' | 'completed'
  assignedComponent?: string
}

/**
 * Assumption - Things we're assuming to be true
 */
export interface Assumption {
  id: string
  description: string
  critical: boolean
  needsValidation: boolean
  validatedAt?: string
}

/**
 * Glossary Entry - Domain terminology
 */
export interface GlossaryEntry {
  term: string
  definition: string
  synonyms?: string[]
  relatedTerms?: string[]
}

// ===============================
// MAIN PLAN STRUCTURE
// ===============================

/**
 * Complete Development Plan - Project Scope Document
 * 
 * This is the "state" that grows through the multi-agent workflow
 * transforming vague ideas into executable specifications
 */
export interface DevelopmentPlan {
  id: string
  title: string
  
  // 1. Context & Problem
  context: ProjectContext
  
  // 2. Requirements
  functionalRequirements: FunctionalRequirement[]
  nonFunctionalRequirements: NonFunctionalRequirement[]
  
  // 3. Architecture & Design
  proposedArchitecture?: string
  components: SystemComponent[]
  userFlows: UserFlow[]
  
  // 4. Technical Decisions
  decisions: TechnicalDecision[]
  
  // 5. Clarifications & Knowledge
  questions: QuestionAnswer[]
  assumptions: Assumption[]
  glossary: GlossaryEntry[]
  
  // 6. Risk Management
  risks: ProjectRisk[]
  
  // 7. Execution Plan
  atomicTasks: AtomicTask[]
  successCriteria: string[]
  
  // 8. Metadata
  createdAt: string
  updatedAt: string
  status: 'draft' | 'analyzing' | 'clarifying' | 'ready' | 'approved' | 'in-execution' | 'completed'
  version: number
  maturityScore?: number // 0-100, calculated by router
}

// ===============================
// AGENT COMMUNICATION TYPES
// ===============================

/**
 * Feedback from Critic Agent
 */
export interface CriticFeedback {
  category: 'scope-gap' | 'implicit-assumption' | 'missing-dependency' | 'inconsistency' | 'risk' | 'improvement'
  target?: string // Component/requirement ID
  issue: string
  severity: 'info' | 'warning' | 'critical'
  suggestion: string
  requiresClarification: boolean
  impact?: string
}

/**
 * Message in agent conversation
 */
export interface AgentMessage {
  role: 'planning' | 'critic' | 'clarification' | 'router' | 'user'
  content: string
  planUpdate?: Partial<DevelopmentPlan>
  feedback?: CriticFeedback[]
  timestamp: string
}

// ===============================
// LEGACY COMPATIBILITY (deprecated)
// ===============================

/** @deprecated Use ProjectContext instead */
export interface PlanContext {
  filesAnalyzed: string[]
  patternsFound: string[]
  dependencies: string[]
  assumptions: string[]
}

/** @deprecated Use AtomicTask instead */
export interface PlanStep {
  id: string
  title: string
  description: string
  file?: string
  lineStart?: number
  lineEnd?: number
  dependencies: string[]
  validation: string
  rationale: string
  status: 'pending' | 'clarifying' | 'ready' | 'completed'
}

/** @deprecated Use QuestionAnswer instead */
export interface PlanClarification {
  id: string
  question: string
  answer?: string
  critical: boolean
  relatedSteps: string[]
}

/** @deprecated Use ProjectRisk instead */
export interface PlanRisk {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high'
  mitigation: string
}
