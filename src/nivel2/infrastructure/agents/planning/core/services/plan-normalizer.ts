import type { DevelopmentPlan } from '../../types'

export class PlanNormalizer {
  static normalize(plan: DevelopmentPlan): DevelopmentPlan {
    plan.context.filesAnalyzed = this.ensureArray(plan.context.filesAnalyzed)
    plan.context.patternsFound = this.ensureArray(plan.context.patternsFound)
    plan.context.externalDependencies = this.ensureArray(plan.context.externalDependencies)

    plan.functionalRequirements = this.ensureArray(plan.functionalRequirements).map((requirement) => ({
      ...requirement,
      acceptanceCriteria: this.ensureArray(requirement.acceptanceCriteria),
      relatedComponents: this.ensureArray(requirement.relatedComponents)
    }))

    plan.nonFunctionalRequirements = this.ensureArray(plan.nonFunctionalRequirements)

    plan.components = this.ensureArray(plan.components).map((component) => ({
      ...component,
      responsibilities: this.ensureArray(component.responsibilities),
      dependencies: this.ensureArray(component.dependencies)
    }))

    plan.userFlows = this.ensureArray(plan.userFlows).map((flow) => ({
      ...flow,
      steps: this.ensureArray(flow.steps),
      alternativePaths: this.ensureArray(flow.alternativePaths),
      requiredComponents: this.ensureArray(flow.requiredComponents)
    }))

    plan.decisions = this.ensureArray(plan.decisions).map((decision) => ({
      ...decision,
      alternatives: this.ensureArray(decision.alternatives)
    }))

    plan.questions = this.ensureArray(plan.questions).map((question) => ({
      ...question,
      relatedTo: this.ensureArray(question.relatedTo)
    }))

    plan.assumptions = this.ensureArray(plan.assumptions)
    plan.glossary = this.ensureArray(plan.glossary).map((entry) => ({
      ...entry,
      synonyms: this.ensureArray(entry.synonyms),
      relatedTerms: this.ensureArray(entry.relatedTerms)
    }))

    plan.risks = this.ensureArray(plan.risks)

    plan.atomicTasks = this.ensureArray(plan.atomicTasks).map((task) => ({
      ...task,
      dependencies: this.ensureArray(task.dependencies)
    }))

    plan.successCriteria = this.ensureArray(plan.successCriteria)

    return plan
  }

  private static ensureArray<T>(value: T[] | null | undefined): T[] {
    return Array.isArray(value) ? value : []
  }
}
