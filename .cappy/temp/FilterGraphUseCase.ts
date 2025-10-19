/**
 * @fileoverview Use case for filtering graph data
 * @module domains/graph/use-cases/FilterGraphUseCase
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData, GraphFilter } from '../types';

/**
 * Result of filtering graph data
 */
export interface FilterGraphResult {
  /**
   * The filtered graph data
   */
  data: GraphData;
  
  /**
   * Metadata about the filter operation
   */
  metadata: {
    /**
     * Original number of nodes before filtering
     */
    originalNodeCount: number;
    
    /**
     * Number of nodes after filtering
     */
    filteredNodeCount: number;
    
    /**
     * Original number of edges before filtering
     */
    originalEdgeCount: number;
    
    /**
     * Number of edges after filtering
     */
    filteredEdgeCount: number;
    
    /**
     * Time taken to filter (in milliseconds)
     */
    filterTimeMs: number;
    
    /**
     * Filters that were applied
     */
    appliedFilters: string[];
  };
}

/**
 * Use case for filtering graph data based on various criteria
 * 
 * This use case provides powerful filtering capabilities for graph data,
 * including filtering by node/edge types, confidence thresholds, date ranges,
 * and text search queries.
 * 
 * @example
 * ```typescript
 * const useCase = new FilterGraphUseCase();
 * 
 * // Filter by node types
 * const result = await useCase.execute(graphData, {
 *   nodeTypes: ['document', 'entity']
 * });
 * 
 * // Filter by confidence
 * const filtered = await useCase.execute(graphData, {
 *   minConfidence: 0.8
 * });
 * ```
 */
export class FilterGraphUseCase {
  /**
   * Executes the use case to filter graph data
   * 
   * @param data - Original graph data
   * @param filter - Filter criteria
   * @returns Promise resolving to filter result with metadata
   * @throws {Error} When filtering fails or validation fails
   */
  async execute(data: GraphData, filter: GraphFilter): Promise<FilterGraphResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateInput(data, filter);
      
      const originalNodeCount = data.nodes.length;
      const originalEdgeCount = data.edges.length;
      const appliedFilters: string[] = [];
      
      // Apply filters sequentially
      let nodes = [...data.nodes];
      let edges = [...data.edges];
      
      // Filter by node types
      if (filter.nodeTypes && filter.nodeTypes.length > 0) {
        nodes = nodes.filter(node => filter.nodeTypes!.includes(node.type));
        appliedFilters.push(`nodeTypes: ${filter.nodeTypes.join(', ')}`);
      }
      
      // Filter by minimum confidence
      if (filter.minConfidence !== undefined) {
        nodes = nodes.filter(node => node.confidence >= filter.minConfidence!);
        edges = edges.filter(edge => edge.confidence >= filter.minConfidence!);
        appliedFilters.push(`minConfidence: ${filter.minConfidence}`);
      }
      
      // Filter by date range
      if (filter.dateRange) {
        const { start, end } = filter.dateRange;
        nodes = nodes.filter(node => 
          node.created >= start && node.created <= end
        );
        edges = edges.filter(edge => 
          edge.created >= start && edge.created <= end
        );
        appliedFilters.push(`dateRange: ${start} to ${end}`);
      }
      
      // Filter by search query
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        nodes = nodes.filter(node => 
          node.label.toLowerCase().includes(query) ||
          node.id.toLowerCase().includes(query)
        );
        appliedFilters.push(`searchQuery: "${filter.searchQuery}"`);
      }
      
      // Filter by minimum connections
      if (filter.minConnections !== undefined) {
        nodes = nodes.filter(node => 
          node.connections.total >= filter.minConnections!
        );
        appliedFilters.push(`minConnections: ${filter.minConnections}`);
      }
      
      // Remove orphaned edges (edges whose nodes were filtered out)
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
      
      // Filter by edge types
      if (filter.edgeTypes && filter.edgeTypes.length > 0) {
        edges = edges.filter(edge => filter.edgeTypes!.includes(edge.type));
        appliedFilters.push(`edgeTypes: ${filter.edgeTypes.join(', ')}`);
      }
      
      // Create filtered data object
      const filteredData: GraphData = {
        ...data,
        nodes,
        edges
      };
      
      const filterTimeMs = Date.now() - startTime;
      
      return {
        data: filteredData,
        metadata: {
          originalNodeCount,
          filteredNodeCount: nodes.length,
          originalEdgeCount,
          filteredEdgeCount: edges.length,
          filterTimeMs,
          appliedFilters
        }
      };
    } catch (error) {
      const filterTimeMs = Date.now() - startTime;
      
      throw new Error(
        `Failed to filter graph data after ${filterTimeMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validates the input data and filter
   * 
   * @param data - Graph data to validate
   * @param filter - Filter to validate
   * @throws {Error} When validation fails
   */
  private validateInput(data: GraphData, filter: GraphFilter): void {
    if (!data) {
      throw new Error('Graph data is required');
    }
    
    if (!data.nodes || !data.edges) {
      throw new Error('Graph data must contain nodes and edges arrays');
    }
    
    if (!filter) {
      throw new Error('Filter criteria is required');
    }
    
    // Validate minConfidence range
    if (filter.minConfidence !== undefined) {
      if (filter.minConfidence < 0 || filter.minConfidence > 1) {
        throw new Error('minConfidence must be between 0 and 1');
      }
    }
    
    // Validate minConnections
    if (filter.minConnections !== undefined) {
      if (!Number.isInteger(filter.minConnections) || filter.minConnections < 0) {
        throw new Error('minConnections must be a non-negative integer');
      }
    }
    
    // Validate date range
    if (filter.dateRange) {
      const { start, end } = filter.dateRange;
      if (start > end) {
        throw new Error('Date range start must be before end');
      }
    }
  }
}
