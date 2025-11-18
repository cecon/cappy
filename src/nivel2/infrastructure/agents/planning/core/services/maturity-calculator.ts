import type { DevelopmentPlan } from '../../types'
import { PlanNormalizer } from './plan-normalizer'

export class MaturityCalculator {
  calculate(plan: DevelopmentPlan): number {
    const normalized = PlanNormalizer.normalize({ ...plan })

    let score = 0

    if (normalized.context.problem) score += 5
    if (normalized.context.objective) score += 5
    if (normalized.context.filesAnalyzed.length > 0) score += 5
    if (normalized.context.externalDependencies.length > 0) score += 5

    if (normalized.functionalRequirements.length >= 3) score += 10
    if (normalized.nonFunctionalRequirements.length >= 2) score += 10
    if (normalized.functionalRequirements.some((r) => r.acceptanceCriteria.length > 0)) score += 5

    if (normalized.components.length >= 2) score += 10
    if (normalized.proposedArchitecture) score += 5
    if (normalized.userFlows.length > 0) score += 5

    if (normalized.decisions.length >= 2) score += 10
    if (normalized.decisions.some((d) => d.status === 'approved')) score += 5

    if (normalized.risks.length >= 2) score += 5
    if (normalized.risks.some((r) => r.mitigation)) score += 5

    if (normalized.atomicTasks.length >= 3) score += 5
    if (normalized.successCriteria.length >= 2) score += 5

    return Math.min(score, 100)
  }
}
