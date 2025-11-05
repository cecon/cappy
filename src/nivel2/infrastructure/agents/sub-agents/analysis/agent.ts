/**
 * @fileoverview Analysis agent - handles clear requests with retrieval
 * @module sub-agents/analysis/agent
 */

import * as vscode from 'vscode'
import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse, Intent } from '../shared/types'
import type { RetrieveContextUseCase } from '../../../../../domains/retrieval/use-cases/retrieve-context-use-case'
import { RetrievalHelper, type RetrievedContext } from './retrieval'
import { ANALYSIS_SYSTEM_PROMPT, buildRetrievalPrompt, buildAcknowledgment, NO_CONTEXT_FOUND } from './prompts'

/**
 * AnalysisAgent
 * 
 * Handles clear requests by:
 * 1. Retrieving context from vector database
 * 2. Analyzing with LLM
 * 3. Generating comprehensive plan
 * 
 * Priority: 50 (default - after greeting and clarification)
 */
export class AnalysisAgent extends BaseSubAgent {
  readonly name = 'AnalysisAgent'
  readonly priority = 50
  
  private readonly retrievalHelper: RetrievalHelper
  
  constructor(retrieveContextUseCase?: RetrieveContextUseCase) {
    super()
    this.retrievalHelper = new RetrievalHelper(retrieveContextUseCase)
  }
  
  /**
   * Can handle if intent is clear (high clarity score)
   */
  canHandle(context: SubAgentContext): boolean {
    const clarityScore = this.getClarityScore(context)
    const isClear = clarityScore >= 0.5
    
    if (isClear) {
      this.log(`✅ Clear request (clarity: ${clarityScore}), can analyze`)
    }
    
    return isClear
  }
  
  /**
   * Process clear request - retrieve context and analyze
   */
  async process(context: SubAgentContext): Promise<SubAgentResponse> {
    this.log('Starting analysis...')
    
    const { intent } = context
    if (!intent) {
      this.log('⚠️ No intent available, cannot analyze')
      return this.createResponse(
        'Não foi possível extrair a intenção da mensagem. Pode reformular?',
        true
      )
    }
    
    // Step 1: Acknowledge and start retrieval
    const acknowledgment = buildAcknowledgment(intent.objective)
    this.log('Acknowledging request:', intent.objective)
    
    // Step 2: Retrieve context
    const retrievedContext = await this.retrievalHelper.retrieveContext(intent)
    this.log(`Retrieved ${retrievedContext.totalResults} contexts`)
    
    // Step 3: Check if we found anything
    if (retrievedContext.totalResults === 0) {
      this.log('No context found, asking for more info')
      return this.createResponse(
        `${acknowledgment}\n\n${NO_CONTEXT_FOUND}`,
        true
      )
    }
    
    // Step 4: Analyze with LLM
    const analysis = await this.analyzeWithLLM(intent, retrievedContext)
    
    // Step 5: Return complete response
    const fullResponse = `${acknowledgment}\n\n${analysis}`
    
    return this.createResponse(
      fullResponse,
      false, // analysis complete
      undefined,
    )
  }
  
  /**
   * Analyze retrieved context with LLM
   */
  private async analyzeWithLLM(intent: Intent, context: RetrievedContext): Promise<string> {
    try {
      // Get VS Code LLM
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      })
      
      if (models.length === 0) {
        this.log('⚠️ No LLM available')
        return this.buildFallbackAnalysis(intent, context)
      }
      
      const model = models[0]
      this.log('Using LLM for analysis...')
      
      // Build prompt with context
      const contextSummary = this.buildContextSummary(context)
      const analysisPrompt = buildRetrievalPrompt(intent.objective, intent.category)
      
      const messages = [
        vscode.LanguageModelChatMessage.User(ANALYSIS_SYSTEM_PROMPT),
        vscode.LanguageModelChatMessage.User(`${analysisPrompt}\n\nContexto recuperado:\n${contextSummary}`)
      ]
      
      // Get LLM response
      const request = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token)
      
      let analysis = ''
      for await (const fragment of request.stream) {
        if (fragment instanceof vscode.LanguageModelTextPart) {
          analysis += fragment.value
        }
      }
      
      this.log('Analysis complete')
      return analysis || this.buildFallbackAnalysis(intent, context)
      
    } catch (error) {
      this.log('Error during LLM analysis:', error)
      return this.buildFallbackAnalysis(intent, context)
    }
  }
  
  /**
   * Build context summary for LLM
   */
  private buildContextSummary(context: RetrievedContext): string {
    const parts = []
    
    if (context.code.length > 0) {
      parts.push(`**Código encontrado (${context.code.length} referências):**`)
      context.code.slice(0, 3).forEach((ctx, i: number) => {
        parts.push(`${i + 1}. ${ctx.source || 'Unknown'} - ${ctx.content.substring(0, 200)}...`)
      })
    }
    
    if (context.documentation.length > 0) {
      parts.push(`\n**Documentação (${context.documentation.length} referências):**`)
      context.documentation.slice(0, 2).forEach((ctx, i: number) => {
        parts.push(`${i + 1}. ${ctx.source || 'Unknown'} - ${ctx.content.substring(0, 150)}...`)
      })
    }
    
    if (context.prevention.length > 0) {
      parts.push(`\n**Regras de prevenção (${context.prevention.length}):**`)
      context.prevention.slice(0, 2).forEach((ctx, i: number) => {
        parts.push(`${i + 1}. ${ctx.content.substring(0, 100)}...`)
      })
    }
    
    return parts.join('\n')
  }
  
  /**
   * Fallback analysis when LLM is not available
   */
  private buildFallbackAnalysis(intent: Intent, context: RetrievedContext): string {
    return `Análise para: ${intent.objective}

**Contexto encontrado:**
- ${context.code.length} referências de código
- ${context.documentation.length} documentos
- ${context.prevention.length} regras de prevenção

**Próximos passos recomendados:**
1. Revisar o código existente relacionado
2. Verificar padrões de arquitetura similares
3. Planejar a implementação baseado nos exemplos encontrados

Use o comando de busca para explorar o contexto em mais detalhes.`
  }
}
