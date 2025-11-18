import { Annotation, END, START } from '@langchain/langgraph'

export type PlanningPhase = 'intencao' | 'refinamento' | 'execucao'

export type RefinementTopic =
  | 'escopo'
  | 'requisitos'
  | 'restricoes'
  | 'tecnologias'
  | 'preferencias'
  | 'formato'
  | 'confirmacao'
  | 'ajustes'

export interface ConversationDetails {
  escopo: string[]
  requisitos: string[]
  restricoes: string[]
  tecnologias: string[]
  preferencias: string[]
  formato: string | null
}

export interface RefinementQuestion {
  id: string
  topic: RefinementTopic
  prompt: string
}

export const createEmptyConversationDetails = (): ConversationDetails => ({
  escopo: [],
  requisitos: [],
  restricoes: [],
  tecnologias: [],
  preferencias: [],
  formato: null
})

const mergeDetails = (left: ConversationDetails, right?: Partial<ConversationDetails> | null): ConversationDetails => {
  if (!right) {
    return left
  }

  return {
    escopo: right.escopo ?? left.escopo,
    requisitos: right.requisitos ?? left.requisitos,
    restricoes: right.restricoes ?? left.restricoes,
    tecnologias: right.tecnologias ?? left.tecnologias,
    preferencias: right.preferencias ?? left.preferencias,
    formato: right.formato ?? left.formato
  }
}

export const PlanningStateAnnotation = Annotation.Root({
  phase: Annotation<PlanningPhase>({
    reducer: (_, right) => right ?? 'intencao',
    default: () => 'intencao'
  }),
  intentionSummary: Annotation<string | null>({
    reducer: (_, right) => right ?? null,
    default: () => null
  }),
  rawIntention: Annotation<string | null>({
    reducer: (_, right) => right ?? null,
    default: () => null
  }),
  details: Annotation<ConversationDetails>({
    reducer: (left, right) => mergeDetails(left, right),
    default: () => createEmptyConversationDetails()
  }),
  confirmed: Annotation<boolean>({
    reducer: (_, right) => right ?? false,
    default: () => false
  }),
  readyForExecution: Annotation<boolean>({
    reducer: (_, right) => right ?? false,
    default: () => false
  }),
  awaitingUser: Annotation<boolean>({
    reducer: (_, right) => right ?? false,
    default: () => false
  }),
  userInput: Annotation<string>({
    reducer: (_, right) => right ?? '',
    default: () => ''
  }),
  userAnswer: Annotation<string | null>({
    reducer: (_, right) => right ?? null,
    default: () => null
  }),
  responseMessage: Annotation<string | null>({
    reducer: (_, right) => right ?? null,
    default: () => null
  }),
  nextStep: Annotation<'router' | 'intencao' | 'refinamento' | 'execucao' | 'end'>({
    reducer: (_, right) => right ?? 'router',
    default: () => 'router'
  }),
  activeQuestion: Annotation<RefinementQuestion | null>({
    reducer: (_, right) => right ?? null,
    default: () => null
  }),
  askedTopics: Annotation<RefinementTopic[]>({
    reducer: (left, right) => {
      if (!right || right.length === 0) {
        return left
      }

      const combined = new Set([...left, ...right])
      return Array.from(combined)
    },
    default: () => []
  }),
  conversationLog: Annotation<string[]>({
    reducer: (left, right) => {
      if (!right || right.length === 0) {
        return left
      }

      return left.concat(right)
    },
    default: () => []
  }),
  executionPlan: Annotation<string | null>({
    reducer: (_, right) => right ?? null,
    default: () => null
  }),
  finalResponse: Annotation<string | null>({
    reducer: (_, right) => right ?? null,
    default: () => null
  })
})

export type PlanningGraphState = typeof PlanningStateAnnotation.State

export const WorkflowNodes = {
  START,
  END,
  router: 'router',
  intention: 'intention',
  refinement: 'refinement',
  execution: 'execution'
} as const
