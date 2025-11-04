import type { AnalystState, PhaseResult } from '../types'
import { parseQuestions } from '../parsers/json-parser'

/**
 * Handle Questions Generation Phase
 */
export class QuestionsPhaseHandler {
  
  static process(text: string, state: AnalystState): PhaseResult {
    console.log('[QuestionsPhaseHandler] Processing questions phase')
    
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