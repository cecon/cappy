/**
 * Types for multi-agent planning system
 */

export interface PlanStep {
  id: string
  title: string
  description: string
  file?: string
  lineStart?: number
  lineEnd?: number
  dependencies: string[] // IDs of other steps
  validation: string
  rationale: string
  status: 'pending' | 'clarifying' | 'ready' | 'completed'
}

export interface PlanContext {
  filesAnalyzed: string[]
  patternsFound: string[]
  dependencies: string[]
  assumptions: string[]
}

export interface PlanClarification {
  id: string
  question: string
  answer?: string
  critical: boolean
  relatedSteps: string[]
}

export interface PlanRisk {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high'
  mitigation: string
}

export interface DevelopmentPlan {
  id: string
  title: string
  goal: string
  context: PlanContext
  steps: PlanStep[]
  clarifications: PlanClarification[]
  risks: PlanRisk[]
  successCriteria: string[]
  createdAt: string
  updatedAt: string
  status: 'draft' | 'clarifying' | 'ready' | 'in-progress' | 'completed'
  version: number
}

export interface CriticFeedback {
  stepId?: string
  issue: string
  severity: 'info' | 'warning' | 'critical'
  suggestion: string
  requiresClarification: boolean
}

export interface AgentMessage {
  role: 'planning' | 'critic' | 'clarification' | 'user'
  content: string
  planUpdate?: Partial<DevelopmentPlan>
  timestamp: string
}
