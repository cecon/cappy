import * as vscode from 'vscode'
import { PlanningWorkflowOrchestrator } from './application/planning-workflow-orchestrator'
import type { PlanningGraphState } from './application/planning-state'
import { PlanPersistence } from './plan-persistence'

interface ConversationTurn {
  userMessage: string
  assistantResponse: string
  timestamp: Date
  state?: PlanningGraphState
}

interface Session {
  id: string
  history: ConversationTurn[]
  createdAt: Date
  lastAccessAt: Date
}

export class MultiAgentPlanningSystem {
  private model: vscode.LanguageModelChat | null = null
  private initialized = false
  private progressCallback?: (message: string) => void
  private readonly workflow: PlanningWorkflowOrchestrator
  private readonly sessions = new Map<string, Session>()

  constructor() {
    this.workflow = new PlanningWorkflowOrchestrator({
      languageModel: {
        complete: (prompt, options) => this.completeWithModel(prompt, options.justification, options.sessionId)
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

  private getOrCreateSession(sessionId: string): Session {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        history: [],
        createdAt: new Date(),
        lastAccessAt: new Date()
      })
    }

    const session = this.sessions.get(sessionId)!
    session.lastAccessAt = new Date()
    return session
  }

  async runSessionTurn(params: { sessionId: string; message: string }): Promise<{
    result: PlanningGraphState
    isContinuation: boolean
  }> {
    await this.ensureModel()
    
    const session = this.getOrCreateSession(params.sessionId)
    const { result, isContinuation } = await this.workflow.runSessionTurn(params)

    // Armazenar turno no histórico
    session.history.push({
      userMessage: params.message,
      assistantResponse: result.finalResponse || result.responseMessage || '',
      timestamp: new Date(),
      state: result
    })

    // Limitar histórico a 50 turnos
    if (session.history.length > 50) {
      session.history.shift()
    }

    return { result, isContinuation }
  }

  resetSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.workflow.reset(sessionId)
  }

  getSessionHistory(sessionId: string): ConversationTurn[] {
    return this.getOrCreateSession(sessionId).history
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

  private buildContextualPrompt(sessionId: string, currentPrompt: string): string {
    const session = this.sessions.get(sessionId)
    if (!session || session.history.length === 0) {
      return currentPrompt
    }

    // Últimos 5 turnos para contexto
    const recentHistory = session.history.slice(-5)
    const context = recentHistory
      .map(turn => `User: ${turn.userMessage}\nAssistant: ${turn.assistantResponse}`)
      .join('\n\n')

    return `Previous conversation:\n${context}\n\nCurrent message:\n${currentPrompt}`
  }

  private async completeWithModel(prompt: string, justification: string, sessionId?: string): Promise<string> {
    const model = await this.ensureModel()
    
    // Adicionar contexto da sessão ao prompt
    const contextualPrompt = sessionId 
      ? this.buildContextualPrompt(sessionId, prompt)
      : prompt

    const messages = [vscode.LanguageModelChatMessage.User(contextualPrompt)]
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
