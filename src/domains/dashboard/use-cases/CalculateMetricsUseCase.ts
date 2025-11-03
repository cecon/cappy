/**
 * @fileoverview Use case for calculating graph metrics
 * @module domains/dashboard/use-cases/CalculateMetricsUseCase
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData, GraphNode } from '../types';

/**
 * Options for calculating metrics
 */
export interface CalculateMetricsOptions {
  /**
   * Whether to calculate PageRank
   * @default true
   */
  includePageRank?: boolean;
  
  /**
   * Whether to calculate betweenness centrality
   * @default false (computationally expensive)
   */
  includeBetweenness?: boolean;
  
  /**
   * Whether to calculate clustering coefficient
   * @default true
   */
  includeClustering?: boolean;
  
  /**
   * PageRank damping factor
   * @default 0.85
   */
  dampingFactor?: number;
  
  /**
   * Maximum iterations for PageRank
   * @default 100
   */
  maxIterations?: number;
  
  /**
   * Convergence threshold for PageRank
   * @default 0.0001
   */
  convergenceThreshold?: number;
}

/**
 * Result of calculating graph metrics
 */
export interface CalculateMetricsResult {
  /**
   * Updated graph data with calculated metrics
   */
  data: GraphData;
  
  /**
   * Metadata about the calculation
   */
  metadata: {
    /**
     * Metrics that were calculated
     */
    calculatedMetrics: string[];
    
    /**
     * Time taken to calculate (in milliseconds)
     */
    calculationTimeMs: number;
    
    /**
     * PageRank statistics (if calculated)
     */
    pageRankStats?: {
      iterations: number;
      converged: boolean;
      topNodes: Array<{ id: string; score: number }>;
    };
    
    /**
     * Clustering statistics (if calculated)
     */
    clusteringStats?: {
      average: number;
      min: number;
      max: number;
    };
  };
}

/**
 * Use case for calculating various graph metrics
 * 
 * This use case computes important graph metrics including:
 * - PageRank: Measures node importance based on connections
 * - Betweenness Centrality: Measures how often a node appears on shortest paths
 * - Clustering Coefficient: Measures how connected a node's neighbors are
 * - Degree Centrality: Already calculated as part of connections
 * 
 * @example
 * ```typescript
 * const useCase = new CalculateMetricsUseCase();
 * 
 * // Calculate all default metrics
 * const result = await useCase.execute(graphData);
 * 
 * // Calculate only PageRank
 * const pr = await useCase.execute(graphData, {
 *   includePageRank: true,
 *   includeClustering: false
 * });
 * ```
 */
export class CalculateMetricsUseCase {
  /**
   * Executes the use case to calculate graph metrics
   * 
   * @param data - Graph data to analyze
   * @param options - Calculation options
   * @returns Promise resolving to result with updated metrics
   * @throws {Error} When calculation fails or validation fails
   */
  async execute(
    data: GraphData,
    options: CalculateMetricsOptions = {}
  ): Promise<CalculateMetricsResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateInput(data, options);
      
      // Set defaults
      const includePageRank = options.includePageRank ?? true;
      const includeBetweenness = options.includeBetweenness ?? false;
      const includeClustering = options.includeClustering ?? true;
      
      const calculatedMetrics: string[] = [];
      
      // Create a copy of nodes to update
      let nodes = [...data.nodes];
      
      // Calculate PageRank
      let pageRankStats: CalculateMetricsResult['metadata']['pageRankStats'];
      if (includePageRank) {
        const result = this.calculatePageRank(nodes, data.edges, options);
        nodes = result.nodes;
        pageRankStats = result.stats;
        calculatedMetrics.push('PageRank');
      }
      
      // Calculate Betweenness Centrality
      if (includeBetweenness) {
        nodes = this.calculateBetweenness(nodes, data.edges);
        calculatedMetrics.push('Betweenness Centrality');
      }
      
      // Calculate Clustering Coefficient
      let clusteringStats: CalculateMetricsResult['metadata']['clusteringStats'];
      if (includeClustering) {
        const result = this.calculateClustering(nodes, data.edges);
        nodes = result.nodes;
        clusteringStats = result.stats;
        calculatedMetrics.push('Clustering Coefficient');
      }
      
      // Create updated graph data
      const updatedData: GraphData = {
        ...data,
        nodes
      };
      
      const calculationTimeMs = Date.now() - startTime;
      
      return {
        data: updatedData,
        metadata: {
          calculatedMetrics,
          calculationTimeMs,
          pageRankStats,
          clusteringStats
        }
      };
    } catch (error) {
      const calculationTimeMs = Date.now() - startTime;
      
      throw new Error(
        `Failed to calculate metrics after ${calculationTimeMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Calculates PageRank for all nodes
   * 
   * PageRank is an algorithm that measures the importance of nodes based on
   * the link structure. A node has high PageRank if it's linked to by other
   * high-PageRank nodes.
   * 
   * @param nodes - Nodes to calculate PageRank for
   * @param edges - Graph edges
   * @param options - Calculation options
   * @returns Updated nodes and statistics
   */
  private calculatePageRank(
    nodes: GraphNode[],
    edges: Array<{ source: string; target: string; weight: number }>,
    options: CalculateMetricsOptions
  ): {
    nodes: GraphNode[];
    stats: NonNullable<CalculateMetricsResult['metadata']['pageRankStats']>;
  } {
    const dampingFactor = options.dampingFactor ?? 0.85;
    const maxIterations = options.maxIterations ?? 100;
    const convergenceThreshold = options.convergenceThreshold ?? 0.0001;
    
    const nodeCount = nodes.length;
    if (nodeCount === 0) {
      return {
        nodes: [],
        stats: { iterations: 0, converged: true, topNodes: [] }
      };
    }
    
    // Initialize PageRank scores
    const pageRank = new Map<string, number>();
    const newPageRank = new Map<string, number>();
    const outDegree = new Map<string, number>();
    
    // Initialize all nodes with equal PageRank
    const initialRank = 1.0 / nodeCount;
    for (const node of nodes) {
      pageRank.set(node.id, initialRank);
      newPageRank.set(node.id, 0);
      outDegree.set(node.id, 0);
    }
    
    // Calculate out-degrees
    for (const edge of edges) {
      const current = outDegree.get(edge.source) ?? 0;
      outDegree.set(edge.source, current + edge.weight);
    }
    
    // Iterative PageRank calculation
    let iterations = 0;
    let converged = false;
    
    for (iterations = 0; iterations < maxIterations; iterations++) {
      // Reset new PageRank values
      for (const node of nodes) {
        newPageRank.set(node.id, (1 - dampingFactor) / nodeCount);
      }
      
      // Distribute PageRank from each node to its neighbors
      for (const edge of edges) {
        const sourceRank = pageRank.get(edge.source) ?? 0;
        const sourceDegree = outDegree.get(edge.source) ?? 1;
        const contribution = (dampingFactor * sourceRank * edge.weight) / sourceDegree;
        
        const currentRank = newPageRank.get(edge.target) ?? 0;
        newPageRank.set(edge.target, currentRank + contribution);
      }
      
      // Check convergence
      let maxDiff = 0;
      for (const node of nodes) {
        const oldRank = pageRank.get(node.id) ?? 0;
        const newRank = newPageRank.get(node.id) ?? 0;
        maxDiff = Math.max(maxDiff, Math.abs(newRank - oldRank));
      }
      
      // Swap old and new PageRank
      for (const node of nodes) {
        pageRank.set(node.id, newPageRank.get(node.id) ?? 0);
      }
      
      if (maxDiff < convergenceThreshold) {
        converged = true;
        break;
      }
    }
    
    // Update nodes with PageRank scores
    const updatedNodes = nodes.map(node => ({
      ...node,
      metrics: {
        ...node.metrics,
        pageRank: pageRank.get(node.id) ?? 0
      }
    }));
    
    // Get top nodes by PageRank
    const topNodes = [...updatedNodes]
      .sort((a, b) => b.metrics.pageRank - a.metrics.pageRank)
      .slice(0, 10)
      .map(node => ({
        id: node.id,
        score: node.metrics.pageRank
      }));
    
    return {
      nodes: updatedNodes,
      stats: {
        iterations,
        converged,
        topNodes
      }
    };
  }

  /**
   * Calculates betweenness centrality for all nodes
   * 
   * Betweenness centrality measures how often a node appears on shortest paths
   * between other nodes. High betweenness indicates the node is important for
   * information flow.
   * 
   * Note: This is computationally expensive (O(n³)) for large graphs.
   * 
   * @param nodes - Nodes to calculate betweenness for
   * @param edges - Graph edges
   * @returns Updated nodes
   */
  private calculateBetweenness(
    nodes: GraphNode[],
    edges: Array<{ source: string; target: string }>,
  ): GraphNode[] {
    const betweenness = new Map<string, number>();
    
    // Initialize betweenness
    for (const node of nodes) {
      betweenness.set(node.id, 0);
    }
    
    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) {
      adjacency.set(node.id, new Set());
    }
    for (const edge of edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source); // Treat as undirected
    }
    
    // For each node as source
    for (const source of nodes) {
      // BFS to find shortest paths
      const distance = new Map<string, number>();
      const paths = new Map<string, number>();
      const predecessors = new Map<string, string[]>();
      const queue: string[] = [source.id];
      
      distance.set(source.id, 0);
      paths.set(source.id, 1);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentDist = distance.get(current) ?? 0;
        
        for (const neighbor of adjacency.get(current) ?? []) {
          // First time visiting this neighbor
          if (!distance.has(neighbor)) {
            distance.set(neighbor, currentDist + 1);
            queue.push(neighbor);
          }
          
          // Shortest path to neighbor goes through current
          if (distance.get(neighbor) === currentDist + 1) {
            const currentPaths = paths.get(current) ?? 0;
            paths.set(neighbor, (paths.get(neighbor) ?? 0) + currentPaths);
            
            if (!predecessors.has(neighbor)) {
              predecessors.set(neighbor, []);
            }
            predecessors.get(neighbor)!.push(current);
          }
        }
      }
      
      // Back-propagation to accumulate betweenness
      const delta = new Map<string, number>();
      const sortedNodes = [...nodes]
        .filter(n => distance.has(n.id))
        .sort((a, b) => (distance.get(b.id) ?? 0) - (distance.get(a.id) ?? 0));
      
      for (const node of sortedNodes) {
        if (node.id === source.id) continue;
        
        const preds = predecessors.get(node.id) ?? [];
        const nodePaths = paths.get(node.id) ?? 1;
        const nodeDelta = delta.get(node.id) ?? 0;
        
        for (const pred of preds) {
          const predPaths = paths.get(pred) ?? 1;
          const contribution = (predPaths / nodePaths) * (1 + nodeDelta);
          delta.set(pred, (delta.get(pred) ?? 0) + contribution);
        }
        
        if (node.id !== source.id) {
          betweenness.set(node.id, (betweenness.get(node.id) ?? 0) + nodeDelta);
        }
      }
    }
    
    // Normalize betweenness (divide by (n-1)(n-2)/2 for undirected graphs)
    const n = nodes.length;
    const normalization = n > 2 ? (n - 1) * (n - 2) / 2 : 1;
    
    // Update nodes with betweenness centrality
    return nodes.map(node => ({
      ...node,
      metrics: {
        ...node.metrics,
        centrality: (betweenness.get(node.id) ?? 0) / normalization
      }
    }));
  }

  /**
   * Calculates clustering coefficient for all nodes
   * 
   * Clustering coefficient measures how connected a node's neighbors are to each other.
   * High clustering indicates the node is part of a tightly-knit community.
   * 
   * @param nodes - Nodes to calculate clustering for
   * @param edges - Graph edges
   * @returns Updated nodes and statistics
   */
  private calculateClustering(
    nodes: GraphNode[],
    edges: Array<{ source: string; target: string }>,
  ): {
    nodes: GraphNode[];
    stats: NonNullable<CalculateMetricsResult['metadata']['clusteringStats']>;
  } {
    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) {
      adjacency.set(node.id, new Set());
    }
    for (const edge of edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source); // Treat as undirected
    }
    
    const clustering = new Map<string, number>();
    
    // Calculate clustering coefficient for each node
    for (const node of nodes) {
      const neighbors = adjacency.get(node.id);
      if (!neighbors || neighbors.size < 2) {
        clustering.set(node.id, 0);
        continue;
      }
      
      // Count edges between neighbors
      let edgesAmongNeighbors = 0;
      const neighborList = Array.from(neighbors);
      
      for (let i = 0; i < neighborList.length; i++) {
        for (let j = i + 1; j < neighborList.length; j++) {
          if (adjacency.get(neighborList[i])?.has(neighborList[j])) {
            edgesAmongNeighbors++;
          }
        }
      }
      
      // Clustering coefficient = actual edges / possible edges
      const possibleEdges = (neighbors.size * (neighbors.size - 1)) / 2;
      clustering.set(node.id, edgesAmongNeighbors / possibleEdges);
    }
    
    // Update nodes with clustering coefficient
    const updatedNodes = nodes.map(node => ({
      ...node,
      metrics: {
        ...node.metrics,
        clustering: clustering.get(node.id) ?? 0
      }
    }));
    
    // Calculate statistics
    const coefficients = Array.from(clustering.values());
    const stats = {
      average: coefficients.reduce((sum, val) => sum + val, 0) / coefficients.length || 0,
      min: Math.min(...coefficients),
      max: Math.max(...coefficients)
    };
    
    return {
      nodes: updatedNodes,
      stats
    };
  }

  /**
   * Validates the input parameters
   * 
   * @param data - Graph data to validate
   * @param options - Options to validate
   * @throws {Error} When validation fails
   */
  private validateInput(data: GraphData, options: CalculateMetricsOptions): void {
    if (!data) {
      throw new Error('Graph data is required');
    }
    
    if (!data.nodes || !data.edges) {
      throw new Error('Graph data must contain nodes and edges arrays');
    }
    
    if (options.dampingFactor !== undefined) {
      if (options.dampingFactor < 0 || options.dampingFactor > 1) {
        throw new Error('Damping factor must be between 0 and 1');
      }
    }
    
    if (options.maxIterations !== undefined) {
      if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1) {
        throw new Error('Max iterations must be a positive integer');
      }
    }
    
    if (options.convergenceThreshold !== undefined) {
      if (options.convergenceThreshold <= 0) {
        throw new Error('Convergence threshold must be positive');
      }
    }
  }
}
