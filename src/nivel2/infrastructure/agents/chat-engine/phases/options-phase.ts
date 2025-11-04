import type { AnalystState, PhaseResult } from '../types'
import { parseOptions } from '../parsers/json-parser'

/**
 * Handle Options Generation Phase
 */
export class OptionsPhaseHandler {
  
  static process(text: string, state: AnalystState): PhaseResult {
    console.log('[OptionsPhaseHandler] Processing options phase')
    
    // Try to parse options from response
    if (text.includes('"options"')) {
      try {
        const options = parseOptions(text)
        
        if (options.length > 0) {
          state.options = options
          state.currentPhase = 'spec'
          
          console.log('[OptionsPhaseHandler] Phase transition: options → spec')
          console.log(`[OptionsPhaseHandler] Generated ${options.length} options`)
          
          return { type: 'continue' }
        }
        
      } catch (e) {
        console.warn('[OptionsPhaseHandler] Failed to parse options:', e)
      }
    }

    // If no options could be generated, proceed to spec
    console.log('[OptionsPhaseHandler] No options generated, moving to spec')
    state.currentPhase = 'spec'
    return { type: 'continue' }
  }
}