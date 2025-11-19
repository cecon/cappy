import { StateGraph, type CompiledStateGraph } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import type { LanguageModelPort, PlanRepositoryPort, ProgressReporterPort } from '../core/ports'
import {
  PlanningStateAnnotation,
  type PlanningGraphState,
  WorkflowNodes,
  createEmptyConversationDetails,
  type PlanningPhase,
  type ConversationDetails,
  type RefinementQuestion,
  type RefinementTopic
} from './planning-state'

const REFINEMENT_ORDER: RefinementTopic[] = ['escopo', 'requisitos', 'restricoes', 'tecnologias', 'preferencias', 'formato']

type WorkflowNodeName = (typeof WorkflowNodes)[keyof typeof WorkflowNodes]
type PlanningGraphUpdate = Partial<PlanningGraphState>

type PlanningCompiledGraph = CompiledStateGraph<
  PlanningGraphState,
  PlanningGraphUpdate,
  WorkflowNodeName
>

interface PlanningWorkflowDependencies {
  languageModel: LanguageModelPort
  planRepository: PlanRepositoryPort
  progressReporter: ProgressReporterPort
}

interface PlanningWorkflowOptions {
  refinementQuestionLimit?: number
}

export class PlanningWorkflowOrchestrator {
  private readonly checkpointer = new MemorySaver()
  private readonly stableThreads = new Map<string, string>()
  private compiledGraph: PlanningCompiledGraph | null = null
  private readonly deps: PlanningWorkflowDependencies
  private readonly refinementQuestionLimit: number

  constructor(deps: PlanningWorkflowDependencies, options?: PlanningWorkflowOptions) {
    this.deps = deps
    this.refinementQuestionLimit = options?.refinementQuestionLimit ?? REFINEMENT_ORDER.length
  }

  async runSessionTurn(params: { sessionId: string; message: string }): Promise<{
    result: PlanningGraphState
    isContinuation: boolean
  }> {
    const graph = this.ensureGraph()
    
    // Use stable thread ID for consistent LangGraph memory
    const threadId = this.getStableThreadId(params.sessionId)
    
    // Get current state from LangGraph checkpointer
    const config = { configurable: { thread_id: threadId } }
    const currentState = await this.getCurrentState(config)
    
    const isContinuation = Boolean(currentState?.awaitingUser)
    let initialState: PlanningGraphState

    if (currentState?.awaitingUser) {
      // Continue existing conversation
      initialState = this.createContinuationState(currentState, params.message)
    } else if (this.isNewTaskRequest(params.message) || !currentState) {
      // Start new conversation or reset if needed
      initialState = this.createInitialState(params.message)
    } else {
      // Continue non-awaiting state
      initialState = {
        ...currentState,
        userInput: this.sanitize(params.message),
        nextStep: 'router'
      }
    }

    const result = (await graph.invoke(initialState, config)) as PlanningGraphState

    return {
      result,
      isContinuation
    }
  }

  reset(sessionId: string): void {
    // Simply clear the stable thread mapping
    // LangGraph will handle memory cleanup automatically
    this.stableThreads.delete(sessionId)
  }

  private getStableThreadId(sessionId: string): string {
    if (!this.stableThreads.has(sessionId)) {
      this.stableThreads.set(sessionId, `chat-${sessionId}-stable`)
    }
    return this.stableThreads.get(sessionId)!
  }

  private async getCurrentState(config: any): Promise<PlanningGraphState | null> {
    try {
      const checkpoint = await this.checkpointer.get(config)
      return (checkpoint?.channel_values as PlanningGraphState) || null
    } catch (error) {
      console.warn('Failed to get current state:', error)
      return null
    }
  }

  private ensureGraph(): PlanningCompiledGraph {
    if (!this.compiledGraph) {
      const graph = new StateGraph(PlanningStateAnnotation)
        .addNode(WorkflowNodes.router, this.routerNode.bind(this))
        .addNode(WorkflowNodes.intention, this.intentionNode.bind(this))
        .addNode(WorkflowNodes.refinement, this.refinementNode.bind(this))
        .addNode(WorkflowNodes.execution, this.executionNode.bind(this))
        .addEdge(WorkflowNodes.START, WorkflowNodes.router)
        .addConditionalEdges(WorkflowNodes.router, (state) => state.nextStep, {
          intencao: WorkflowNodes.intention,
          refinamento: WorkflowNodes.refinement,
          execucao: WorkflowNodes.execution,
          end: WorkflowNodes.END
        })
        .addEdge(WorkflowNodes.intention, WorkflowNodes.router)
        .addEdge(WorkflowNodes.refinement, WorkflowNodes.router)
        .addEdge(WorkflowNodes.execution, WorkflowNodes.router)

      this.compiledGraph = graph.compile({ checkpointer: this.checkpointer }) as PlanningCompiledGraph
    }

    return this.compiledGraph
  }

  private createInitialState(userMessage: string): PlanningGraphState {
    const sanitized = this.sanitize(userMessage)
    return {
      phase: 'intencao',
      intentionSummary: null,
      rawIntention: sanitized,
      details: createEmptyConversationDetails(),
      confirmed: false,
      readyForExecution: false,
      awaitingUser: false,
      userInput: sanitized,
      userAnswer: null,
      responseMessage: null,
      nextStep: 'router',
      activeQuestion: null,
      askedTopics: [],
      conversationLog: sanitized ? [`Usuario: ${sanitized}`] : [],
      executionPlan: null,
      finalResponse: null
    }
  }

  private createContinuationState(previousState: PlanningGraphState, userMessage: string): PlanningGraphState {
    const sanitized = this.sanitize(userMessage)

    if (this.isNewTaskRequest(sanitized)) {
      return this.createInitialState(sanitized)
    }

    return {
      ...previousState,
      userAnswer: sanitized,
      awaitingUser: false,
      responseMessage: null,
      nextStep: 'router',
      conversationLog: sanitized
        ? previousState.conversationLog.concat(`Usuario: ${sanitized}`)
        : previousState.conversationLog
    }
  }



  private async routerNode(state: PlanningGraphState): Promise<PlanningGraphState> {
    if (state.awaitingUser && !state.userAnswer) {
      return {
        ...state,
        nextStep: 'end'
      }
    }

    if (state.userAnswer && this.isNewTaskRequest(state.userAnswer)) {
      const resetState = this.createInitialState(state.userAnswer)
      return {
        ...resetState,
        conversationLog: resetState.conversationLog.concat('Sistema: Claro! Vamos comecar uma nova tarefa.'),
        responseMessage: 'Claro! Vamos comecar uma nova tarefa. Qual e sua solicitacao?',
        awaitingUser: true,
        nextStep: 'end'
      }
    }

    if (!state.intentionSummary) {
      if (this.isSmallTalk(state.userInput)) {
        const response = this.buildSmallTalkResponse(state.userInput)
        return {
          ...state,
          responseMessage: response,
          conversationLog: state.conversationLog.concat(`Sistema: ${response}`),
          awaitingUser: false,
          nextStep: 'end'
        }
      }

      return {
        ...state,
        phase: 'intencao',
        nextStep: 'intencao'
      }
    }

    if (state.phase === 'intencao' && state.userAnswer && !state.confirmed) {
      return {
        ...state,
        nextStep: 'intencao'
      }
    }

    if (state.phase === 'refinamento') {
      if (!state.readyForExecution) {
        return {
          ...state,
          nextStep: 'refinamento'
        }
      }
    }

    if (state.phase === 'execucao' || (state.readyForExecution && state.confirmed)) {
      return {
        ...state,
        nextStep: 'execucao'
      }
    }

    return {
      ...state,
      nextStep: 'end'
    }
  }

  private async intentionNode(state: PlanningGraphState): Promise<PlanningGraphState> {
    this.deps.progressReporter.emit('Fase 1 - Intencao')

    if (!state.intentionSummary) {
      const summary = await this.summarizeIntention(state.userInput)
      const response = [summary, 'Voce quer trabalhar nisso agora?'].join('\n\n')

      return {
        ...state,
        intentionSummary: summary,
        rawIntention: state.userInput,
        awaitingUser: true,
        responseMessage: response,
        conversationLog: state.conversationLog.concat(`Sistema: ${summary}`, 'Sistema: Voce quer trabalhar nisso agora?'),
        nextStep: 'end'
      }
    }

    const userAnswer = state.userAnswer ?? ''

    if (userAnswer && this.isAffirmative(userAnswer)) {
      const response = 'Perfeito! Vamos refinar os detalhes antes de comecar.'
      return {
        ...state,
        phase: 'refinamento',
        confirmed: true,
        awaitingUser: false,
        responseMessage: response,
        conversationLog: state.conversationLog.concat(`Sistema: ${response}`),
        userAnswer: null,
        nextStep: 'refinamento'
      }
    }

    if (userAnswer && this.isNegative(userAnswer)) {
      const response = 'Sem problemas! Quando quiser retomar e so me chamar.'
      return this.resetForNewConversation(state, response)
    }

    if (userAnswer) {
      const clarification = 'Nao entendi se voce quer seguir com essa tarefa. Pode responder com "sim" ou "nao"?'
      return {
        ...state,
        awaitingUser: true,
        responseMessage: clarification,
        conversationLog: state.conversationLog.concat(`Sistema: ${clarification}`),
        userAnswer: null,
        nextStep: 'end'
      }
    }

    return state
  }

  private async refinementNode(state: PlanningGraphState): Promise<PlanningGraphState> {
    this.deps.progressReporter.emit('Fase 2 - Refinamento')

    let workingState = state

    if (state.userAnswer) {
      workingState = this.captureRefinementAnswer(state)
    }

    if (workingState.phase === 'execucao' && workingState.readyForExecution) {
      const response = 'Otimo! Vou executar o plano com base nessas informacoes.'
      return {
        ...workingState,
        responseMessage: response,
        conversationLog: workingState.conversationLog.concat(`Sistema: ${response}`),
        awaitingUser: false,
        nextStep: 'execucao'
      }
    }

    const nextQuestion = this.selectNextQuestion(workingState)

    if (!nextQuestion) {
      const confirmationQuestion = this.createConfirmationQuestion()
      return {
        ...workingState,
        activeQuestion: confirmationQuestion,
        awaitingUser: true,
        responseMessage: confirmationQuestion.prompt,
        conversationLog: workingState.conversationLog.concat(`Sistema: ${confirmationQuestion.prompt}`),
        nextStep: 'end'
      }
    }

    return {
      ...workingState,
      activeQuestion: nextQuestion,
      askedTopics: [...new Set([...workingState.askedTopics, nextQuestion.topic])],
      awaitingUser: true,
      responseMessage: nextQuestion.prompt,
      conversationLog: workingState.conversationLog.concat(`Sistema: ${nextQuestion.prompt}`),
      nextStep: 'end'
    }
  }

  private async executionNode(state: PlanningGraphState): Promise<PlanningGraphState> {
    this.deps.progressReporter.emit('Fase 3 - Execucao')

    if (!state.intentionSummary && !state.rawIntention) {
      const response = 'Nao encontrei uma intencao ativa. Vamos comecar do zero: sobre o que voce quer trabalhar?'
      return this.resetForNewConversation(state, response)
    }

    const deliverable = await this.generateExecutionDeliverable(state)

    const updatedLog = state.conversationLog.concat(`Sistema: ${deliverable}`)

    // Complete execution but keep conversation context alive
    return {
      ...state,
      phase: 'execucao',
      readyForExecution: true,
      confirmed: true,
      awaitingUser: false,
      responseMessage: deliverable,
      finalResponse: deliverable,
      executionPlan: deliverable,
      conversationLog: updatedLog,
      nextStep: 'end'
    }
  }

  private async summarizeIntention(userInput: string): Promise<string> {
    const prompt = this.buildIntentionPrompt(userInput)
    const summary = await this.deps.languageModel.complete(prompt, {
      justification: 'Resumindo intencao do usuario'
    })

    return summary.trim()
  }

  private buildIntentionPrompt(userInput: string): string {
    return [
      'Voce e um assistente que identifica intencoes do usuario.',
      'Resuma a solicitacao em ate 3 frases claras.',
      'Nao proponha solucoes nem escreva codigo nesta etapa.',
      'Foquese em "o que" o usuario quer fazer e em qual contexto.',
      'Mensagem do usuario:',
      '"""',
      userInput,
      '"""'
    ].join('\n')
  }

  private captureRefinementAnswer(state: PlanningGraphState): PlanningGraphState {
    const answer = this.sanitize(state.userAnswer ?? '')
    const activeQuestion = state.activeQuestion
    const updatedDetails: ConversationDetails = {
      ...state.details
    }

    let phase: PlanningPhase = state.phase
    let readyForExecution = state.readyForExecution
    let responseMessage: string | null = null
    let nextQuestionOverride: RefinementQuestion | null = null
    let askedTopics = state.askedTopics

    if (activeQuestion) {
      askedTopics = [...new Set([...askedTopics, activeQuestion.topic])]

      switch (activeQuestion.topic) {
        case 'escopo':
          updatedDetails.escopo = this.extractList(answer)
          break
        case 'requisitos':
          updatedDetails.requisitos = this.extractList(answer)
          break
        case 'restricoes':
          updatedDetails.restricoes = this.extractList(answer)
          break
        case 'tecnologias':
          updatedDetails.tecnologias = this.extractList(answer)
          break
        case 'preferencias':
          updatedDetails.preferencias = this.extractList(answer)
          break
        case 'formato':
          updatedDetails.formato = answer || updatedDetails.formato
          break
        case 'ajustes':
          updatedDetails.preferencias = updatedDetails.preferencias.concat(answer)
          break
        case 'confirmacao':
          if (this.isAffirmative(answer)) {
            phase = 'execucao'
            readyForExecution = true
            responseMessage = 'Perfeito! Vou preparar o plano de execucao.'
          } else if (this.isNegative(answer)) {
            const followUp = 'Entendido. Qual detalhe ainda precisamos ajustar?'
            nextQuestionOverride = {
              id: this.createQuestionId('ajustes'),
              topic: 'ajustes',
              prompt: followUp
            }
            responseMessage = followUp
          } else {
            const clarification = 'Preciso de um "sim" ou "nao" para saber se posso executar. Podemos seguir?'
            nextQuestionOverride = {
              id: this.createQuestionId('confirmacao'),
              topic: 'confirmacao',
              prompt: clarification
            }
            responseMessage = clarification
          }
          break
        default:
          break
      }
    } else if (this.isAffirmative(answer) && state.askedTopics.length >= 3) {
      phase = 'execucao'
      readyForExecution = true
      responseMessage = 'Otimo! Vou executar com base no que coletamos.'
    }

    const conversationLog = answer
      ? state.conversationLog.concat(`Usuario: ${answer}`)
      : state.conversationLog

    return {
      ...state,
      phase,
      details: updatedDetails,
      readyForExecution,
      responseMessage: responseMessage ?? state.responseMessage,
      activeQuestion: nextQuestionOverride,
      askedTopics,
      conversationLog,
      userAnswer: null
    }
  }

  private selectNextQuestion(state: PlanningGraphState): RefinementQuestion | null {
    if (state.activeQuestion && state.activeQuestion.topic !== 'confirmacao') {
      return state.activeQuestion
    }

    if (state.activeQuestion?.topic === 'confirmacao' && !state.readyForExecution) {
      return state.activeQuestion
    }

    const answeredCount = state.askedTopics.filter((topic) => REFINEMENT_ORDER.includes(topic)).length
    if (answeredCount >= this.refinementQuestionLimit) {
      return null
    }

    if (state.readyForExecution || state.phase === 'execucao') {
      return null
    }

    const remainingTopics = REFINEMENT_ORDER.filter((topic) => !state.askedTopics.includes(topic))
    const topic = remainingTopics.find((candidate) => this.shouldAskTopic(candidate, state.details))

    if (!topic) {
      return null
    }

    return {
      id: this.createQuestionId(topic),
      topic,
      prompt: this.createTopicPrompt(topic)
    }
  }

  private shouldAskTopic(topic: RefinementTopic, details: ConversationDetails): boolean {
    switch (topic) {
      case 'escopo':
        return details.escopo.length === 0
      case 'requisitos':
        return details.requisitos.length === 0
      case 'restricoes':
        return details.restricoes.length === 0
      case 'tecnologias':
        return details.tecnologias.length === 0
      case 'preferencias':
        return details.preferencias.length === 0
      case 'formato':
        return !details.formato
      default:
        return false
    }
  }

  private createTopicPrompt(topic: RefinementTopic): string {
    switch (topic) {
      case 'escopo':
        return 'Vamos definir o escopo: quais partes da tarefa sao essenciais ou estao fora de alcance?'
      case 'requisitos':
        return 'Quais requisitos ou funcionalidades sao obrigatorios? Liste cada um separadamente.'
      case 'restricoes':
        return 'Ha restricoes de prazo, compliance, time ou qualquer outro bloqueio?'
      case 'tecnologias':
        return 'Existe alguma tecnologia, linguagem ou ferramenta que devemos usar (ou evitar)?'
      case 'preferencias':
        return 'Tem preferencias de estilo, padroes, referencias ou formatos que devo seguir?'
      case 'formato':
        return 'Como voce quer receber o resultado? Ex.: codigo, roteiro de passos, documentacao, checklist.'
      case 'ajustes':
        return 'Qual detalhe ainda falta definir ou ajustar?'
      case 'confirmacao':
        return 'Esta tudo certo para eu executar a tarefa?'
      default:
        return 'Pode fornecer mais contexto, por favor?'
    }
  }

  private createConfirmationQuestion(): RefinementQuestion {
    return {
      id: this.createQuestionId('confirmacao'),
      topic: 'confirmacao',
      prompt: 'Revisando: esta tudo alinhado? Posso iniciar a execucao agora?'
    }
  }

  private async generateExecutionDeliverable(state: PlanningGraphState): Promise<string> {
    const prompt = this.buildExecutionPrompt(state)
    const result = await this.deps.languageModel.complete(prompt, {
      justification: 'Gerando plano de execucao e entregavel'
    })

    return result.trim()
  }

  private buildExecutionPrompt(state: PlanningGraphState): string {
    const details = this.formatDetailsForPrompt(state.details)
    const intention = state.intentionSummary ?? state.rawIntention ?? 'Tarefa nao especificada'

    return [
      'Voce e um agente executor que ja coletou todos os detalhes necessarios.',
      'Crie um plano de execucao detalhado (lista numerada) e, em seguida, entregue o resultado final solicitado.',
      'Se o usuario pedir codigo, forneca-o. Caso contrario, apresente o entregavel apropriado.',
      'Responda em portugues e seja direto.',
      '',
      `Intencao: ${intention}`,
      'Detalhes conhecidos:',
      details,
      '',
      'Formate a resposta em duas secoes:',
      '1. Plano de Execucao',
      '2. Entregavel Final'
    ].join('\n')
  }

  private formatDetailsForPrompt(details: ConversationDetails): string {
    const parts: string[] = []

    if (details.escopo.length > 0) {
      parts.push(`- Escopo: ${details.escopo.join('; ')}`)
    }

    if (details.requisitos.length > 0) {
      parts.push(`- Requisitos: ${details.requisitos.join('; ')}`)
    }

    if (details.restricoes.length > 0) {
      parts.push(`- Restricoes: ${details.restricoes.join('; ')}`)
    }

    if (details.tecnologias.length > 0) {
      parts.push(`- Tecnologias: ${details.tecnologias.join('; ')}`)
    }

    if (details.preferencias.length > 0) {
      parts.push(`- Preferencias: ${details.preferencias.join('; ')}`)
    }

    if (details.formato) {
      parts.push(`- Formato desejado: ${details.formato}`)
    }

    if (parts.length === 0) {
      return '- Nenhum detalhe adicional fornecido.'
    }

    return parts.join('\n')
  }

  private resetForNewConversation(state: PlanningGraphState, response: string): PlanningGraphState {
    const newLog = response
      ? state.conversationLog.concat(`Sistema: ${response}`)
      : state.conversationLog

    return {
      phase: 'intencao',
      intentionSummary: null,
      rawIntention: null,
      details: createEmptyConversationDetails(),
      confirmed: false,
      readyForExecution: false,
      awaitingUser: false,
      userInput: '',
      userAnswer: null,
      responseMessage: response,
      nextStep: 'end',
      activeQuestion: null,
      askedTopics: [],
      conversationLog: newLog,
      executionPlan: null,
      finalResponse: null
    }
  }

  private extractList(answer: string): string[] {
    if (!answer) {
      return []
    }

    const tokens = answer
      .split(/[\n,]/)
      .map((token) => this.sanitize(token))
      .filter((token) => token.length > 0)

    return tokens.length > 0 ? tokens : [answer]
  }

  private sanitize(value: string): string {
    return value.trim()
  }

  private isSmallTalk(message: string): boolean {
    const normalized = message.toLowerCase()
    const greetings = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'hey']
    return greetings.some((greeting) => normalized.startsWith(greeting))
  }

  private buildSmallTalkResponse(message: string): string {
    const normalized = message.toLowerCase()
    if (normalized.includes('bom dia')) {
      return 'Bom dia! Como posso ajudar hoje?'
    }
    if (normalized.includes('boa tarde')) {
      return 'Boa tarde! Em que posso colaborar?'
    }
    if (normalized.includes('boa noite')) {
      return 'Boa noite! Vamos trabalhar em alguma tarefa?'
    }
    return 'Ola! Pronto para ajudar. Qual tarefa voce quer abordar?'
  }

  private isAffirmative(message: string): boolean {
    const normalized = message.toLowerCase()
    return ['sim', 'claro', 'com certeza', 'pode', 'vamos', 'perfeito', 'confirmo', 'pode comecar', 'pode sim'].some((term) =>
      normalized.includes(term)
    )
  }

  private isNegative(message: string): boolean {
    const normalized = message.toLowerCase()
    return ['nao', 'negativo', 'talvez depois', 'agora nao', 'mais tarde', 'prefiro nao'].some((term) => normalized.includes(term))
  }

  private isNewTaskRequest(message: string): boolean {
    const normalized = message.toLowerCase()
    return ['nova tarefa', 'novo assunto', 'outro assunto', 'outra coisa', 'mudar de assunto'].some((term) =>
      normalized.includes(term)
    )
  }

  private createQuestionId(topic: RefinementTopic): string {
    return `${topic}-${Date.now()}`
  }
}

