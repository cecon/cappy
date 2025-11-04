import type { AnalystState, PhaseResult } from '../types'

/**
 * Handle Specification Generation Phase
 */
export class SpecPhaseHandler {
  
  static process(text: string, state: AnalystState): PhaseResult {
    console.log('[SpecPhaseHandler] Processing spec phase')
    
    // Check if specification is complete
    if (text.includes('<!-- agent:done -->')) {
      state.specification = text
      state.currentPhase = 'done'
      
      console.log('[SpecPhaseHandler] Phase transition: spec → done')
      console.log('[SpecPhaseHandler] Specification complete')
      
      return { type: 'done' }
    }

    // Continue building specification
    console.log('[SpecPhaseHandler] Continuing specification generation')
    return { type: 'continue' }
  }
}