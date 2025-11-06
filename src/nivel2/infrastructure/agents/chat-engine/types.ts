export type ChatPhase = 'intent' | 'context' | 'questions' | 'options' | 'spec' | 'done'

export interface AnalystState {
  userInput: string
  currentPhase: ChatPhase
  // Scope clarity analysis (new)
  scopeClarity?: {
    score: number
    gaps: Array<{
      category: 'technology' | 'requirements' | 'integration' | 'validation' | 'persistence'
      description: string
      critical: boolean
      suggestion?: string
    }>
    vagueTerms: string[]
    isSpecific: boolean
    detectedTech?: string[]
    hasRequirements: boolean
    hasPersistence: boolean
  }
  // Clarification questions and answers (new)
  clarificationQuestions?: Question[]
  clarificationAnswers?: Answer[]
  // Refined scope after clarification (new)
  refinedScope?: string
  intent?: {
    objective: string
    technicalTerms: string[]
    category: string
    clarityScore: number
    ambiguities: string[]
  }
  context?: {
    code: RetrievalResult[]
    documentation: RetrievalResult[]
    prevention: RetrievalResult[]
    tasks: RetrievalResult[]
    existingPatterns: string[]
    gaps: string[]
  }
  questions: Question[]
  answers: Answer[]
  options: Option[]
  specification?: string
  step: number
}

export interface RetrievalResult {
  content: string
  source: string
  score: number
  type: 'code' | 'documentation' | 'prevention' | 'task'
  lineRange?: [number, number]
}

export interface Question {
  id: string
  question: string
  type: 'technical' | 'business' | 'clarification'
  context: string
  why: string
  options?: string[]
}

export interface Answer {
  questionId: string
  answer: string
  timestamp: string
}

export interface Option {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  complexity: 'low' | 'medium' | 'high'
  timeEstimate: string
  prerequisites: string[]
}

export interface PhaseResult {
  type: 'continue' | 'ask' | 'done'
  data?: unknown
}

export interface GreetingInfo {
  isGreeting: boolean
  response?: string
}