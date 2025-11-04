export type ChatPhase = 'intent' | 'context' | 'questions' | 'options' | 'spec' | 'done'

export interface AnalystState {
  userInput: string
  currentPhase: ChatPhase
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
  data?: any
}

export interface GreetingInfo {
  isGreeting: boolean
  response?: string
}