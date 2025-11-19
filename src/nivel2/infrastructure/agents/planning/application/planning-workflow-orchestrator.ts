import { StateGraph, type CompiledStateGraph } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import type { LanguageModelPort, PlanRepositoryPort, ProgressReporterPort } from '../core/ports'
import {
  PlanningStateAnnotation,
  type PlanningGraphState,
  WorkflowNodes,
  createEmptyConversationDetails,
  type PlanningPhase,
  type RouterIntent,
  type ConversationDetails,
  type RefinementQuestion,
  type RefinementTopic
} from './planning-state'

const REFINEMENT_ORDER: RefinementTopic[] = ['escopo', 'requisitos', 'restricoes', 'tecnologias', 'preferencias', 'formato']
const CANCEL_KEYWORDS = [
  'desisti',
  'parei',
  'cancela',
  'cancele',
  'mudei de ideia',
  'mudei de idéia',
  'nao quero mais',
  'não quero mais',
  'esquece',
  'deixa pra la',
  'deixa pra lá',
  'abandona',
  'vamos abandonar',
  'nao vale mais a pena',
  'não vale mais a pena'
]

const ROUTER_CLASSIFICATION_PROMPT = (userMessage: string): string =>
  [
    'Classifique a mensagem do usuario em uma das categorias a seguir:',
    '- smalltalk',
    '- cancelamento',
    '- intencao',
    '- refinamento',
    '- confirmacao',
    '- execucao',
    '',
    'Responda APENAS com o nome da categoria.',
    'Mensagem do usuario:',
    '"""',
    userMessage,
    '"""'
  ].join('\n')

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

    const sanitizedInput = this.sanitize(params.message)
    
    console.log('[PlanningOrchestrator] Session:', {
      sessionId: params.sessionId,
      threadId,
      hasCurrentState: !!currentState,
      currentPhase: currentState?.phase,
      awaitingUser: currentState?.awaitingUser,
      conversationLogLength: currentState?.conversationLog?.length ?? 0
    });
    
    const isContinuation = Boolean(currentState?.awaitingUser)
    let initialState: PlanningGraphState

        if (!currentState || this.shouldStartFreshConversation(currentState, sanitizedInput)) {
          initialState = this.createInitialState(sanitizedInput)
        } else if (currentState.awaitingUser) {
      // Continue existing conversation
          initialState = this.createContinuationState(currentState, sanitizedInput)
    } else {
      // Continue non-awaiting state
      initialState = {
        ...currentState,
            userInput: sanitizedInput,
            userAnswer: null,
            awaitingUser: false,
            routerIntent: 'desconhecido',
            cancelled: false,
            cancellationReason: null,
            nextStep: 'router',
            conversationLog: sanitizedInput
              ? currentState.conversationLog.concat(`Usuario: ${sanitizedInput}`)
              : currentState.conversationLog
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
      prontoParaExecutar: false,
      routerIntent: 'desconhecido',
      awaitingUser: false,
      userInput: sanitized,
      userAnswer: null,
      responseMessage: null,
      nextStep: 'router',
      activeQuestion: null,
      askedTopics: [],
      conversationLog: sanitized ? [`Usuario: ${sanitized}`] : [],
      executionPlan: null,
      finalResponse: null,
      cancelled: false,
      cancellationReason: null,
      phaseHistory: ['intencao']
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
      routerIntent: 'desconhecido',
      cancelled: false,
      cancellationReason: null,
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

    const latestMessage = state.userAnswer ?? state.userInput

    if (!latestMessage) {
      return {
        ...state,
        nextStep: 'end'
      }
    }

    const shortcutResult = this.handleRouterShortcuts(state, latestMessage)
    if (shortcutResult) {
      return shortcutResult
    }

    const routerIntent = await this.classifyRouterIntent(latestMessage)
    const baseState = {
      ...state,
      routerIntent
    }

    return this.routeByIntent(baseState, routerIntent, latestMessage)
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
      const phased = this.applyPhase(state, 'refinamento')
      return {
        ...phased,
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
        prontoParaExecutar: true,
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

    const phased = this.applyPhase(state, 'execucao')

    // Complete execution but keep conversation context alive
    return {
      ...phased,
      readyForExecution: true,
      prontoParaExecutar: true,
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
    let prontoParaExecutar = state.prontoParaExecutar
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
            prontoParaExecutar = true
            responseMessage = 'Perfeito! Vou preparar o plano de execucao.'
          } else if (this.isNegative(answer)) {
            const followUp = 'Entendido. Qual detalhe ainda precisamos ajustar?'
            nextQuestionOverride = {
              id: this.createQuestionId('ajustes'),
              topic: 'ajustes',
              prompt: followUp
            }
            responseMessage = followUp
            readyForExecution = false
            prontoParaExecutar = false
          } else {
            const clarification = 'Preciso de um "sim" ou "nao" para saber se posso executar. Podemos seguir?'
            nextQuestionOverride = {
              id: this.createQuestionId('confirmacao'),
              topic: 'confirmacao',
              prompt: clarification
            }
            responseMessage = clarification
            readyForExecution = false
            prontoParaExecutar = false
          }
          break
        default:
          break
      }
    } else if (this.isAffirmative(answer) && state.askedTopics.length >= 3) {
      phase = 'execucao'
      readyForExecution = true
      prontoParaExecutar = true
      responseMessage = 'Otimo! Vou executar com base no que coletamos.'
    }

    const conversationLog = answer
      ? state.conversationLog.concat(`Usuario: ${answer}`)
      : state.conversationLog

    const updatedState = {
      ...state,
      phase,
      details: updatedDetails,
      readyForExecution,
      prontoParaExecutar,
      responseMessage: responseMessage ?? state.responseMessage,
      activeQuestion: nextQuestionOverride,
      askedTopics,
      conversationLog,
      userAnswer: null
    }

    if (phase !== state.phase) {
      return {
        ...updatedState,
        phaseHistory: [phase]
      }
    }

    return updatedState
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
      prontoParaExecutar: false,
      routerIntent: 'desconhecido',
      awaitingUser: false,
      userInput: '',
      userAnswer: null,
      responseMessage: response,
      nextStep: 'end',
      activeQuestion: null,
      askedTopics: [],
      conversationLog: newLog,
      executionPlan: null,
      finalResponse: null,
      cancelled: false,
      cancellationReason: null,
      phaseHistory: ['intencao']
    }
  }

  private shouldStartFreshConversation(state: PlanningGraphState | null, message: string): boolean {
    if (!state) {
      return true
    }

    if (this.isNewTaskRequest(message)) {
      return true
    }

    if (state.cancelled) {
      return true
    }

    return false
  }

  private applyPhase(state: PlanningGraphState, phase: PlanningPhase): PlanningGraphState {
    if (state.phase === phase) {
      return state
    }

    return {
      ...state,
      phase,
      phaseHistory: [phase]
    }
  }

  private handleRouterShortcuts(state: PlanningGraphState, latestMessage: string): PlanningGraphState | null {
    if (this.isNewTaskRequest(latestMessage)) {
      const resetState = this.createInitialState(latestMessage)
      return {
        ...resetState,
        conversationLog: resetState.conversationLog.concat('Sistema: Claro! Vamos comecar uma nova tarefa.'),
        responseMessage: 'Claro! Vamos comecar uma nova tarefa. Qual e sua solicitacao?',
        awaitingUser: true,
        nextStep: 'end'
      }
    }

    if (this.detectCancellation(latestMessage)) {
      return this.handleCancellation(state, latestMessage)
    }

    if (!state.intentionSummary && this.isSmallTalk(latestMessage)) {
      const response = this.buildSmallTalkResponse(latestMessage)
      return {
        ...state,
        routerIntent: 'smalltalk',
        responseMessage: response,
        conversationLog: state.conversationLog.concat(`Sistema: ${response}`),
        awaitingUser: false,
        nextStep: 'end'
      }
    }

    return null
  }

  private routeByIntent(state: PlanningGraphState, intent: RouterIntent, latestMessage: string): PlanningGraphState {
    switch (intent) {
      case 'smalltalk': {
        const response = this.buildSmallTalkResponse(latestMessage)
        return {
          ...state,
          responseMessage: response,
          conversationLog: state.conversationLog.concat(`Sistema: ${response}`),
          awaitingUser: false,
          nextStep: 'end'
        }
      }
      case 'cancelamento':
        return this.handleCancellation(state, latestMessage)
      case 'intencao': {
        const phased = this.applyPhase(state, 'intencao')
        return {
          ...phased,
          nextStep: 'intencao'
        }
      }
      case 'refinamento':
      case 'confirmacao': {
        if (!state.intentionSummary) {
          return this.routeFallback(state)
        }
        const phased = this.applyPhase(state, 'refinamento')
        return {
          ...phased,
          nextStep: 'refinamento'
        }
      }
      case 'execucao': {
        if (state.readyForExecution || state.prontoParaExecutar) {
          const phased = this.applyPhase(state, 'execucao')
          return {
            ...phased,
            nextStep: 'execucao'
          }
        }
        return this.routeFallback(state)
      }
      default:
        return this.routeFallback(state)
    }
  }

  private routeFallback(state: PlanningGraphState): PlanningGraphState {
    if (!state.intentionSummary) {
      const phased = this.applyPhase(state, 'intencao')
      return {
        ...phased,
        nextStep: 'intencao'
      }
    }

    if (state.phase === 'intencao' && state.userAnswer && !state.confirmed) {
      return {
        ...state,
        nextStep: 'intencao'
      }
    }

    if (state.phase === 'refinamento' && !state.readyForExecution) {
      return {
        ...state,
        nextStep: 'refinamento'
      }
    }

    if (state.phase === 'execucao' || (state.readyForExecution && state.confirmed)) {
      const phased = this.applyPhase(state, 'execucao')
      return {
        ...phased,
        nextStep: 'execucao'
      }
    }

    return {
      ...state,
      nextStep: 'end'
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

  private stripAccents(value: string): string {
    return value.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '')
  }

  private detectCancellation(message: string | null | undefined): boolean {
    if (!message) {
      return false
    }

    const normalized = message.toLowerCase()
    return CANCEL_KEYWORDS.some((keyword) => normalized.includes(keyword))
  }

  private async classifyRouterIntent(message: string): Promise<RouterIntent> {
    const prompt = ROUTER_CLASSIFICATION_PROMPT(message)
    const rawResult = await this.deps.languageModel.complete(prompt, {
      justification: 'Classificando a intencao do usuario'
    })

    return this.normalizeRouterIntent(rawResult)
  }

  private normalizeRouterIntent(result: string): RouterIntent {
    const normalized = this.stripAccents(result).trim().toLowerCase()

    const allowed: RouterIntent[] = ['smalltalk', 'cancelamento', 'intencao', 'refinamento', 'confirmacao', 'execucao']
    if (allowed.includes(normalized as RouterIntent)) {
      return normalized as RouterIntent
    }

    return 'desconhecido'
  }

  private handleCancellation(state: PlanningGraphState, reason: string): PlanningGraphState {
    const response = 'Tudo bem, cancelo a tarefa atual. Quando quiser iniciar outra, e so me chamar.'
    const baseState = this.resetForNewConversation(state, response)

    return {
      ...baseState,
      cancelled: true,
      cancellationReason: reason,
      routerIntent: 'cancelamento',
      nextStep: 'end',
      awaitingUser: false
    }
  }

  private isSmallTalk(message: string): boolean {
    const normalized = message.toLowerCase().trim()
    const greetings = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'hey', 'qual meu nome', 'meu nome é', 'meu nome e']
    return greetings.some((greeting) => normalized.includes(greeting) && normalized.length < 50)
  }

  private buildSmallTalkResponse(message: string): string {
    const normalized = message.toLowerCase()
    if (normalized.includes('meu nome')) {
      return 'Olá! Você me disse que seu nome é cecon. Como posso ajudá-lo hoje?'
    }
    if (normalized.includes('qual meu nome')) {
      return 'Seu nome é cecon. Em que posso ajudá-lo?'
    }
    if (normalized.includes('bom dia')) {
      return 'Bom dia, cecon! Como posso ajudar hoje?'
    }
    if (normalized.includes('boa tarde')) {
      return 'Boa tarde, cecon! Em que posso colaborar?'
    }
    if (normalized.includes('boa noite')) {
      return 'Boa noite, cecon! Vamos trabalhar em alguma tarefa?'
    }
    return 'Olá, cecon! Pronto para ajudar. Qual tarefa você quer abordar?'
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

