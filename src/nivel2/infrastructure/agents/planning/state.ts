/**
 * @fileoverview State definition for Planning Agent
 */

import { Annotation } from '@langchain/langgraph';

/**
 * Represents a step in the task plan
 */
export interface TaskStep {
  id: string;
  title: string;
  description: string;
  files?: string[];
  validation?: string;
}

/**
 * Represents the task being planned
 */
export interface TaskPlan {
  title: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'chore';
  description: string;
  context: string;
  acceptanceCriteria: string[];
  steps: TaskStep[];
  relatedFiles: string[];
  preventionRules?: string[];
}

/**
 * Planning phase enum
 */
export type PlanningPhase = 
  | 'collecting_scope'      // Entendendo o que o usuário quer
  | 'analyzing_codebase'    // Analisando código relevante
  | 'drafting_plan'         // Criando rascunho do plano
  | 'confirming_plan'       // Confirmando com usuário
  | 'creating_task'         // Criando arquivo XML
  | 'completed';            // Finalizado

/**
 * Questions to ask user for scope collection
 */
export interface ScopeQuestion {
  id: string;
  question: string;
  answered: boolean;
  answer?: string;
}

export const PlanningGraphState = Annotation.Root({
  // Conversation
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  // Current phase
  phase: Annotation<PlanningPhase>({
    reducer: (_current, update) => update,
    default: () => 'collecting_scope' as PlanningPhase
  }),

  // Workspace context
  workspaceContext: Annotation<{
    rootPath: string;
    projectName: string;
    projectType?: string;
    mainLanguage?: string;
    frameworks?: string[];
    openFiles: string[];
    activeFile?: string;
  } | undefined>(),

  // Scope collection
  scopeQuestions: Annotation<ScopeQuestion[]>({
    reducer: (_current, update) => update,
    default: () => []
  }),

  // Gathered information from codebase
  codebaseInfo: Annotation<{
    relevantFiles: string[];
    codeSnippets: Record<string, string>;
    dependencies?: string[];
    existingPatterns?: string[];
  }>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({ relevantFiles: [], codeSnippets: {} })
  }),

  // The task plan being built
  taskPlan: Annotation<Partial<TaskPlan>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({})
  }),

  // Final response to user
  response: Annotation<string | undefined>(),

  // Progress callback
  progressCallback: Annotation<((msg: string) => void) | undefined>(),

  // Whether task file was created
  taskCreated: Annotation<boolean>({
    reducer: (_current, update) => update,
    default: () => false
  })
});

export type PlanningState = typeof PlanningGraphState.State;
