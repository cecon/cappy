/**
 * @fileoverview Work Plan types for structured task planning
 * @module codeact/types/work-plan
 */

/**
 * Status of a step in the plan
 */
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

/**
 * Plan overall status
 */
export type PlanStatus = 'draft' | 'ready' | 'in_progress' | 'completed' | 'failed'

/**
 * File reference with optional line range
 */
export interface FileReference {
  path: string
  startLine?: number
  endLine?: number
  description?: string
}

/**
 * Action to be performed in a step
 */
export interface StepAction {
  type: 'create_file' | 'edit_file' | 'run_command' | 'ask_user' | 'custom'
  details: string
  expectedOutput?: string
}

/**
 * Context information for a step
 */
export interface StepContext {
  reasoning: string
  constraints?: string[]
  dependencies?: string[]
}

/**
 * Validation criteria for a step
 */
export interface StepValidation {
  command?: string
  expectedResult?: string
}

/**
 * Execution metadata for a step
 */
export interface StepExecution {
  startedAt?: string
  completedAt?: string
  duration?: number
  llmCalls?: number
  error?: string
}

/**
 * Individual step in the implementation
 */
export interface PlanStep {
  id: string
  title: string
  description: string
  status: StepStatus
  
  // What the LLM should do
  action: StepAction
  
  // Context for the LLM
  context?: StepContext
  
  // Relevant files for this step
  relevantFiles: FileReference[]
  
  // Validation
  validation?: StepValidation
  
  // Execution metadata
  execution?: StepExecution
}

/**
 * Condition for running a hook
 */
export interface HookCondition {
  onSuccess?: boolean
  onFailure?: boolean
  onStepsCompleted?: string[] // Run only if these step IDs are completed
}

/**
 * Hook action configuration
 */
export interface HookAction {
  type: 'git_commit' | 'run_tests' | 'update_docs' | 'update_embeddings' | 'custom'
  command?: string
  params?: Record<string, unknown>
}

/**
 * Post-execution hook (always run after plan completion)
 */
export interface PostExecutionHook {
  id: string
  name: string
  description: string
  enabled: boolean
  order: number
  
  action: HookAction
  
  // Condition to run (optional)
  condition?: HookCondition
}

/**
 * Clarification obtained during planning
 */
export interface Clarification {
  question: string
  answer: string
  source: 'user' | 'retrieved' | 'inferred'
}

/**
 * Plan goal definition
 */
export interface PlanGoal {
  title: string
  description: string
  userRequest: string
  clarifications?: Clarification[]
}

/**
 * Plan requirements
 */
export interface PlanRequirements {
  functional: string[]
  technical: string[]
  constraints: string[]
}

/**
 * Context from codebase
 */
export interface PlanContext {
  relevantFiles: FileReference[]
  dependencies: string[]
  architecture: string
  patterns: string[]
}

/**
 * Test case definition
 */
export interface TestCase {
  id: string
  description: string
  type: 'unit' | 'integration' | 'e2e'
  command?: string
}

/**
 * Testing strategy
 */
export interface TestingStrategy {
  strategy: string
  testCases: TestCase[]
}

/**
 * Success criterion
 */
export interface SuccessCriterion {
  id: string
  description: string
  verified: boolean
}

/**
 * Plan execution metrics
 */
export interface PlanMetrics {
  totalSteps: number
  completedSteps: number
  failedSteps: number
  totalDuration?: number
  llmCallsTotal?: number
}

/**
 * Complete work plan structure
 */
export interface WorkPlan {
  // Metadata
  id: string
  version: string
  createdAt: string
  updatedAt: string
  status: PlanStatus
  
  // Goal
  goal: PlanGoal
  
  // Requirements
  requirements: PlanRequirements
  
  // Context from codebase
  context: PlanContext
  
  // Implementation steps
  steps: PlanStep[]
  
  // Post-execution hooks (always run)
  postExecutionHooks: PostExecutionHook[]
  
  // Testing strategy
  testing: TestingStrategy
  
  // Success criteria
  successCriteria: SuccessCriterion[]
  
  // Execution metrics
  metrics?: PlanMetrics
}
