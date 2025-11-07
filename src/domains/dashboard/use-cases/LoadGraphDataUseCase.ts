/**
 * @fileoverview Use case for loading graph data from repository
 * @module domains/dashboard/use-cases/LoadGraphDataUseCase
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphRepository } from '../ports/GraphRepository';
import type { GraphData, GraphFilter } from '../types';

/**
 * Options for loading graph data
 */
export interface LoadGraphDataOptions {
  /**
   * Optional filter to apply at the repository level
   */
  filter?: GraphFilter;
  
  /**
   * Whether to include deleted nodes/edges
   * @default false
   */
  includeDeleted?: boolean;
  
  /**
   * Maximum number of nodes to load
   * Useful for preview or performance optimization
   */
  maxNodes?: number;
  
  /**
   * Whether to load edge data
   * @default true
   */
  includeEdges?: boolean;
}

/**
 * Result of loading graph data
 */
export interface LoadGraphDataResult {
  /**
   * The loaded graph data
   */
  data: GraphData;
  
  /**
   * Metadata about the load operation
   */
  metadata: {
    /**
     * Number of nodes loaded
     */
    nodeCount: number;
    
    /**
     * Number of edges loaded
     */
    edgeCount: number;
    
    /**
     * Time taken to load (in milliseconds)
     */
    loadTimeMs: number;
    
    /**
     * Whether the data was filtered
     */
    wasFiltered: boolean;
  };
}

/**
 * Use case for loading graph data from the repository
 * 
 * This use case encapsulates the business logic for loading graph data,
 * including filtering, validation, and performance metrics.
 * 
 * @example
 * ```typescript
 * const useCase = new LoadGraphDataUseCase(repository);
 * 
 * // Load all data
 * const result = await useCase.execute();
 * 
 * // Load with filter
 * const filtered = await useCase.execute({
 *   filter: { nodeType: 'document' }
 * });
 * ```
 */
export class LoadGraphDataUseCase {
  private repository: GraphRepository;
  
  /**
   * Creates a new LoadGraphDataUseCase
   * 
   * @param repository - Graph repository implementation
   */
  constructor(repository: GraphRepository) {
    this.repository = repository;
  }

  /**
   * Executes the use case to load graph data
   * 
   * @param options - Loading options
   * @returns Promise resolving to load result with metadata
   * @throws {Error} When loading fails or validation fails
   */
  async execute(options: LoadGraphDataOptions = {}): Promise<LoadGraphDataResult> {
    const startTime = Date.now();
    
    try {
      // Validate options
      this.validateOptions(options);
      
      // Load data from repository
      let data: GraphData;
      
      if (options.filter) {
        data = await this.repository.loadFilteredGraphData(options.filter);
      } else {
        data = await this.repository.loadGraphData();
      }
      
      // Apply post-load filtering if needed (creating new filtered data objects)
      let nodes = data.nodes;
      let edges = data.edges;
      
      if (options.includeDeleted === false) {
        nodes = nodes.filter(node => !node.metadata.isDeleted);
        edges = edges.filter(edge => !edge.metadata.isDeleted);
      }
      
      if (options.maxNodes !== undefined) {
        nodes = nodes.slice(0, options.maxNodes);
        // Remove edges that reference removed nodes
        const nodeIds = new Set(nodes.map(n => n.id));
        edges = edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
      }
      
      if (options.includeEdges === false) {
        edges = [];
      }
      
      // Create filtered data object
      data = {
        ...data,
        nodes,
        edges
      };
      
      // Validate loaded data
      this.validateLoadedData(data);
      
      const loadTimeMs = Date.now() - startTime;
      
      return {
        data,
        metadata: {
          nodeCount: data.nodes.length,
          edgeCount: data.edges.length,
          loadTimeMs,
          wasFiltered: !!options.filter || !!options.includeDeleted === false || 
                       options.maxNodes !== undefined || options.includeEdges === false
        }
      };
    } catch (error) {
      const loadTimeMs = Date.now() - startTime;
      
      throw new Error(
        `Failed to load graph data after ${loadTimeMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validates the options provided
   * 
   * @param options - Options to validate
   * @throws {Error} When validation fails
   */
  private validateOptions(options: LoadGraphDataOptions): void {
    if (options.maxNodes !== undefined) {
      if (!Number.isInteger(options.maxNodes) || options.maxNodes < 1) {
        throw new Error('maxNodes must be a positive integer');
      }
    }
  }

  /**
   * Validates the loaded graph data
   * 
   * @param data - Data to validate
   * @throws {Error} When validation fails
   */
  private validateLoadedData(data: GraphData): void {
    if (!data) {
      throw new Error('Repository returned null or undefined data');
    }
    
    if (!data.nodes || !data.edges) {
      throw new Error('Loaded data is missing nodes or edges collections');
    }
  }

}
