/**
 * @fileoverview Hybrid Retriever - Thin wrapper for context retrieval using hexagonal architecture
 * @module services/hybrid-retriever
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData } from '../../../domains/dashboard/types';
import type { GraphStorePort } from '../../../domains/dashboard/ports/indexing-port';
import { RetrieveContextUseCase } from '../../../domains/retrieval/use-cases';
import { GraphContentAdapter, DocContentAdapter, ScoringAdapter, RerankingAdapter } from '../adapters/retrieval';

// Re-export types from domain for backward compatibility
export type { 
  ContextSource, 
  RetrievedContext, 
  RetrievalStrategy,
  RetrievalOptions as HybridRetrieverOptions,
  RetrievalResult as HybridRetrieverResult
} from '../../../domains/retrieval/types';

/**
 * Hybrid Retriever - Thin wrapper combining multiple retrieval strategies (Hexagonal Architecture)
 * 
 * This retriever intelligently searches across:
 * - Code graph (semantic + structural relationships)
 * - Documentation index (markdown files, guides)
 * 
 * Architecture:
 * - Uses domain use cases and ports/adapters pattern
 * - Injects dependencies for content retrieval, scoring, and re-ranking
 * - Delegates all business logic to RetrieveContextUseCase
 * 
 * @example
 * ```typescript
 * const retriever = new HybridRetriever(graphData, graphStore);
 * 
 * // Basic retrieval
 * const result = await retriever.retrieve('JWT authentication');
 * 
 * // Advanced retrieval with custom weights
 * const advanced = await retriever.retrieve('database migration', {
 *   strategy: 'hybrid',
 *   maxResults: 20,
 *   codeWeight: 0.5,
 *   docWeight: 0.3,
 *   category: 'database'
 * });
 * ```
 */
export class HybridRetriever {
  public readonly useCase: RetrieveContextUseCase;
  private graphContentAdapter: GraphContentAdapter;
  
  constructor(
    graphData?: GraphData, 
    graphStore?: GraphStorePort
  ) {
    console.log(`[HybridRetriever] Constructor: graphData=${!!graphData}, graphStore=${!!graphStore}`);
    
    // Create adapters
    this.graphContentAdapter = new GraphContentAdapter(graphStore, graphData);
    const docAdapter = new DocContentAdapter(this.graphContentAdapter);
    const scoringAdapter = new ScoringAdapter();
    const rerankingAdapter = new RerankingAdapter();
    
    // Create use case with injected dependencies
    this.useCase = new RetrieveContextUseCase(
      scoringAdapter,
      rerankingAdapter,
      this.graphContentAdapter,
      docAdapter
    );
  }
  
  /**
   * Sets or updates the graph data
   * @deprecated Use constructor injection instead
   */
  setGraphData(graphData: GraphData): void {
    console.warn('[HybridRetriever] setGraphData is deprecated - recreate instance instead');
    // Recreate adapters with new graph data
    this.graphContentAdapter = new GraphContentAdapter(undefined, graphData);
  }
  
  /**
   * Retrieves relevant context for a query
   * 
   * @param query - Search query
   * @param options - Retrieval options
   * @returns Promise resolving to retrieval result
   * @throws {Error} When retrieval fails
   */
  async retrieve(
    query: string,
    options: import('../../../domains/retrieval/types').RetrievalOptions = {}
  ): Promise<import('../../../domains/retrieval/types').RetrievalResult> {
    console.log(`[HybridRetriever] retrieve() delegating to use case with query: "${query}"`);
    
    try {
      return await this.useCase.execute(query, options);
    } catch (error) {
      throw new Error(`Hybrid retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
