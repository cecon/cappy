/**
 * @fileoverview Types for retrieval domain
 * @module domains/retrieval/types
 * @author Cappy Team
 * @since 3.0.0
 */

/**
 * Source of retrieved context
 */
export type ContextSource = 
  | 'code'           // From code graph (database)
  | 'documentation'  // From documentation chunks (database)
  | 'metadata';      // From file metadata

/**
 * Retrieval strategy
 */
export type RetrievalStrategy = 
  | 'hybrid'      // Combines all strategies with weighted scoring
  | 'semantic'    // Semantic similarity only
  | 'keyword'     // Keyword matching only
  | 'graph'       // Graph-based traversal
  | 'vector';     // Vector similarity (if available)

/**
 * Retrieved context item
 */
export interface RetrievedContext {
  /**
   * Unique identifier
   */
  id: string;
  
  /**
   * Content of the context
   */
  content: string;
  
  /**
   * Source type
   */
  source: ContextSource;
  
  /**
   * Relevance score (0-1)
   */
  score: number;
  
  /**
   * File path (if applicable)
   */
  filePath?: string;
  
  /**
   * Metadata about the context
   */
  metadata: {
    title?: string;
    category?: string;
    keywords?: string[];
    type?: string;
    lastModified?: string;
    lineStart?: number;
    lineEnd?: number;
    chunkType?: string;
    language?: string;
  };
  
  /**
   * Snippet highlighting the match
   */
  snippet?: string;
}

/**
 * Options for hybrid retrieval
 */
export interface RetrievalOptions {
  /**
   * Retrieval strategy
   * @default 'hybrid'
   */
  strategy?: RetrievalStrategy;
  
  /**
   * Maximum number of results
   * @default 10
   */
  maxResults?: number;
  
  /**
   * Minimum relevance score (0-1)
   * @default 0.5
   */
  minScore?: number;
  
  /**
   * Sources to search in
   * @default ['code', 'documentation', 'prevention']
   */
  sources?: ContextSource[];
  
  /**
   * Weight for code results (0-1)
   * @default 0.4
   */
  codeWeight?: number;
  
  /**
   * Weight for documentation results (0-1)
   * @default 0.3
   */
  docWeight?: number;
  
  /**
   * Weight for prevention rules (0-1)
   * @default 0.2
   */
  preventionWeight?: number;
  
  /**
   * Weight for tasks (0-1)
   * @default 0.1
   */
  taskWeight?: number;
  
  /**
   * Enable re-ranking
   * @default true
   */
  rerank?: boolean;
  
  /**
   * Include related context
   * @default true
   */
  includeRelated?: boolean;
  
  /**
   * Filter by category
   */
  category?: string;
  
  /**
   * Filter by file types
   */
  fileTypes?: string[];
}

/**
 * Result of hybrid retrieval
 */
export interface RetrievalResult {
  /**
   * Retrieved contexts, sorted by relevance
   */
  contexts: RetrievedContext[];
  
  /**
   * Metadata about the retrieval
   */
  metadata: {
    /**
     * Query that was executed
     */
    query: string;
    
    /**
     * Strategy used
     */
    strategy: RetrievalStrategy;
    
    /**
     * Total contexts found (before limiting)
     */
    totalFound: number;
    
    /**
     * Number of contexts returned
     */
    returned: number;
    
    /**
     * Breakdown by source
     */
    sourceBreakdown: Record<ContextSource, number>;
    
    /**
     * Time taken (in milliseconds)
     */
    retrievalTimeMs: number;
    
    /**
     * Whether results were re-ranked
     */
    reranked: boolean;
  };
}

/**
 * Source weight configuration
 */
export interface SourceWeights {
  code: number;
  documentation: number;
  prevention: number;
  task: number;
  metadata: number;
}
