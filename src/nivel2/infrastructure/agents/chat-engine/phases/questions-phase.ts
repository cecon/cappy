import type { AnalystState, PhaseResult } from '../types'
import { parseQuestions } from '../parsers/json-parser'

/**
 * Handle Questions Generation Phase
 */
export class QuestionsPhaseHandler {
  
  static process(text: string, state: AnalystState): PhaseResult {
    console.log('[QuestionsPhaseHandler] Processing questions phase')
    
    // Handle unclear requests directly
    if (state.intent && state.intent.clarityScore < 0.5) {
      console.log('[QuestionsPhaseHandler] Low clarity score, generating clarification questions')
      
      const clarificationQuestions = [{
        id: 'clarification',
        question: `Sua mensagem "${state.userInput}" não ficou clara para mim. Você poderia me explicar melhor o que você precisa?`,
        type: 'clarification' as const,
        context: 'Preciso entender melhor sua solicitação',
        why: 'Para poder ajudar você adequadamente',
        options: [
          'Implementar uma nova funcionalidade',
          'Corrigir um problema existente', 
          'Analisar código existente',
          'Criar documentação',
          'Outra coisa'
        ]
      }]
      
      state.questions = clarificationQuestions
      return { type: 'ask', data: clarificationQuestions }
    }
    
    // Try to parse questions from response
    if (text.includes('"questions"')) {
      try {
        const questions = parseQuestions(text)
        
        if (questions.length > 0) {
          state.questions = questions
          state.currentPhase = 'options'
          
          console.log('[QuestionsPhaseHandler] Phase transition: questions → options')
          console.log(`[QuestionsPhaseHandler] Generated ${questions.length} questions`)
          
          return { type: 'ask', data: questions }
        }
        
      } catch (e) {
        console.warn('[QuestionsPhaseHandler] Failed to parse questions:', e)
        
        // Create fallback question based on intent
        if (state.intent) {
          const fallbackQuestion = {
            id: 'q1',
            question: `Could you provide more details about "${state.intent.objective}"?`,
            type: 'clarification' as const,
            context: 'Need more information to proceed with implementation',
            why: 'To create accurate technical specification',
            options: []
          }
          
          state.questions = [fallbackQuestion]
          return { type: 'ask', data: [fallbackQuestion] }
        }
      }
    }

    // If no questions could be generated, move to options
    console.log('[QuestionsPhaseHandler] No questions generated, moving to options')
    state.currentPhase = 'options'
    return { type: 'continue' }
  }
}