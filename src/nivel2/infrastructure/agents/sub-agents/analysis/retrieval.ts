/**
 * @fileoverview Context retrieval logic for analysis agent
 * @module sub-agents/analysis/retrieval
 */

import type { RetrieveContextUseCase } from '../../../../../domains/retrieval/use-cases/retrieve-context-use-case'
import type { Intent } from '../shared/types'

/**
 * Type of retrieved context
 */
export type ContextType = 'code' | 'documentation' | 'prevention'

/**
 * Single context item retrieved from database
 */
export interface ContextItem {
  /** Type of context */
  readonly type: ContextType
  
  /** Source file or document path */
  readonly source: string
  
  /** Content of the context */
  readonly content: string
  
  /** Relevance score (0-1) */
  readonly score: number
  
  /** Metadata from vector search */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Context retrieved from database
 */
export interface RetrievedContext {
  /** Code examples and implementations */
  readonly code: readonly ContextItem[]
  
  /** Documentation and guides */
  readonly documentation: readonly ContextItem[]
  
  /** Prevention rules and best practices */
  readonly prevention: readonly ContextItem[]
  
  /** Total number of results across all types */
  readonly totalResults: number
  
  /** Query execution time in milliseconds */
  readonly retrievalTimeMs?: number
}

/**
 * Internal query structure for parallel execution
 */
interface InternalQuery {
  readonly query: string
  readonly sources: readonly ContextType[]
}

/**
 * RetrievalHelper
 * 
 * Handles vector database retrieval for analysis
 */
export class RetrievalHelper {
  private readonly retrieveContextUseCase: RetrieveContextUseCase | undefined
  
  constructor(retrieveContextUseCase?: RetrieveContextUseCase) {
    this.retrieveContextUseCase = retrieveContextUseCase
    console.log(`[RetrievalHelper] Constructor called with useCase: ${!!retrieveContextUseCase}`)
  }
  
  /**
   * Retrieve context based on intent
   */
  async retrieveContext(intent: Intent): Promise<RetrievedContext> {
    const startTime = Date.now()
    
    if (!this.retrieveContextUseCase) {
      console.warn('[RetrievalHelper] No retrieve context use case available')
      return this.emptyContext()
    }
    
    const { objective, category, technicalTerms } = intent
    
    console.log('[RetrievalHelper] Starting retrieval...')
    console.log(`[RetrievalHelper] Objective: ${objective}`)
    console.log(`[RetrievalHelper] Category: ${category}`)
    console.log(`[RetrievalHelper] Terms: ${technicalTerms.join(', ')}`)
    
    try {
      // Build search queries
      const queries = this.buildQueries(objective, category, technicalTerms)
      
      // Execute retrievals in parallel
      const results = await Promise.all(
        queries.map(q => this.executeRetrieval(q))
      )
      
      // Categorize results by type
      const code: ContextItem[] = []
      const documentation: ContextItem[] = []
      const prevention: ContextItem[] = []
      
      results.forEach(result => {
        result.contexts.forEach(ctx => {
          if (ctx.type === 'code') code.push(ctx)
          else if (ctx.type === 'documentation') documentation.push(ctx)
          else if (ctx.type === 'prevention') prevention.push(ctx)
        })
      })
      
      const totalResults = code.length + documentation.length + prevention.length
      const retrievalTimeMs = Date.now() - startTime
      
      console.log(`[RetrievalHelper] Retrieved ${totalResults} total contexts in ${retrievalTimeMs}ms`)
      console.log(`[RetrievalHelper] - Code: ${code.length}`)
      console.log(`[RetrievalHelper] - Documentation: ${documentation.length}`)
      console.log(`[RetrievalHelper] - Prevention: ${prevention.length}`)
      
      return { 
        code, 
        documentation, 
        prevention, 
        totalResults,
        retrievalTimeMs 
      }
      
    } catch (error) {
      console.error('[RetrievalHelper] Error during retrieval:', error)
      return this.emptyContext()
    }
  }
  
  /**
   * Build search queries based on intent
   */
  private buildQueries(objective: string, category: string, terms: readonly string[]): readonly InternalQuery[] {
    const queries: InternalQuery[] = []
    
    // Query 1: Direct objective search in code
    queries.push({
      query: `${objective} implementation`,
      sources: ['code']
    })
    
    // Query 2: Category-specific patterns
    queries.push({
      query: `${category} patterns examples`,
      sources: ['code', 'documentation']
    })
    
    // Query 3: Technical terms
    if (terms.length > 0) {
      queries.push({
        query: terms.join(' '),
        sources: ['code', 'documentation']
      })
    }
    
    // Query 4: Prevention rules for category
    queries.push({
      query: `${category} best practices rules`,
      sources: ['prevention']
    })
    
    return queries
  }
  
  /**
   * Execute a single retrieval query
   */
  private async executeRetrieval(query: InternalQuery): Promise<{ contexts: ContextItem[] }> {
    try {
      if (!this.retrieveContextUseCase) {
        return { contexts: [] }
      }
      
      const result = await this.retrieveContextUseCase.execute(
        query.query,
        {
          sources: Array.from(query.sources) as ('code' | 'documentation')[],
          maxResults: 5,
          strategy: 'hybrid',
          minScore: 0.5
        }
      )
      
      // Determine primary type from sources
      const primaryType: ContextType = query.sources[0]
      
      // Map raw results to typed ContextItems
      interface RawContext {
        source?: string
        content?: string
        score?: number
        metadata?: Record<string, unknown>
      }
      
      const contexts: ContextItem[] = (result.contexts || []).map((ctx: RawContext) => ({
        type: primaryType,
        source: ctx.source || 'unknown',
        content: ctx.content || '',
        score: ctx.score || 0,
        metadata: ctx.metadata
      }))
      
      return { contexts }
      
    } catch (error) {
      console.error('[RetrievalHelper] Error executing query:', error)
      return { contexts: [] }
    }
  }
  
  /**
   * Empty context fallback
   */
  private emptyContext(): RetrievedContext {
    return {
      code: [],
      documentation: [],
      prevention: [],
      totalResults: 0,
      retrievalTimeMs: 0
    }
  }
}
