import * as vscode from 'vscode'
import type { AnalystState, PhaseResult } from '../types'
import { IntentPhaseHandler } from './intent-phase'
import { ContextPhaseHandler } from './context-phase'
import { QuestionsPhaseHandler } from './questions-phase'
import { OptionsPhaseHandler } from './options-phase'
import { SpecPhaseHandler } from './spec-phase'

/**
 * Orchestrates the execution of different chat phases
 */
export class PhaseOrchestrator {
  
  static async processPhase(
    text: string,
    state: AnalystState,
    toolCalls: vscode.LanguageModelToolCallPart[] = []
  ): Promise<PhaseResult> {
    console.log(`[PhaseOrchestrator] Starting processPhase with phase: ${state.currentPhase}`)
    
    let phaseResult: PhaseResult = { type: 'continue' }
    
    try {
      // Route to appropriate phase handler
      switch (state.currentPhase) {
        case 'intent':
          phaseResult = IntentPhaseHandler.process(text, state)
          break
          
        case 'context':
          phaseResult = await ContextPhaseHandler.process(text, state, toolCalls)
          break
          
        case 'questions':
          phaseResult = QuestionsPhaseHandler.process(text, state)
          break
          
        case 'options':
          phaseResult = OptionsPhaseHandler.process(text, state)
          break
          
        case 'spec':
          phaseResult = SpecPhaseHandler.process(text, state)
          break
          
        case 'done':
          console.log('[PhaseOrchestrator] Phase is already done')
          phaseResult = { type: 'done' }
          break
          
        default:
          console.warn(`[PhaseOrchestrator] Unknown phase: ${state.currentPhase}`)
          phaseResult = { type: 'continue' }
      }
      
      console.log(`[PhaseOrchestrator] Phase processing result:`, phaseResult)
      return phaseResult
      
    } catch (error) {
      console.error(`[PhaseOrchestrator] Error processing phase ${state.currentPhase}:`, error)
      return { type: 'continue' }
    }
  }
  
  static shouldContinuePhase(
    state: AnalystState,
    toolCalls: vscode.LanguageModelToolCallPart[],
    phaseResult: PhaseResult,
    textAccumulator: string
  ): boolean {
    console.log(`[PhaseOrchestrator] Checking continuation: phase=${state.currentPhase}, toolCalls=${toolCalls.length}, result=${phaseResult.type}`)
    
    if (toolCalls.length === 0 && phaseResult.type === 'continue') {
      // Auto-continue for initial phases
      if (state.currentPhase === 'intent' || state.currentPhase === 'context') {
        console.log(`[PhaseOrchestrator] Auto-continuing from ${state.currentPhase} phase`)
        return true
      }
      
      // Check for continue marker
      if (textAccumulator.includes('<!-- agent:continue -->')) {
        console.log('[PhaseOrchestrator] Found continue marker, continuing...')
        return true
      }
      
      // Stop if no action needed
      console.log('[PhaseOrchestrator] No tool calls and no phase action, finishing')
      console.log(`[PhaseOrchestrator] Final state: phase=${state.currentPhase}, hasIntent=${!!state.intent}`)
      return false
    }
    
    return true
  }
}