import type { AnalystState, PhaseResult, Question, Answer } from '../types'
import { ScopeQuestionGenerator } from '../services/question-generator'

/**
 * Scope Questions Phase Handler
 * 
 * Apresenta perguntas de clarificação ao usuário e processa suas respostas.
 * Constrói um escopo refinado a partir das respostas para otimizar a busca de contexto.
 */
export class ScopeQuestionsPhaseHandler {
  /**
   * Apresenta perguntas de clarificação ao usuário
   */
  static async process(text: string, state: AnalystState): Promise<PhaseResult> {
    console.log('[ScopeQuestionsPhase] Processing...')
    
    // Check if we're awaiting answers
    if (state.clarificationQuestions && state.clarificationQuestions.length > 0) {
      // User is responding to questions
      return this.processAnswers(text, state)
    }
    
    // Generate questions based on gaps
    console.log('[ScopeQuestionsPhase] Generating clarification questions...')
    
    const gaps = state.scopeClarity?.gaps || []
    const questions = await ScopeQuestionGenerator.generateQuestions(gaps)
    
    // Store questions in state
    state.clarificationQuestions = questions
    
    // Generate formatted message with questions
    const message = this.formatQuestionsMessage(questions, state.scopeClarity?.score || 0)
    
    return {
      type: 'ask',
      data: {
        message,
        questions,
        awaitingAnswers: true,
        nextPhase: 'scope-questions' // Stay in this phase to receive answers
      }
    }
  }
  
  /**
   * Processa respostas do usuário
   */
  private static processAnswers(text: string, state: AnalystState): PhaseResult {
    console.log('[ScopeQuestionsPhase] Processing user answers...')
    
    const answers = this.parseAnswers(text, state.clarificationQuestions || [])
    state.clarificationAnswers = answers
    
    // Validate all critical questions were answered
    const criticalQuestions = (state.clarificationQuestions || []).filter(q => 
      state.scopeClarity?.gaps.find(g => g.critical && this.questionMatchesGap(q, g))
    )
    
    const answeredIds = new Set(answers.map(a => a.questionId))
    const missingCritical = criticalQuestions.filter(q => !answeredIds.has(q.id))
    
    if (missingCritical.length > 0) {
      console.log('[ScopeQuestionsPhase] Critical questions not answered:', missingCritical.length)
      return {
        type: 'ask',
        data: {
          message: this.formatMissingQuestionsMessage(missingCritical),
          missingQuestions: missingCritical,
          nextPhase: 'scope-questions'
        }
      }
    }
    
    // Build refined scope from answers
    const refinedScope = this.buildRefinedScope(state.userInput, answers, state.clarificationQuestions || [])
    state.refinedScope = refinedScope
    
    console.log('[ScopeQuestionsPhase] Refined scope:', refinedScope)
    
    // Show summary and proceed to intent
    const summary = this.formatScopeSummary(refinedScope, answers)
    
    return {
      type: 'continue',
      data: {
        nextPhase: 'intent',
        message: summary
      }
    }
  }
  
  /**
   * Formata mensagem com perguntas para o usuário
   */
  private static formatQuestionsMessage(questions: Question[], clarityScore: number): string {
    let message = `📋 **Análise de Escopo** (Clareza: ${clarityScore}/100)\n\n`
    message += '🔍 **Preciso de mais informações para entender melhor seu pedido:**\n\n'
    
    questions.forEach((q, index) => {
      message += `**${index + 1}. ${q.question}**\n`
      message += `   💭 _${q.why}_\n\n`
      
      if (q.options && q.options.length > 0) {
        message += '   **Opções:**\n'
        q.options.forEach((opt, i) => {
          const letter = String.fromCharCode(97 + i) // a, b, c, ...
          message += `   ${letter}) ${opt}\n`
        })
        message += '\n'
      }
    })
    
    message += '\n💡 _Você pode responder com números/letras (ex: "1a, 2b, 3: arquivo custom") ou descrever livremente._\n'
    message += '⏩ _Para pular perguntas opcionais, responda "skip" ou "pular"._'
    
    return message
  }
  
  /**
   * Formata mensagem para perguntas não respondidas
   */
  private static formatMissingQuestionsMessage(missingQuestions: Question[]): string {
    let message = '⚠️ **Ainda faltam algumas informações importantes:**\n\n'
    
    missingQuestions.forEach((q, index) => {
      message += `**${index + 1}. ${q.question}**\n`
      if (q.options && q.options.length > 0) {
        message += '   Opções: ' + q.options.map((opt, i) => `${String.fromCharCode(97 + i)}) ${opt}`).join(' | ') + '\n'
      }
      message += '\n'
    })
    
    message += '\n💬 Por favor, responda as questões acima para prosseguir.'
    
    return message
  }
  
  /**
   * Formata resumo do escopo clarificado
   */
  private static formatScopeSummary(_refinedScope: string, answers: Answer[]): string {
    let message = '✅ **Escopo Clarificado!**\n\n'
    message += '📝 **Resumo das suas respostas:**\n'
    
    answers.forEach(answer => {
      const shortAnswer = answer.answer.length > 80 
        ? answer.answer.substring(0, 77) + '...' 
        : answer.answer
      message += `• ${answer.questionId}: ${shortAnswer}\n`
    })
    
    message += '\n🚀 **Prosseguindo com análise detalhada...**\n'
    message += '<!-- agent:continue -->'
    
    return message
  }
  
  /**
   * Parse de respostas do usuário
   */
  private static parseAnswers(text: string, questions: Question[]): Answer[] {
    const answers: Answer[] = []
    const timestamp = new Date().toISOString()
    
    // Try to parse structured answers (e.g., "1a, 2b, 3: custom answer")
    const structuredPattern = /(\d+)[:\s]*([a-z]|\w+)/gi
    let match
    
    while ((match = structuredPattern.exec(text)) !== null) {
      const questionIndex = parseInt(match[1]) - 1
      const answerText = match[2]
      
      if (questionIndex >= 0 && questionIndex < questions.length) {
        const question = questions[questionIndex]
        
        // Map letter to option
        let finalAnswer = answerText
        if (question.options && answerText.length === 1) {
          const optionIndex = answerText.charCodeAt(0) - 97 // 'a' = 0, 'b' = 1, etc
          if (optionIndex >= 0 && optionIndex < question.options.length) {
            finalAnswer = question.options[optionIndex]
          }
        }
        
        answers.push({
          questionId: question.id,
          answer: finalAnswer,
          timestamp
        })
      }
    }
    
    // If structured parsing failed, try to extract answers more loosely
    if (answers.length === 0) {
      // Simple heuristic: treat each line as a potential answer
      const lines = text.split('\n').filter(l => l.trim().length > 0)
      
      lines.forEach((line, index) => {
        if (index < questions.length) {
          const question = questions[index]
          
          // Check if line starts with number or letter
          const lineMatch = line.match(/^[\d\w)]+[:\s]*(.+)/)
          const answer = lineMatch ? lineMatch[1].trim() : line.trim()
          
          // Skip empty or "skip" answers
          if (answer && !['skip', 'pular', 'n/a'].includes(answer.toLowerCase())) {
            answers.push({
              questionId: question.id,
              answer,
              timestamp
            })
          }
        }
      })
    }
    
    console.log('[ScopeQuestionsPhase] Parsed answers:', answers.length)
    return answers
  }
  
  /**
   * Constrói escopo refinado a partir do input original e respostas
   */
  private static buildRefinedScope(
    originalScope: string, 
    answers: Answer[],
    questions: Question[]
  ): string {
    let refined = `${originalScope}\n\n**Detalhes Clarificados:**\n`
    
    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.questionId)
      if (question) {
        refined += `- **${question.question}**: ${answer.answer}\n`
      }
    })
    
    return refined
  }
  
  /**
   * Verifica se uma pergunta corresponde a uma lacuna
   */
  private static questionMatchesGap(question: Question, gap: { category: string; description: string }): boolean {
    return question.id.includes(gap.category) || 
           question.type === gap.category ||
           question.context.includes(gap.description)
  }
}
