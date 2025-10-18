/**
 * @fileoverview Use case for searching graph data
 * @module domains/graph/use-cases/SearchGraphUseCase
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData, GraphNode, GraphEdge, GraphFilter } from '../types';

/**
 * Search mode
 */
export type SearchMode = 
  | 'fuzzy'      // Fuzzy text matching
  | 'exact'      // Exact text matching
  | 'regex'      // Regular expression matching
  | 'semantic';  // Semantic similarity (requires external service)

/**
 * Options for searching graph data
 */
export interface SearchGraphOptions {
  /**
   * Search mode
   * @default 'fuzzy'
   */
  mode?: SearchMode;
  
  /**
   * Search in node labels
   * @default true
   */
  searchLabels?: boolean;
  
  /**
   * Search in node IDs
   * @default true
   */
  searchIds?: boolean;
  
  /**
   * Search in node metadata
   * @default true
   */
  searchMetadata?: boolean;
  
  /**
   * Search in edge labels
   * @default false
   */
  searchEdges?: boolean;
  
  /**
   * Minimum match score (0-1)
   * @default 0.3
   */
  minScore?: number;
  
  /**
   * Maximum number of results
   * @default 50
   */
  maxResults?: number;
  
  /**
   * Additional filters to apply after search
   */
  filters?: GraphFilter;
  
  /**
   * Case sensitive search
   * @default false
   */
  caseSensitive?: boolean;
  
  /**
   * Include related nodes in results
   * @default false
   */
  includeRelated?: boolean;
  
  /**
   * Depth for related nodes (if includeRelated is true)
   * @default 1
   */
  relatedDepth?: number;
}

/**
 * Search result item
 */
export interface SearchResultItem {
  /**
   * The matched node or edge
   */
  item: GraphNode | GraphEdge;
  
  /**
   * Type of item
   */
  type: 'node' | 'edge';
  
  /**
   * Match score (0-1)
   */
  score: number;
  
  /**
   * Where the match was found
   */
  matchLocation: 'label' | 'id' | 'metadata' | 'edge';
  
  /**
   * Matched text snippet
   */
  snippet?: string;
}

/**
 * Result of searching graph data
 */
export interface SearchGraphResult {
  /**
   * Search results
   */
  results: SearchResultItem[];
  
  /**
   * Subgraph containing matched nodes and their relationships
   */
  subgraph?: GraphData;
  
  /**
   * Metadata about the search
   */
  metadata: {
    /**
     * Query that was executed
     */
    query: string;
    
    /**
     * Total matches found (before limiting)
     */
    totalMatches: number;
    
    /**
     * Number of results returned
     */
    resultCount: number;
    
    /**
     * Search mode used
     */
    mode: SearchMode;
    
    /**
     * Time taken to search (in milliseconds)
     */
    searchTimeMs: number;
    
    /**
     * Whether results were truncated
     */
    truncated: boolean;
  };
}

/**
 * Use case for searching graph data using various strategies
 * 
 * This use case provides flexible search capabilities including:
 * - Fuzzy text matching (default)
 * - Exact text matching
 * - Regular expression matching
 * - Semantic search (requires external embedding service)
 * 
 * @example
 * ```typescript
 * const useCase = new SearchGraphUseCase();
 * 
 * // Fuzzy search
 * const result = await useCase.execute(graphData, 'user authentication');
 * 
 * // Exact search with filters
 * const exact = await useCase.execute(graphData, 'getUserById', {
 *   mode: 'exact',
 *   filters: { nodeTypes: ['function'] }
 * });
 * 
 * // Search with related nodes
 * const withRelated = await useCase.execute(graphData, 'database', {
 *   includeRelated: true,
 *   relatedDepth: 2
 * });
 * ```
 */
export class SearchGraphUseCase {
  /**
   * Executes the use case to search graph data
   * 
   * @param data - Graph data to search
   * @param query - Search query
   * @param options - Search options
   * @returns Promise resolving to search results
   * @throws {Error} When search fails or validation fails
   */
  async execute(
    data: GraphData,
    query: string,
    options: SearchGraphOptions = {}
  ): Promise<SearchGraphResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateInput(data, query, options);
      
      // Set defaults
      const mode = options.mode ?? 'fuzzy';
      const searchLabels = options.searchLabels ?? true;
      const searchIds = options.searchIds ?? true;
      const searchMetadata = options.searchMetadata ?? true;
      const searchEdges = options.searchEdges ?? false;
      const minScore = options.minScore ?? 0.3;
      const maxResults = options.maxResults ?? 50;
      const caseSensitive = options.caseSensitive ?? false;
      const includeRelated = options.includeRelated ?? false;
      
      // Prepare query
      const preparedQuery = caseSensitive ? query : query.toLowerCase();
      
      // Search nodes
      const nodeResults: SearchResultItem[] = [];
      
      for (const node of data.nodes) {
        const matches = this.searchNode(
          node,
          preparedQuery,
          mode,
          { searchLabels, searchIds, searchMetadata, caseSensitive }
        );
        
        for (const match of matches) {
          if (match.score >= minScore) {
            nodeResults.push(match);
          }
        }
      }
      
      // Search edges (if enabled)
      const edgeResults: SearchResultItem[] = [];
      
      if (searchEdges) {
        for (const edge of data.edges) {
          const matches = this.searchEdge(
            edge,
            preparedQuery,
            mode,
            { caseSensitive }
          );
          
          for (const match of matches) {
            if (match.score >= minScore) {
              edgeResults.push(match);
            }
          }
        }
      }
      
      // Combine and sort results by score
      let allResults = [...nodeResults, ...edgeResults].sort((a, b) => b.score - a.score);
      
      const totalMatches = allResults.length;
      const truncated = allResults.length > maxResults;
      
      // Limit results
      allResults = allResults.slice(0, maxResults);
      
      // Apply additional filters if provided
      if (options.filters) {
        allResults = this.applyFilters(allResults, options.filters);
      }
      
      // Build subgraph if includeRelated is true
      let subgraph: GraphData | undefined;
      
      if (includeRelated && allResults.length > 0) {
        subgraph = this.buildSubgraph(
          data,
          allResults,
          options.relatedDepth ?? 1
        );
      }
      
      const searchTimeMs = Date.now() - startTime;
      
      return {
        results: allResults,
        subgraph,
        metadata: {
          query,
          totalMatches,
          resultCount: allResults.length,
          mode,
          searchTimeMs,
          truncated
        }
      };
    } catch (error) {
      const searchTimeMs = Date.now() - startTime;
      
      throw new Error(
        `Failed to search graph after ${searchTimeMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Searches a single node for matches
   * 
   * @param node - Node to search
   * @param query - Search query (already prepared)
   * @param mode - Search mode
   * @param options - Search options
   * @returns Array of matches
   */
  private searchNode(
    node: GraphNode,
    query: string,
    mode: SearchMode,
    options: {
      searchLabels: boolean;
      searchIds: boolean;
      searchMetadata: boolean;
      caseSensitive: boolean;
    }
  ): SearchResultItem[] {
    const matches: SearchResultItem[] = [];
    
    // Search in label
    if (options.searchLabels) {
      const label = options.caseSensitive ? node.label : node.label.toLowerCase();
      const score = this.calculateMatchScore(label, query, mode);
      
      if (score > 0) {
        matches.push({
          item: node,
          type: 'node',
          score,
          matchLocation: 'label',
          snippet: node.label
        });
      }
    }
    
    // Search in ID
    if (options.searchIds) {
      const id = options.caseSensitive ? node.id : node.id.toLowerCase();
      const score = this.calculateMatchScore(id, query, mode);
      
      if (score > 0) {
        matches.push({
          item: node,
          type: 'node',
          score,
          matchLocation: 'id',
          snippet: node.id
        });
      }
    }
    
    // Search in metadata
    if (options.searchMetadata) {
      const metadataString = JSON.stringify(node.metadata);
      const metadata = options.caseSensitive ? metadataString : metadataString.toLowerCase();
      const score = this.calculateMatchScore(metadata, query, mode);
      
      if (score > 0) {
        matches.push({
          item: node,
          type: 'node',
          score: score * 0.8, // Lower score for metadata matches
          matchLocation: 'metadata',
          snippet: this.extractSnippet(metadataString, query, 100)
        });
      }
    }
    
    return matches;
  }

  /**
   * Searches a single edge for matches
   * 
   * @param edge - Edge to search
   * @param query - Search query (already prepared)
   * @param mode - Search mode
   * @param options - Search options
   * @returns Array of matches
   */
  private searchEdge(
    edge: GraphEdge,
    query: string,
    mode: SearchMode,
    options: { caseSensitive: boolean }
  ): SearchResultItem[] {
    const matches: SearchResultItem[] = [];
    
    const label = options.caseSensitive ? edge.label : edge.label.toLowerCase();
    const score = this.calculateMatchScore(label, query, mode);
    
    if (score > 0) {
      matches.push({
        item: edge,
        type: 'edge',
        score: score * 0.7, // Lower score for edge matches
        matchLocation: 'edge',
        snippet: edge.label
      });
    }
    
    return matches;
  }

  /**
   * Calculates match score based on search mode
   * 
   * @param text - Text to search in
   * @param query - Search query
   * @param mode - Search mode
   * @returns Match score (0-1)
   */
  private calculateMatchScore(text: string, query: string, mode: SearchMode): number {
    switch (mode) {
      case 'exact':
        return text === query ? 1.0 : text.includes(query) ? 0.8 : 0;
      
      case 'regex':
        try {
          const regex = new RegExp(query, 'i');
          return regex.test(text) ? 0.9 : 0;
        } catch {
          return 0;
        }
      
      case 'fuzzy':
        return this.calculateFuzzyScore(text, query);
      
      case 'semantic':
        // Semantic search would require an external embedding service
        // For now, fall back to fuzzy search
        return this.calculateFuzzyScore(text, query);
      
      default:
        return 0;
    }
  }

  /**
   * Calculates fuzzy match score using Levenshtein distance
   * 
   * @param text - Text to search in
   * @param query - Search query
   * @returns Match score (0-1)
   */
  private calculateFuzzyScore(text: string, query: string): number {
    // Check for substring match first (high score)
    if (text.includes(query)) {
      return 0.9;
    }
    
    // Check for word boundary matches
    const words = text.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(query)) {
        return 0.7;
      }
      if (word.includes(query)) {
        return 0.6;
      }
    }
    
    // Calculate Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(text.substring(0, query.length * 2), query);
    const maxLength = Math.max(text.length, query.length);
    const similarity = 1 - (distance / maxLength);
    
    return Math.max(0, similarity - 0.3); // Threshold at 0.3
  }

  /**
   * Calculates Levenshtein distance between two strings
   * 
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }

  /**
   * Extracts a snippet around the match
   * 
   * @param text - Full text
   * @param query - Search query
   * @param maxLength - Maximum snippet length
   * @returns Snippet
   */
  private extractSnippet(text: string, query: string, maxLength: number): string {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    
    if (index === -1) {
      return text.substring(0, maxLength);
    }
    
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + query.length + 30);
    
    let snippet = text.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet;
  }

  /**
   * Applies additional filters to search results
   * 
   * @param results - Search results
   * @param filters - Filters to apply
   * @returns Filtered results
   */
  private applyFilters(
    results: SearchResultItem[],
    filters: GraphFilter
  ): SearchResultItem[] {
    return results.filter(result => {
      if (result.type === 'node') {
        const node = result.item as GraphNode;
        
        if (filters.nodeTypes && !filters.nodeTypes.includes(node.type)) {
          return false;
        }
        
        if (filters.minConfidence && node.confidence < filters.minConfidence) {
          return false;
        }
        
        if (filters.minConnections && node.connections.total < filters.minConnections) {
          return false;
        }
      } else {
        const edge = result.item as GraphEdge;
        
        if (filters.edgeTypes && !filters.edgeTypes.includes(edge.type)) {
          return false;
        }
        
        if (filters.minConfidence && edge.confidence < filters.minConfidence) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Builds a subgraph from search results including related nodes
   * 
   * @param data - Original graph data
   * @param results - Search results
   * @param depth - Depth to expand
   * @returns Subgraph
   */
  private buildSubgraph(
    data: GraphData,
    results: SearchResultItem[],
    depth: number
  ): GraphData {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    
    // Add matched nodes
    for (const result of results) {
      if (result.type === 'node') {
        nodeIds.add((result.item as GraphNode).id);
      } else {
        const edge = result.item as GraphEdge;
        edgeIds.add(edge.id);
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
    }
    
    // Expand to related nodes
    for (let d = 0; d < depth; d++) {
      const currentNodes = Array.from(nodeIds);
      
      for (const nodeId of currentNodes) {
        // Find connected edges
        for (const edge of data.edges) {
          if (edge.source === nodeId || edge.target === nodeId) {
            edgeIds.add(edge.id);
            nodeIds.add(edge.source);
            nodeIds.add(edge.target);
          }
        }
      }
    }
    
    // Build subgraph
    const nodes = data.nodes.filter(node => nodeIds.has(node.id));
    const edges = data.edges.filter(edge => edgeIds.has(edge.id));
    
    return {
      nodes,
      edges,
      statistics: data.statistics,
      lastUpdated: data.lastUpdated
    };
  }

  /**
   * Validates the input parameters
   * 
   * @param data - Graph data to validate
   * @param query - Query to validate
   * @param options - Options to validate
   * @throws {Error} When validation fails
   */
  private validateInput(
    data: GraphData,
    query: string,
    options: SearchGraphOptions
  ): void {
    if (!data) {
      throw new Error('Graph data is required');
    }
    
    if (!data.nodes || !data.edges) {
      throw new Error('Graph data must contain nodes and edges arrays');
    }
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Valid search query is required');
    }
    
    if (options.minScore !== undefined) {
      if (options.minScore < 0 || options.minScore > 1) {
        throw new Error('Min score must be between 0 and 1');
      }
    }
    
    if (options.maxResults !== undefined) {
      if (!Number.isInteger(options.maxResults) || options.maxResults < 1) {
        throw new Error('Max results must be a positive integer');
      }
    }
    
    if (options.relatedDepth !== undefined) {
      if (!Number.isInteger(options.relatedDepth) || options.relatedDepth < 1) {
        throw new Error('Related depth must be a positive integer');
      }
    }
  }
}
