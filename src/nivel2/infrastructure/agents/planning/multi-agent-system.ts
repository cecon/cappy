import * as vscode from 'vscode'
import { PlanningWorkflowOrchestrator } from './application/planning-workflow-orchestrator'
import type { PlanningGraphState } from './application/planning-state'
import { PlanPersistence } from './plan-persistence'

export class MultiAgentPlanningSystem {
  private model: vscode.LanguageModelChat | null = null
  private initialized = false
  private progressCallback?: (message: string) => void
  private readonly workflow: PlanningWorkflowOrchestrator

  constructor() {
    this.workflow = new PlanningWorkflowOrchestrator({
      languageModel: {
        complete: (prompt, options) => this.completeWithModel(prompt, options.justification)
      },
      planRepository: {
        save: async (plan) => {
          await PlanPersistence.savePlan(plan)
          return plan
        },
        update: async (planId, updates) => PlanPersistence.updatePlan(planId, updates)
      },
      progressReporter: {
        emit: (message) => this.logProgress(message)
      }
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' })
    if (!models.length) {
      throw new Error('No suitable language model found')
    }

    this.model = models[0]
    this.initialized = true
  }

  setProgressCallback(callback: (message: string) => void): void {
    this.progressCallback = callback
  }

  async runSessionTurn(params: { sessionId: string; message: string }): Promise<{
    result: PlanningGraphState
    isContinuation: boolean
  }> {
    await this.ensureModel()
    return this.workflow.runSessionTurn(params)
  }

  resetSession(sessionId: string): void {
    this.workflow.reset(sessionId)
  }

  async runTurn(params: { prompt: string; sessionId: string }): Promise<string> {
    const { result } = await this.runSessionTurn({ sessionId: params.sessionId, message: params.prompt })

    if (result.finalResponse) {
      return result.finalResponse
    }

    if (result.responseMessage) {
      return result.responseMessage
    }

    if (result.awaitingUser) {
      return 'Estou aguardando a sua resposta para continuar.'
    }

    return 'Fluxo concluido. Se precisar iniciar outra tarefa, e so me chamar.'
  }

  private logProgress(message: string): void {
    console.log(message)
    this.progressCallback?.(message)
  }

  private async completeWithModel(prompt: string, justification: string): Promise<string> {
    const model = await this.ensureModel()
    const messages = [vscode.LanguageModelChatMessage.User(prompt)]
    const response = await model.sendRequest(messages, { justification })

    let combined = ''
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        combined += part.value
      }
    }

    return combined
  }

  private async ensureModel(): Promise<vscode.LanguageModelChat> {
    if (!this.model) {
      await this.initialize()
    }

    if (!this.model) {
      throw new Error('Language model could not be initialized')
    }

    return this.model
  }
}
