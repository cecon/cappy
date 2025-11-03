/**
 * @fileoverview Graph Analytics Service port - Interface for graph algorithms and metrics
 * @module domains/dashboard/ports/GraphAnalyticsService
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData, CalculatedMetrics } from '../types';

/**
 * Clustering result for graph community detection
 */
export interface ClusteringResult {
  /** Clusters with node IDs */
  clusters: string[][];
  /** Modularity score of the clustering */
  modularity: number;
  /** Algorithm used for clustering */
  algorithm: string;
  /** Cluster assignments for each node */
  nodeClusterMap: Map<string, number>;
}

/**
 * Path finding result between two nodes
 */
export interface PathResult {
  /** Ordered array of node IDs forming the path */
  path: string[];
  /** Total path length/cost */
  length: number;
  /** Whether a path was found */
  found: boolean;
  /** Algorithm used for path finding */
  algorithm: string;
}

/**
 * Graph centrality metrics
 */
export interface CentralityMetrics {
  /** PageRank scores for all nodes */
  pageRank: Map<string, number>;
  /** Betweenness centrality scores */
  betweenness: Map<string, number>;
  /** Closeness centrality scores */
  closeness: Map<string, number>;
  /** Degree centrality scores */
  degree: Map<string, number>;
  /** Eigenvector centrality scores */
  eigenvector: Map<string, number>;
}

/**
 * Service interface for graph analytics and algorithms
 * 
 * This port defines the contract for performing graph analysis,
 * calculating metrics, and running graph algorithms.
 * 
 * @example
 * ```typescript
 * class NetworkXGraphAnalyticsService implements GraphAnalyticsService {
 *   async calculatePageRank(graphData): Promise<Map<string, number>> {
 *     // NetworkX implementation
 *   }
 * }
 * ```
 */
export interface GraphAnalyticsService {
  /**
   * Calculates PageRank scores for all nodes
   * 
   * @param graphData - Graph data
   * @param dampingFactor - Damping factor (default 0.85)
   * @param maxIterations - Maximum iterations (default 100)
   * @returns Promise resolving to PageRank scores
   */
  calculatePageRank(
    graphData: GraphData,
    dampingFactor?: number,
    maxIterations?: number
  ): Promise<Map<string, number>>;

  /**
   * Calculates all centrality metrics for the graph
   * 
   * @param graphData - Graph data
   * @returns Promise resolving to centrality metrics
   */
  calculateCentralityMetrics(graphData: GraphData): Promise<CentralityMetrics>;

  /**
   * Detects communities/clusters in the graph
   * 
   * @param graphData - Graph data
   * @param algorithm - Clustering algorithm ('louvain', 'leiden', 'modularity')
   * @returns Promise resolving to clustering result
   */
  detectCommunities(
    graphData: GraphData,
    algorithm?: 'louvain' | 'leiden' | 'modularity'
  ): Promise<ClusteringResult>;

  /**
   * Finds the shortest path between two nodes
   * 
   * @param graphData - Graph data
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @param algorithm - Path finding algorithm ('dijkstra', 'astar', 'bfs')
   * @returns Promise resolving to path result
   */
  findShortestPath(
    graphData: GraphData,
    sourceId: string,
    targetId: string,
    algorithm?: 'dijkstra' | 'astar' | 'bfs'
  ): Promise<PathResult>;

  /**
   * Finds all paths between two nodes up to a maximum length
   * 
   * @param graphData - Graph data
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @param maxLength - Maximum path length
   * @returns Promise resolving to array of paths
   */
  findAllPaths(
    graphData: GraphData,
    sourceId: string,
    targetId: string,
    maxLength?: number
  ): Promise<PathResult[]>;

  /**
   * Calculates importance scores for all nodes
   * 
   * @param graphData - Graph data
   * @returns Promise resolving to importance scores
   */
  calculateImportanceScores(graphData: GraphData): Promise<Map<string, number>>;

  /**
   * Calculates graph-wide statistics and metrics
   * 
   * @param graphData - Graph data
   * @returns Promise resolving to calculated metrics for each node
   */
  calculateNodeMetrics(graphData: GraphData): Promise<Map<string, CalculatedMetrics>>;

  /**
   * Performs graph similarity analysis
   * 
   * @param graphData - Graph data
   * @param nodeId - Reference node ID
   * @param algorithm - Similarity algorithm ('jaccard', 'cosine', 'structural')
   * @returns Promise resolving to similarity scores
   */
  calculateSimilarity(
    graphData: GraphData,
    nodeId: string,
    algorithm?: 'jaccard' | 'cosine' | 'structural'
  ): Promise<Map<string, number>>;

  /**
   * Identifies influential nodes in the graph
   * 
   * @param graphData - Graph data
   * @param criteria - Influence criteria ('centrality', 'connections', 'pagerank')
   * @param topK - Number of top nodes to return
   * @returns Promise resolving to influential node IDs
   */
  identifyInfluentialNodes(
    graphData: GraphData,
    criteria?: 'centrality' | 'connections' | 'pagerank',
    topK?: number
  ): Promise<string[]>;

  /**
   * Detects anomalies or outliers in the graph
   * 
   * @param graphData - Graph data
   * @param algorithm - Anomaly detection algorithm
   * @returns Promise resolving to anomalous node IDs
   */
  detectAnomalies(
    graphData: GraphData,
    algorithm?: 'isolation' | 'clustering' | 'statistical'
  ): Promise<string[]>;

  /**
   * Suggests new connections based on graph structure
   * 
   * @param graphData - Graph data
   * @param nodeId - Node ID for which to suggest connections
   * @param maxSuggestions - Maximum number of suggestions
   * @returns Promise resolving to suggested node IDs with scores
   */
  suggestConnections(
    graphData: GraphData,
    nodeId: string,
    maxSuggestions?: number
  ): Promise<Array<{ nodeId: string; score: number; reason: string }>>;
}

/**
 * Factory interface for creating GraphAnalyticsService instances
 */
export interface GraphAnalyticsServiceFactory {
  /**
   * Creates a new GraphAnalyticsService instance
   * 
   * @param config - Service configuration
   * @returns GraphAnalyticsService instance
   */
  create(config?: unknown): GraphAnalyticsService;
}