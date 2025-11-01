/**
 * @fileoverview Use case for retrieving context across multiple sources
 * @module domains/retrieval/use-cases/retrieve-context-use-case
 * @author Cappy Team
 * @since 3.0.0
 */

import type { 
  RetrievedContext, 
  RetrievalOptions, 
  RetrievalResult,
  ContextSource 
} from '../types';
import type { ContentRetrieverPort } from '../ports/content-retriever-port';
import type { ScoringPort } from '../ports/scoring-port';
import type { RerankingPort } from '../ports/reranking-port';

/**
 * Use case for retrieving relevant context from multiple sources
 * 
 * This orchestrates the retrieval process:
 * 1. Validates input
 * 2. Retrieves from multiple sources in parallel
 * 3. Applies weighted scoring
 * 4. Filters by minimum score
 * 5. Re-ranks if enabled
 * 6. Returns sorted and limited results
 */
export class RetrieveContextUseCase {
  private readonly codeRetriever?: ContentRetrieverPort;
  private readonly docRetriever?: ContentRetrieverPort;
  private readonly scoringService: ScoringPort;
  private readonly rerankingService: RerankingPort;
  
  constructor(
    scoringService: ScoringPort,
    rerankingService: RerankingPort,
    codeRetriever?: ContentRetrieverPort,
    docRetriever?: ContentRetrieverPort
  ) {
    this.scoringService = scoringService;
    this.rerankingService = rerankingService;
    this.codeRetriever = codeRetriever;
    this.docRetriever = docRetriever;
  }
  
  /**
   * Executes the retrieval
   */
  async execute(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    
    console.log(`[RetrieveContextUseCase] execute() called with query: "${query}"`);
    
    // Validate input
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }
    
    // Set defaults
    const strategy = options.strategy ?? 'hybrid';
    const maxResults = options.maxResults ?? 10;
    const minScore = options.minScore ?? 0.5;
    const sources = options.sources ?? ['code', 'documentation'];
    const rerank = options.rerank ?? true;
    
    console.log(`[RetrieveContextUseCase] Options: strategy=${strategy}, maxResults=${maxResults}, minScore=${minScore}, sources=${sources.join(',')}`);
    
    // Execute retrieval based on strategy
    let allContexts: RetrievedContext[] = [];
    
    if (strategy === 'hybrid' || strategy === 'semantic' || strategy === 'keyword' || strategy === 'graph') {
      // Search all enabled sources in parallel
      const retrievalPromises: Promise<RetrievedContext[]>[] = [];
      
      if (sources.includes('code') && this.codeRetriever) {
        console.log(`[RetrieveContextUseCase] Adding code retrieval`);
        retrievalPromises.push(this.codeRetriever.retrieve(query, options));
      }
      
      if (sources.includes('documentation') && this.docRetriever) {
        console.log(`[RetrieveContextUseCase] Adding documentation retrieval`);
        retrievalPromises.push(this.docRetriever.retrieve(query, options));
      }
      
      // Execute all retrievals in parallel
      const results = await Promise.all(retrievalPromises);
      allContexts = results.flat();
      
      console.log(`[RetrieveContextUseCase] Retrieved ${allContexts.length} total contexts`);
    }
    
    // Apply weighted scoring
    console.log(`[RetrieveContextUseCase] Before weighted scoring: ${allContexts.length} contexts`);
    allContexts = this.scoringService.applyWeightedScoring(allContexts, options);
    console.log(`[RetrieveContextUseCase] After weighted scoring: ${allContexts.length} contexts`);
    
    // Filter by minimum score
    allContexts = allContexts.filter(ctx => ctx.score >= minScore);
    console.log(`[RetrieveContextUseCase] After minScore filter (${minScore}): ${allContexts.length} contexts`);
    
    // Re-rank if enabled
    if (rerank && allContexts.length > 0) {
      console.log(`[RetrieveContextUseCase] Re-ranking contexts`);
      allContexts = await this.rerankingService.rerank(query, allContexts, options);
    }
    
    // Sort by score descending
    allContexts.sort((a, b) => b.score - a.score);
    
    // Limit results
    const totalFound = allContexts.length;
    const contexts = allContexts.slice(0, maxResults);
    
    // Calculate source breakdown
    const sourceBreakdown = this.calculateSourceBreakdown(contexts);
    
    const retrievalTimeMs = Date.now() - startTime;
    
    console.log(`[RetrieveContextUseCase] Returning ${contexts.length} contexts out of ${totalFound} found`);
    
    return {
      contexts,
      metadata: {
        query,
        strategy,
        totalFound,
        returned: contexts.length,
        sourceBreakdown,
        retrievalTimeMs,
        reranked: rerank
      }
    };
  }
  
  /**
   * Calculates source breakdown
   */
  private calculateSourceBreakdown(contexts: RetrievedContext[]): Record<ContextSource, number> {
    const breakdown: Record<ContextSource, number> = {
      code: 0,
      documentation: 0,
      metadata: 0
    };
    
    for (const ctx of contexts) {
      breakdown[ctx.source]++;
    }
    
    return breakdown;
  }
}
