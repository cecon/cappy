/**
 * @fileoverview Port for content retrieval from different sources
 * @module domains/retrieval/ports/content-retriever-port
 * @author Cappy Team
 * @since 3.0.0
 */

import type { RetrievedContext, RetrievalOptions } from '../types';

/**
 * Port for retrieving content from a specific source
 */
export interface ContentRetrieverPort {
  /**
   * Retrieves contexts from this source
   * 
   * @param query - Search query
   * @param options - Retrieval options
   * @returns Promise resolving to array of retrieved contexts
   */
  retrieve(
    query: string,
    options: RetrievalOptions
  ): Promise<RetrievedContext[]>;
  
  /**
   * Gets the source type this retriever handles
   */
  getSourceType(): 'code' | 'documentation' | 'metadata';
}
