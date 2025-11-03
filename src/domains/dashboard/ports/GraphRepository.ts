/**
 * @fileoverview Graph Repository port - Interface for graph data persistence
 * @module domains/dashboard/ports/GraphRepository
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData, GraphFilter, GraphStatistics } from '../types';

/**
 * Repository interface for graph data persistence and retrieval
 * 
 * This port defines the contract for accessing graph data from external
 * data sources like LanceDB, file systems, or remote APIs.
 * 
 * @example
 * ```typescript
 * class LanceDbGraphRepository implements GraphRepository {
 *   async loadGraphData(): Promise<GraphData> {
 *     // Implementation for LanceDB
 *   }
 * }
 * ```
 */
export interface GraphRepository {
  /**
   * Loads the complete graph data
   * 
   * @returns Promise resolving to graph data
   * @throws {Error} When data loading fails
   */
  loadGraphData(): Promise<GraphData>;

  /**
   * Loads graph data with filtering applied at the data source level
   * 
   * @param filter - Filter criteria
   * @returns Promise resolving to filtered graph data
   * @throws {Error} When data loading fails
   */
  loadFilteredGraphData(filter: GraphFilter): Promise<GraphData>;

  /**
   * Saves graph data to the data source
   * 
   * @param graphData - Graph data to save
   * @returns Promise resolving when save is complete
   * @throws {Error} When saving fails
   */
  saveGraphData(graphData: GraphData): Promise<void>;

  /**
   * Gets graph statistics without loading full data
   * 
   * @returns Promise resolving to graph statistics
   * @throws {Error} When statistics retrieval fails
   */
  getGraphStatistics(): Promise<GraphStatistics>;

  /**
   * Checks if the data source is available and accessible
   * 
   * @returns Promise resolving to true if available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Refreshes/reindexes the data source
   * 
   * @returns Promise resolving when refresh is complete
   * @throws {Error} When refresh fails
   */
  refresh(): Promise<void>;
}

/**
 * Factory interface for creating GraphRepository instances
 */
export interface GraphRepositoryFactory {
  /**
   * Creates a new GraphRepository instance
   * 
   * @param config - Repository configuration
   * @returns GraphRepository instance
   */
  create(config?: unknown): GraphRepository;
}