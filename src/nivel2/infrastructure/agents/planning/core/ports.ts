import type { DevelopmentPlan } from '../types'

export interface LanguageModelPort {
  complete(prompt: string, options: { justification: string }): Promise<string>
}

export interface PlanRepositoryPort {
  save(plan: DevelopmentPlan): Promise<DevelopmentPlan>
  update(planId: string, updates: Partial<DevelopmentPlan>): Promise<DevelopmentPlan | null>
}

export interface ProgressReporterPort {
  emit(message: string): void
}
