import type { AnalystState, PhaseResult } from '../types'
import { parseIntent } from '../parsers/json-parser'

/**
 * Handle Intent Extraction Phase
 */
export class IntentPhaseHandler {
  
  static process(text: string, state: AnalystState): PhaseResult {
    console.log('[IntentPhaseHandler] Processing intent phase')
    
    // Check if response contains intent JSON (even embedded in natural text)
    const jsonMatch = text.match(/\{[^}]*"objective"[^}]*\}/s)
    if (jsonMatch || text.includes('"objective"')) {
      try {
        let jsonText = jsonMatch ? jsonMatch[0] : text
        // Try to extract JSON from the text
        if (!jsonMatch) {
          // Look for JSON patterns in the text
          const patterns = [
            /\{[\s\S]*?"objective"[\s\S]*?\}/,
            /"objective"[\s\S]*?\}/,
            /\{[\s\S]*?"objective"[\s\S]*/
          ]
          
          for (const pattern of patterns) {
            const match = text.match(pattern)
            if (match) {
              jsonText = match[0]
              // Try to complete incomplete JSON
              if (!jsonText.endsWith('}')) {
                jsonText += '}'
              }
              break
            }
          }
        }
        
        const intent = parseIntent(jsonText)
        state.intent = intent
        state.currentPhase = 'context'
        
        console.log('[IntentPhaseHandler] Phase transition: intent → context')
        console.log(`[IntentPhaseHandler] Intent extracted: ${intent.objective}`)
        console.log('[IntentPhaseHandler] Forcing continue to avoid premature exit')
        
        return { type: 'continue' }
      } catch (e) {
        console.warn('[IntentPhaseHandler] Failed to parse intent:', e)
        console.warn('[IntentPhaseHandler] Text that failed to parse:', text.substring(0, 300))
      }
    }

    // If clarityScore is very low, transition to questions phase
    if (text.includes('clarityScore') && text.includes('0.1')) {
      console.log('[IntentPhaseHandler] Low clarity score detected, transitioning to questions')
      state.currentPhase = 'questions'
      return { type: 'continue' }
    }

    // Debug: Log when intent phase is detected but no transition happens
    console.log('[IntentPhaseHandler] Still in intent phase, text preview:', text.substring(0, 200))
    console.log('[IntentPhaseHandler] Contains objective?', text.includes('"objective"'))
    
    return { type: 'continue' }
  }
}