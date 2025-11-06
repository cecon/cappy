/**
 * @fileoverview Clarification agent - handles unclear requests
 * @module sub-agents/clarification/agent
 */

import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse, Intent } from '../shared/types'
import { buildClarificationPrompt, buildClarificationWithOptions, GENERIC_CLARIFICATION } from './prompts'
import { ScopeClarityPhaseHandler, type ScopeGap } from '../../chat-engine/phases/scope-clarity-phase'

/**
 * ClarificationAgent
 * 
 * Handles requests that are unclear or vague
 * Asks for more information without looping
 * 
 * Priority: 90 (high - check before analysis)
 */
export class ClarificationAgent extends BaseSubAgent {
  readonly name = 'ClarificationAgent'
  readonly priority = 90
  
  private readonly CLARITY_THRESHOLD = 0.5
  
  /**
   * Can handle if clarity score is low
   */
  canHandle(context: SubAgentContext): boolean {
    const clarityScore = this.getClarityScore(context)
    const needsClarification = clarityScore < this.CLARITY_THRESHOLD
    
    if (needsClarification) {
      this.log(`✅ Low clarity score (${clarityScore}), needs clarification`)
    }
    
    return needsClarification
  }
  
  /**
   * Process unclear request - ask for clarification ONCE
   */
  async process(context: SubAgentContext): Promise<SubAgentResponse> {
    this.log('Asking for clarification...')
    
    const { userMessage, intent } = context
    let clarificationMessage: string
    
    if (!intent) {
      // No intent extracted - generic clarification
      clarificationMessage = GENERIC_CLARIFICATION
    } else if (intent.ambiguities && intent.ambiguities.length > 0) {
      // Has specific ambiguities - mention them
      clarificationMessage = buildClarificationPrompt(userMessage, Array.from(intent.ambiguities))
    } else {
      // Has category but unclear - offer options
      clarificationMessage = buildClarificationWithOptions(userMessage, intent.category)
    }
    
    this.log('Clarification message prepared')
    
    return this.createResponse(
      clarificationMessage,
      true, // needs more info
      'AnalysisAgent' // next agent to handle clarified request
    )
  }
  
  /**
   * Process with streaming - ask clarification questions incrementally
   */
  async *processStream(context: SubAgentContext): AsyncIterable<string> {
    this.log('Starting clarification with streaming...')
    
    const { userMessage, intent, onPromptRequest } = context
    
    // Close any open reasoning block first
    yield '__REASONING_END__\n\n'
    
    // If no prompt callback available, fallback to single message
    if (!onPromptRequest) {
      this.log('No onPromptRequest available, using fallback')
      const response = await this.process(context)
      yield response.content
      return
    }
    
    try {
      // Start incremental clarification
      yield `Entendi que você mencionou: **"${userMessage}"**\n\n`
      yield `Vou fazer algumas perguntas para entender melhor o que você precisa.\n\n`
      
      const questions = this.buildClarificationQuestions(intent)
      const answers: string[] = []
      
      // Ask questions one by one
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        
        yield `**${i + 1}/${questions.length}:** ${question.text}\n`
        
        if (question.suggestions && question.suggestions.length > 0) {
          yield `\n*Sugestões:*\n`
          for (const suggestion of question.suggestions) {
            yield `  • ${suggestion}\n`
          }
        }
        
        yield `\n`
        
        // Request answer from user
        const answer = await onPromptRequest({
          messageId: `clarification-${Date.now()}-${i}`,
          prompt: question.text,
          suggestions: question.suggestions,
          type: question.suggestions ? 'choice' : 'question'
        })
        
        answers.push(answer)
        
        // Show user's answer
        yield `✅ **Sua resposta:** ${answer}\n\n`
      }
      
      // Summarize clarification
      yield `---\n\n`
      yield `✨ **Resumo da Clarificação:**\n\n`
      yield `**Solicitação original:** ${userMessage}\n\n`
      
      for (let i = 0; i < questions.length; i++) {
        yield `**${questions[i].text}**\n`
        yield `→ ${answers[i]}\n\n`
      }
      
      yield `Agora vou analisar sua solicitação com essas informações...\n`
      
      this.log('Clarification completed successfully')
      
    } catch (error) {
      this.log(`Error during clarification: ${error}`)
      yield `\n❌ Ocorreu um erro durante a clarificação. Vou prosseguir com a análise baseada na sua mensagem original.\n`
    }
  }
  
  /**
   * Build clarification questions based on intent
   * Uses Scope Clarity Agent for intelligent question generation
   */
  private buildClarificationQuestions(intent: Intent | undefined): Array<{text: string; suggestions?: string[]}> {
    const questions: Array<{text: string; suggestions?: string[]}> = []
    
    if (!intent) {
      questions.push({
        text: 'O que você gostaria de fazer?',
        suggestions: [
          'Implementar uma nova funcionalidade',
          'Corrigir um bug',
          'Analisar código existente',
          'Criar documentação',
          'Outro'
        ]
      })
      return questions
    }
    
    // Use Scope Clarity to analyze vagueness
    const clarityAnalysis = ScopeClarityPhaseHandler.analyzeClarity(intent.objective)
    
    if (!clarityAnalysis.isSpecific && clarityAnalysis.gaps.length > 0) {
      const gaps = clarityAnalysis.gaps
      
      this.log(`Using Scope Clarity: found ${gaps.length} gaps`)
      
      // Question 1: Technology if missing
      const techGap = gaps.find((g: ScopeGap) => g.category === 'technology')
      if (techGap) {
        questions.push({
          text: 'Qual tecnologia você quer usar?',
          suggestions: ['React', 'Vue', 'VS Code Webview', 'VS Code Quick Pick', 'Outra']
        })
      }
      
      // Question 2: Persistence if missing
      const persistenceGap = gaps.find((g: ScopeGap) => g.category === 'persistence')
      if (persistenceGap) {
        questions.push({
          text: 'Onde os dados devem ser salvos?',
          suggestions: ['VS Code Settings', 'Arquivo no projeto', 'Banco de dados', 'Memória']
        })
      }
      
      // Question 3: Requirements if missing
      const reqGap = gaps.find((g: ScopeGap) => g.category === 'requirements')
      if (reqGap) {
        questions.push({
          text: 'Quais são os principais requisitos/funcionalidades?',
          suggestions: undefined
        })
      }
      
      if (questions.length > 0) {
        return questions
      }
    }
    
    // Fallback to old logic
    this.log('Using fallback clarification questions')
    
    // Question 1: Clarify objective if vague
    if (intent.clarityScore < 0.6) {
      questions.push({
        text: `Entendi que você quer: "${intent.objective}". Pode detalhar melhor?`,
        suggestions: undefined
      })
    }
    
    // Question 2: Ask about specific ambiguities
    if (intent.ambiguities && intent.ambiguities.length > 0) {
      for (const ambiguity of intent.ambiguities) {
        questions.push({
          text: ambiguity,
          suggestions: undefined
        })
      }
    }
    
    // Question 3: Category-specific clarification
    switch (intent.category) {
      case 'feature-implementation':
        questions.push({
          text: 'Esta funcionalidade deve ser criada do zero ou integrada com código existente?',
          suggestions: ['Do zero', 'Integrar com existente', 'Refatorar existente']
        })
        break
        
      case 'bug-fix':
        questions.push({
          text: 'Você já identificou onde está o problema ou precisa de ajuda para localizar?',
          suggestions: ['Já sei onde está', 'Preciso ajuda para localizar']
        })
        break
        
      case 'documentation':
        questions.push({
          text: 'Que tipo de documentação você precisa?',
          suggestions: ['README', 'API docs', 'Arquitetura', 'Guia de uso']
        })
        break
        
      case 'general':
        questions.push({
          text: 'Qual o contexto do seu projeto?',
          suggestions: ['Web app', 'API/Backend', 'Mobile', 'CLI tool', 'Biblioteca']
        })
        break
    }
    
    // Ensure at least one question
    if (questions.length === 0) {
      questions.push({
        text: 'Há mais algum detalhe importante que eu deva saber?',
        suggestions: undefined
      })
    }
    
    return questions
  }
}
