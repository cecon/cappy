/**
 * @fileoverview Graph Service - Main service for graph operations
 * @module services/graph-service
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphRepository } from '../domains/graph/ports/GraphRepository';
import type { GraphData, GraphFilter } from '../domains/graph/types';
import {
  LoadGraphDataUseCase,
  type LoadGraphDataOptions,
  type LoadGraphDataResult,
  FilterGraphUseCase,
  type FilterGraphResult,
  ExpandNodeUseCase,
  type ExpandNodeOptions,
  type ExpandNodeResult,
  CalculateMetricsUseCase,
  type CalculateMetricsOptions,
  type CalculateMetricsResult,
  SearchGraphUseCase,
  type SearchGraphOptions,
  type SearchGraphResult,
  ExportGraphUseCase,
  type ExportGraphOptions,
  type ExportGraphResult
} from '../domains/graph/use-cases';

/**
 * Graph Service configuration
 */
export interface GraphServiceConfig {
  /**
   * Graph repository implementation
   */
  repository: GraphRepository;
}

/**
 * Main service for graph operations
 * 
 * This service orchestrates all graph use cases and provides a unified
 * API for the presentation layer.
 * 
 * @example
 * ```typescript
 * const graphService = new GraphService({
 *   repository: lanceDBGraphRepository
 * });
 * 
 * // Load graph data
 * const result = await graphService.loadGraph();
 * 
 * // Search graph
 * const searchResults = await graphService.search('authentication');
 * 
 * // Export graph
 * const exported = await graphService.export({ format: 'json' });
 * ```
 */
export class GraphService {
  private repository: GraphRepository;
  private loadUseCase: LoadGraphDataUseCase;
  private filterUseCase: FilterGraphUseCase;
  private expandUseCase: ExpandNodeUseCase;
  private metricsUseCase: CalculateMetricsUseCase;
  private searchUseCase: SearchGraphUseCase;
  private exportUseCase: ExportGraphUseCase;

  constructor(config: GraphServiceConfig) {
    this.repository = config.repository;
    
    // Initialize use cases
    this.loadUseCase = new LoadGraphDataUseCase(this.repository);
    this.filterUseCase = new FilterGraphUseCase();
    this.expandUseCase = new ExpandNodeUseCase();
    this.metricsUseCase = new CalculateMetricsUseCase();
    this.searchUseCase = new SearchGraphUseCase();
    this.exportUseCase = new ExportGraphUseCase();
  }

  /**
   * Loads graph data from repository
   * 
   * @param options - Loading options
   * @returns Promise resolving to load result
   */
  async loadGraph(options?: LoadGraphDataOptions): Promise<LoadGraphDataResult> {
    return await this.loadUseCase.execute(options);
  }

  /**
   * Filters graph data
   * 
   * @param data - Graph data to filter
   * @param filter - Filter criteria
   * @returns Promise resolving to filter result
   */
  async filterGraph(data: GraphData, filter: GraphFilter): Promise<FilterGraphResult> {
    return await this.filterUseCase.execute(data, filter);
  }

  /**
   * Expands a node's neighborhood
   * 
   * @param data - Graph data
   * @param nodeId - Node ID to expand
   * @param options - Expansion options
   * @returns Promise resolving to expansion result
   */
  async expandNode(
    data: GraphData,
    nodeId: string,
    options?: ExpandNodeOptions
  ): Promise<ExpandNodeResult> {
    return await this.expandUseCase.execute(data, nodeId, options);
  }

  /**
   * Calculates graph metrics
   * 
   * @param data - Graph data
   * @param options - Calculation options
   * @returns Promise resolving to metrics result
   */
  async calculateMetrics(
    data: GraphData,
    options?: CalculateMetricsOptions
  ): Promise<CalculateMetricsResult> {
    return await this.metricsUseCase.execute(data, options);
  }

  /**
   * Searches graph data
   * 
   * @param data - Graph data
   * @param query - Search query
   * @param options - Search options
   * @returns Promise resolving to search result
   */
  async search(
    data: GraphData,
    query: string,
    options?: SearchGraphOptions
  ): Promise<SearchGraphResult> {
    return await this.searchUseCase.execute(data, query, options);
  }

  /**
   * Exports graph data to specified format
   * 
   * @param data - Graph data to export
   * @param options - Export options
   * @returns Promise resolving to export result
   */
  async export(
    data: GraphData,
    options?: ExportGraphOptions
  ): Promise<ExportGraphResult> {
    return await this.exportUseCase.execute(data, options);
  }

  /**
   * Gets graph statistics
   * 
   * @returns Promise resolving to statistics
   */
  async getStatistics() {
    return await this.repository.getGraphStatistics();
  }

  /**
   * Checks if repository is available
   * 
   * @returns Promise resolving to availability status
   */
  async isAvailable(): Promise<boolean> {
    return await this.repository.isAvailable();
  }

  /**
   * Refreshes the graph data source
   * 
   * @returns Promise resolving when refresh is complete
   */
  async refresh(): Promise<void> {
    await this.repository.refresh();
  }

  /**
   * Loads and processes graph with common workflow
   * 
   * This is a convenience method that:
   * 1. Loads the graph
   * 2. Optionally filters it
   * 3. Optionally calculates metrics
   * 
   * @param options - Loading options
   * @param filter - Optional filter
   * @param calculateMetrics - Whether to calculate metrics
   * @returns Promise resolving to processed graph data
   */
  async loadAndProcess(
    options?: LoadGraphDataOptions,
    filter?: GraphFilter,
    calculateMetrics = true
  ): Promise<GraphData> {
    // Load graph
    const loadResult = await this.loadGraph(options);
    let data = loadResult.data;

    // Apply filter if provided
    if (filter) {
      const filterResult = await this.filterGraph(data, filter);
      data = filterResult.data;
    }

    // Calculate metrics if requested
    if (calculateMetrics) {
      const metricsResult = await this.calculateMetrics(data);
      data = metricsResult.data;
    }

    return data;
  }

  /**
   * Searches and expands results
   * 
   * This is a convenience method that:
   * 1. Searches the graph
   * 2. Automatically returns expanded subgraph
   * 
   * @param data - Graph data
   * @param query - Search query
   * @param options - Search options
   * @returns Promise resolving to search result with expanded subgraph
   */
  async searchAndExpand(
    data: GraphData,
    query: string,
    options?: SearchGraphOptions
  ): Promise<SearchGraphResult> {
    return await this.search(data, query, {
      ...options,
      includeRelated: true,
      relatedDepth: options?.relatedDepth ?? 1
    });
  }
}

/**
 * Factory function to create GraphService
 */
export function createGraphService(config: GraphServiceConfig): GraphService {
  return new GraphService(config);
}
