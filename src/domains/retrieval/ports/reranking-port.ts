/**
 * @fileoverview Port for re-ranking contexts based on advanced signals
 * @module domains/retrieval/ports/reranking-port
 * @author Cappy Team
 * @since 3.0.0
 */

import type { RetrievedContext, RetrievalOptions } from '../types';

/**
 * Port for re-ranking contexts using advanced algorithms
 */
export interface RerankingPort {
  /**
   * Re-ranks contexts based on query relevance and other signals
   * 
   * @param query - Original search query
   * @param contexts - Contexts to re-rank
   * @param options - Retrieval options
   * @returns Re-ranked contexts with adjusted scores
   */
  rerank(
    query: string,
    contexts: RetrievedContext[],
    options: RetrievalOptions
  ): Promise<RetrievedContext[]>;
}
