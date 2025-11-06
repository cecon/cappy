/**
 * @fileoverview Context Organizer agent - curates and summarizes retrieval results
 * @module sub-agents/context-organizer/agent
 */

import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse } from '../shared/types'

/**
 * ContextOrganizerAgent
 * 
 * Sits between retrieval and analysis:
 * 1. Receives raw retrieval results
 * 2. Filters irrelevant or duplicate files
 * 3. Groups by relevance/category
 * 4. Generates executive summary
 * 5. Passes curated context to AnalysisAgent
 * 
 * Priority: 85 (between Clarification:90 and Analysis:80)
 */
export class ContextOrganizerAgent extends BaseSubAgent {
  readonly name = 'ContextOrganizerAgent'
  readonly priority = 85
  
  private readonly MIN_CLARITY_FOR_ORGANIZATION = 0.5
  
  /**
   * Can handle if:
   * - Clarity score is above threshold (not a clarification case)
   * - Request will need context retrieval
   */
  canHandle(context: SubAgentContext): boolean {
    const clarityScore = this.getClarityScore(context)
    const needsContext = this.needsContextRetrieval(context)
    
    const shouldHandle = clarityScore >= this.MIN_CLARITY_FOR_ORGANIZATION && needsContext
    
    if (shouldHandle) {
      this.log(`✅ Will organize context for analysis (clarity: ${clarityScore})`)
    }
    
    return shouldHandle
  }
  
  /**
   * Process: organize retrieval results before analysis
   */
  async process(context: SubAgentContext): Promise<SubAgentResponse> {
    this.log('Organizing context for analysis...')
    
    const { userMessage, intent } = context
    
    // Build organization strategy message
    const organizationPlan = this.buildOrganizationPlan(userMessage, intent)
    
    return this.createResponse(
      organizationPlan,
      false, // doesn't need more info - ready for analysis
      'AnalysisAgent' // next agent
    )
  }
  
  /**
   * Check if request needs context retrieval
   */
  private needsContextRetrieval(context: SubAgentContext): boolean {
    const { intent } = context
    
    if (!intent) return false
    
    // Categories that typically need context
    const contextCategories = [
      'feature-implementation',
      'bug-fix',
      'refactoring',
      'documentation',
      'testing',
      'architecture',
      'general'
    ]
    
    return contextCategories.includes(intent.category)
  }
  
  /**
   * Build organization plan for retrieval
   */
  private buildOrganizationPlan(userMessage: string, intent: any): string {
    const parts: string[] = []
    
    parts.push('📋 **Estratégia de Organização de Contexto**\n')
    parts.push(`\n**Solicitação:** ${userMessage}\n`)
    
    if (intent) {
      parts.push(`**Objetivo:** ${intent.objective}\n`)
      
      if (intent.technicalTerms && intent.technicalTerms.length > 0) {
        parts.push(`**Termos-chave:** ${intent.technicalTerms.join(', ')}\n`)
      }
    }
    
    parts.push('\n**Plano de Busca:**')
    parts.push('1. 🔍 Buscar arquivos relevantes no projeto')
    parts.push('2. 📊 Filtrar por relevância (score > 0.6)')
    parts.push('3. 🗂️ Agrupar por categoria (código, docs, regras)')
    parts.push('4. 📝 Gerar resumo executivo')
    parts.push('5. ✅ Passar contexto curado para análise\n')
    
    parts.push('⏳ *Iniciando busca contextual...*')
    
    return parts.join('\n')
  }
}
