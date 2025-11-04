import type { AnalystState, PhaseResult } from '../types'
import { parseIntent } from '../parsers/json-parser'

/**
 * Handle Intent Extraction Phase
 */
export class IntentPhaseHandler {
  
  static process(text: string, state: AnalystState): PhaseResult {
    console.log('[IntentPhaseHandler] Processing intent phase')
    
    // Check if response contains intent JSON
    if (text.includes('"objective"')) {
      try {
        const intent = parseIntent(text)
        state.intent = intent
        state.currentPhase = 'context'
        
        console.log('[IntentPhaseHandler] Phase transition: intent → context')
        console.log(`[IntentPhaseHandler] Intent extracted: ${intent.objective}`)
        console.log('[IntentPhaseHandler] Forcing continue to avoid premature exit')
        
        return { type: 'continue' }
      } catch (e) {
        console.warn('[IntentPhaseHandler] Failed to parse intent:', e)
      }
    }

    // Debug: Log when intent phase is detected but no transition happens
    console.log('[IntentPhaseHandler] Still in intent phase, text preview:', text.substring(0, 200))
    console.log('[IntentPhaseHandler] Contains objective?', text.includes('"objective"'))
    
    return { type: 'continue' }
  }
}