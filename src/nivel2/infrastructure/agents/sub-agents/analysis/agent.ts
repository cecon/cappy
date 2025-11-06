/**
 * @fileoverview Analysis agent - handles clear requests with retrieval
 * @module sub-agents/analysis/agent
 */

import * as vscode from 'vscode'
import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse, Intent } from '../shared/types'
import type { RetrieveContextUseCase } from '../../../../../domains/retrieval/use-cases/retrieve-context-use-case'
import { RetrievalHelper, type RetrievedContext } from './retrieval'
import { ANALYSIS_SYSTEM_PROMPT, buildRetrievalPrompt, NO_CONTEXT_FOUND } from './prompts'

/**
 * AnalysisAgent
 * 
 * Handles clear requests by:
 * 1. Retrieving context from vector database
 * 2. Analyzing with LLM
 * 3. Generating comprehensive plan
 * 
 * Priority: 80 (after ContextOrganizer:85, before general handlers)
 */
export class AnalysisAgent extends BaseSubAgent {
  readonly name = 'AnalysisAgent'
  readonly priority = 80
  
  private readonly retrievalHelper: RetrievalHelper
  
  constructor(retrieveContextUseCase?: RetrieveContextUseCase) {
    super()
    console.log(`[AnalysisAgent] Constructor called with useCase: ${!!retrieveContextUseCase}`)
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
    
    // Build thinking section
    let thinkingContent = ''
    
    // Step 1: Retrieve context
    thinkingContent += '🔍 **Buscando contexto no projeto...**\n\n'
    const retrievedContext = await this.retrievalHelper.retrieveContext(intent)
    this.log(`Retrieved ${retrievedContext.totalResults} contexts`)
    
    if (retrievedContext.totalResults > 0) {
      thinkingContent += `✅ Encontrei **${retrievedContext.totalResults} referências** relevantes:\n`
      if (retrievedContext.code.length > 0) {
        thinkingContent += `- ${retrievedContext.code.length} exemplos de código\n`
      }
      if (retrievedContext.documentation.length > 0) {
        thinkingContent += `- ${retrievedContext.documentation.length} documentos\n`
      }
      if (retrievedContext.prevention.length > 0) {
        thinkingContent += `- ${retrievedContext.prevention.length} regras de prevenção\n`
      }
      thinkingContent += '\n'
    } else {
      thinkingContent += '⚠️ **Nenhum contexto relevante encontrado no projeto.**\n\n'
      thinkingContent += 'Isso pode significar:\n'
      thinkingContent += '• É uma funcionalidade completamente nova\n'
      thinkingContent += '• Preciso de mais informações para buscar melhor\n'
      thinkingContent += '• Os termos usados não correspondem ao código existente\n\n'
    }
    
    // Step 2: Check if we found anything
    if (retrievedContext.totalResults === 0) {
      this.log('No context found, asking for more info')
      
      const clarificationMessage = `<!-- thinking -->\n${thinkingContent}<!-- /thinking -->\n\n` +
        `${NO_CONTEXT_FOUND}`
      
      return this.createResponse(
        clarificationMessage,
        true
      )
    }
    
    // Step 3: Add analysis indicator
    thinkingContent += '🧠 **Analisando com IA...**\n\n'
    
    // Step 4: Analyze with LLM
    const analysis = await this.analyzeWithLLM(intent, retrievedContext)
    
    // Step 5: Return complete response with thinking block
    const fullResponse = `<!-- thinking -->\n${thinkingContent}<!-- /thinking -->\n\n${analysis}`
    
    return this.createResponse(
      fullResponse,
      false, // analysis complete
      undefined,
    )
  }

  /**
   * Process with streaming - emit reasoning in real-time
   */
  async *processStream(context: SubAgentContext): AsyncIterable<string> {
    this.log('Starting streaming analysis...')
    
    const { intent } = context
    if (!intent) {
      this.log('⚠️ No intent available, cannot analyze')
      yield 'Não foi possível extrair a intenção da mensagem. Pode reformular?'
      return
    }
    
    // Emit reasoning start
    yield '__REASONING_START__\n'
    
    // Step 1: Show we're searching
    yield '🔍 **Buscando contexto no projeto...**\n\n'
    
    // Retrieve context (this might take a few seconds)
    const retrievedContext = await this.retrievalHelper.retrieveContext(intent)
    this.log(`Retrieved ${retrievedContext.totalResults} contexts`)
    
    // Step 2: Show what we found
    if (retrievedContext.totalResults > 0) {
      yield `✅ Encontrei **${retrievedContext.totalResults} referências** relevantes:\n`
      if (retrievedContext.code.length > 0) {
        yield `- ${retrievedContext.code.length} exemplos de código\n`
      }
      if (retrievedContext.documentation.length > 0) {
        yield `- ${retrievedContext.documentation.length} documentos\n`
      }
      if (retrievedContext.prevention.length > 0) {
        yield `- ${retrievedContext.prevention.length} regras de prevenção\n`
      }
      yield '\n'
    } else {
      yield '⚠️ **Nenhum contexto relevante encontrado no projeto.**\n\n'
      yield 'Isso pode significar:\n'
      yield '• É uma funcionalidade completamente nova\n'
      yield '• Preciso de mais informações para buscar melhor\n'
      yield '• Os termos usados não correspondem ao código existente\n\n'
    }
    
    // Step 3: Check if we found anything
    if (retrievedContext.totalResults === 0) {
      this.log('No context found, asking for more info')
      yield '__REASONING_END__\n\n'
      yield NO_CONTEXT_FOUND
      return
    }
    
    // Step 4: Show we're analyzing
    yield '🧠 **Analisando com IA...**\n'
    yield '__REASONING_END__\n\n'
    
    // Add a small indicator before LLM starts
    yield '💭 '
    
    // Step 5: Stream LLM analysis
    yield* this.analyzeWithLLMStream(intent, retrievedContext)
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
      
      // Get LLM response without tools (analysis is local, context already retrieved)
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
   * Analyze retrieved context with LLM - streaming version
   */
  private async *analyzeWithLLMStream(intent: Intent, context: RetrievedContext): AsyncIterable<string> {
    try {
      // Get VS Code LLM
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      })
      
      if (models.length === 0) {
        this.log('⚠️ No LLM available')
        yield this.buildFallbackAnalysis(intent, context)
        return
      }
      
      const model = models[0]
      this.log('Using LLM for streaming analysis...')
      
      // Build prompt with context
      const contextSummary = this.buildContextSummary(context)
      const analysisPrompt = buildRetrievalPrompt(intent.objective, intent.category)
      
      const messages = [
        vscode.LanguageModelChatMessage.User(ANALYSIS_SYSTEM_PROMPT),
        vscode.LanguageModelChatMessage.User(`${analysisPrompt}\n\nContexto recuperado:\n${contextSummary}`)
      ]
      
      // Stream LLM response
      const request = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token)
      
      let hasContent = false
      for await (const fragment of request.stream) {
        if (fragment instanceof vscode.LanguageModelTextPart) {
          yield fragment.value
          hasContent = true
        }
      }
      
      if (!hasContent) {
        yield this.buildFallbackAnalysis(intent, context)
      }
      
      this.log('Streaming analysis complete')
      
    } catch (error) {
      this.log('Error during LLM analysis:', error)
      yield this.buildFallbackAnalysis(intent, context)
    }
  }
  
  /**
   * Build context summary for LLM
   */
  private buildContextSummary(context: RetrievedContext): string {
    const parts = []
    
    if (context.code.length > 0) {
      parts.push(`**Código encontrado (${context.code.length} referências):**`)
      let i = 0
      for (const ctx of context.code.slice(0, 3)) {
        i++
        parts.push(`${i}. ${ctx.source || 'Unknown'} - ${ctx.content.substring(0, 200)}...`)
      }
    }
    
    if (context.documentation.length > 0) {
      parts.push(`\n**Documentação (${context.documentation.length} referências):**`)
      let i = 0
      for (const ctx of context.documentation.slice(0, 2)) {
        i++
        parts.push(`${i}. ${ctx.source || 'Unknown'} - ${ctx.content.substring(0, 150)}...`)
      }
    }
    
    if (context.prevention.length > 0) {
      parts.push(`\n**Regras de prevenção (${context.prevention.length}):**`)
      let i = 0
      for (const ctx of context.prevention.slice(0, 2)) {
        i++
        parts.push(`${i}. ${ctx.content.substring(0, 100)}...`)
      }
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
