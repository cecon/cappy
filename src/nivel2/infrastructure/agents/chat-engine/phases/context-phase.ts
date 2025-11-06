import * as vscode from 'vscode'
import type { AnalystState, PhaseResult } from '../types'

/**
 * Handle Context Gathering Phase
 */
export class ContextPhaseHandler {
  private static retrievalAttempts = 0
  private static readonly MAX_RETRIEVAL_ATTEMPTS = 3

  static async process(
    text: string, 
    state: AnalystState, 
    toolCalls: vscode.LanguageModelToolCallPart[]
  ): Promise<PhaseResult> {
    console.log('[ContextPhaseHandler] Processing context phase')
    
    // Use refined scope if available (from scope-clarity phase)
    const searchQuery = state.refinedScope || state.userInput
    const hasRefinedScope = !!state.refinedScope
    
    if (hasRefinedScope) {
      console.log('[ContextPhaseHandler] ✅ Using refined scope from clarification')
      console.log('[ContextPhaseHandler] Refined scope:', searchQuery.substring(0, 100) + '...')
    } else {
      console.log('[ContextPhaseHandler] Using original user input')
    }
    
    // Extract technical terms from refined scope for better retrieval
    const technicalTerms = this.extractTechnicalTerms(searchQuery)
    console.log('[ContextPhaseHandler] Technical terms extracted:', technicalTerms)
    
    // If this looks like a simple greeting that somehow passed through, skip context phase
    if (state.userInput && /^(oi|olá|hello|hi|hey)\.?!?$/i.test(state.userInput.trim())) {
      console.log('[ContextPhaseHandler] Simple greeting detected in context phase, transitioning to done')
      state.currentPhase = 'done'
      return { type: 'done' }
    }
    
    // Initialize context if necessary
    if (!state.context) {
      state.context = {
        code: [],
        documentation: [],
        prevention: [],
        tasks: [],
        existingPatterns: [],
        gaps: []
      }
    }

    // Track retrieval attempts to prevent infinite loops
    if (toolCalls.some(tc => tc.name === 'cappy_retrieve_context')) {
      this.retrievalAttempts++
      console.log(`[ContextPhaseHandler] Retrieval attempt: ${this.retrievalAttempts}/${this.MAX_RETRIEVAL_ATTEMPTS}`)
    }

    // Process tool calls for retrieval
    for (const toolCall of toolCalls) {
      if (toolCall.name === 'cappy_retrieve_context') {
        console.log('[ContextPhaseHandler] Processing retrieval call...')
        
        try {
          // Skip tool invocation for now - tools are handled by the LLM directly
          console.log('[ContextPhaseHandler] Tool call detected:', toolCall.name)
          
        } catch (error) {
          console.error('[ContextPhaseHandler] Error processing tool call:', error)
        }
      }
    }

    // Check various exit conditions
    const totalResults = Object.values(state.context).flat().length
    const hasContextContent = text.includes('context') || text.includes('analysis') || text.includes('found')
    const isAnalysisComplete = text.includes('Analysis of Gaps') || text.includes('analysis complete')
    const hasReachedMaxRetrieval = this.retrievalAttempts >= this.MAX_RETRIEVAL_ATTEMPTS

    if (totalResults > 0 || isAnalysisComplete || hasContextContent || hasReachedMaxRetrieval) {
      console.log('[ContextPhaseHandler] Phase transition: context → questions')
      console.log(`[ContextPhaseHandler] Exit reason: totalResults=${totalResults}, isAnalysisComplete=${isAnalysisComplete}, hasContextContent=${hasContextContent}, hasReachedMaxRetrieval=${hasReachedMaxRetrieval}`)
      
      // Extract gaps from text
      this.extractGaps(text, state)
      
      // Reset retrieval counter for next session
      this.retrievalAttempts = 0
      
      state.currentPhase = 'questions'
      return { type: 'continue' }
    }

    // If we have no tool calls and no apparent progress, also transition
    if (toolCalls.length === 0 && state.step > 2) {
      console.log('[ContextPhaseHandler] No tool calls and multiple steps, transitioning to questions')
      state.currentPhase = 'questions'
      this.retrievalAttempts = 0
      return { type: 'continue' }
    }

    return { type: 'continue' }
  }
  
  private static extractGaps(text: string, state: AnalystState): void {
    const gaps: string[] = []
    
    if (text.includes('no_code_examples')) gaps.push('no_code_examples')
    if (text.includes('no_prevention_rules')) gaps.push('no_prevention_rules_for_' + state.intent?.category)
    if (text.includes('low_clarity_score')) gaps.push('low_clarity_score')
    
    if (state.context) {
      state.context.gaps = gaps
    }
    
    console.log('[ContextPhaseHandler] Gaps identified:', gaps.join(', '))
  }
  
  /**
   * Extract technical terms from text for optimized retrieval
   */
  private static extractTechnicalTerms(text: string): string[] {
    const techPatterns = [
      // UI Technologies
      /\b(react|vue|angular|webview|quickpick|treeview|svelte)\b/gi,
      // Web Technologies
      /\b(html|css|javascript|typescript|jsx|tsx)\b/gi,
      // API/Communication
      /\b(api|rest|graphql|websocket|http|https)\b/gi,
      // Data Formats
      /\b(json|yaml|xml|config|toml)\b/gi,
      // Concepts
      /\b(validation|persistence|storage|authentication|authorization)\b/gi,
      // File operations
      /\b(file|arquivo|settings|configuration)\b/gi,
      // VS Code specific
      /\b(vscode|extension|command|workbench)\b/gi
    ]
    
    const terms = new Set<string>()
    techPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(m => terms.add(m.toLowerCase()))
      }
    })
    
    return Array.from(terms)
  }
}
