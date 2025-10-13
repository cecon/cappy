/**
 * @fileoverview Use case for expanding node neighborhood in graph
 * @module domains/graph/use-cases/ExpandNodeUseCase
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData, GraphNode, GraphEdge } from '../types';

/**
 * Options for expanding nodes
 */
export interface ExpandNodeOptions {
  /**
   * Maximum depth of expansion
   * @default 1
   */
  depth?: number;
  
  /**
   * Maximum number of neighbors to include per level
   * @default undefined (no limit)
   */
  maxNeighborsPerLevel?: number;
  
  /**
   * Only include neighbors with minimum confidence
   * @default 0
   */
  minConfidence?: number;
  
  /**
   * Filter neighbors by types
   */
  includeNodeTypes?: string[];
  
  /**
   * Filter edges by types
   */
  includeEdgeTypes?: string[];
  
  /**
   * Direction of expansion
   * @default 'both'
   */
  direction?: 'incoming' | 'outgoing' | 'both';
}

/**
 * Result of expanding a node
 */
export interface ExpandNodeResult {
  /**
   * Subgraph containing the expanded node and its neighborhood
   */
  subgraph: GraphData;
  
  /**
   * Metadata about the expansion operation
   */
  metadata: {
    /**
     * ID of the central node
     */
    centerNodeId: string;
    
    /**
     * Number of nodes in the subgraph
     */
    nodeCount: number;
    
    /**
     * Number of edges in the subgraph
     */
    edgeCount: number;
    
    /**
     * Actual depth reached
     */
    depthReached: number;
    
    /**
     * Nodes organized by depth level
     */
    nodesByDepth: Record<number, string[]>;
    
    /**
     * Time taken to expand (in milliseconds)
     */
    expandTimeMs: number;
  };
}

/**
 * Use case for expanding a node's neighborhood in the graph
 * 
 * This use case allows exploring the graph by expanding outward from a specific
 * node, discovering connected nodes and relationships up to a specified depth.
 * 
 * @example
 * ```typescript
 * const useCase = new ExpandNodeUseCase();
 * 
 * // Expand 1 level deep
 * const result = await useCase.execute(graphData, 'node-123');
 * 
 * // Expand 2 levels with limits
 * const deeper = await useCase.execute(graphData, 'node-123', {
 *   depth: 2,
 *   maxNeighborsPerLevel: 10,
 *   direction: 'outgoing'
 * });
 * ```
 */
export class ExpandNodeUseCase {
  /**
   * Executes the use case to expand a node's neighborhood
   * 
   * @param data - Original graph data
   * @param nodeId - ID of the node to expand
   * @param options - Expansion options
   * @returns Promise resolving to expansion result with subgraph
   * @throws {Error} When expansion fails or node not found
   */
  async execute(
    data: GraphData,
    nodeId: string,
    options: ExpandNodeOptions = {}
  ): Promise<ExpandNodeResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateInput(data, nodeId, options);
      
      // Set defaults
      const depth = options.depth ?? 1;
      const minConfidence = options.minConfidence ?? 0;
      
      // Check if node exists
      const centerNode = data.nodes.find(n => n.id === nodeId);
      if (!centerNode) {
        throw new Error(`Node with ID '${nodeId}' not found`);
      }
      
      // Perform BFS expansion
      const { nodes, edges, nodesByDepth, depthReached } = this.expandBFS(
        data,
        nodeId,
        depth,
        options
      );
      
      // Apply filters
      let filteredNodes = nodes.filter(node => node.confidence >= minConfidence);
      let filteredEdges = edges.filter(edge => edge.confidence >= minConfidence);
      
      if (options.includeNodeTypes) {
        filteredNodes = filteredNodes.filter(node => 
          options.includeNodeTypes!.includes(node.type)
        );
      }
      
      if (options.includeEdgeTypes) {
        filteredEdges = filteredEdges.filter(edge => 
          options.includeEdgeTypes!.includes(edge.type)
        );
      }
      
      // Remove orphaned edges
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
      
      // Create subgraph
      const subgraph: GraphData = {
        nodes: filteredNodes,
        edges: filteredEdges,
        statistics: {
          totalNodes: filteredNodes.length,
          totalEdges: filteredEdges.length,
          nodesByType: this.groupNodesByType(filteredNodes),
          edgesByType: this.groupEdgesByType(filteredEdges),
          avgConfidence: this.calculateAvgConfidence(filteredNodes, filteredEdges),
          dateRange: this.calculateDateRange(filteredNodes),
          density: this.calculateDensity(filteredNodes.length, filteredEdges.length)
        },
        lastUpdated: data.lastUpdated
      };
      
      const expandTimeMs = Date.now() - startTime;
      
      return {
        subgraph,
        metadata: {
          centerNodeId: nodeId,
          nodeCount: filteredNodes.length,
          edgeCount: filteredEdges.length,
          depthReached,
          nodesByDepth,
          expandTimeMs
        }
      };
    } catch (error) {
      const expandTimeMs = Date.now() - startTime;
      
      throw new Error(
        `Failed to expand node after ${expandTimeMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Performs breadth-first search expansion from a node
   * 
   * @param data - Graph data
   * @param startNodeId - Starting node ID
   * @param maxDepth - Maximum depth to expand
   * @param options - Expansion options
   * @returns Expanded nodes, edges, and metadata
   */
  private expandBFS(
    data: GraphData,
    startNodeId: string,
    maxDepth: number,
    options: ExpandNodeOptions
  ): {
    nodes: GraphNode[];
    edges: GraphEdge[];
    nodesByDepth: Record<number, string[]>;
    depthReached: number;
  } {
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const nodesByDepth: Record<number, string[]> = {};
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    let currentLevel = [startNodeId];
    let depth = 0;
    
    // Add center node
    const centerNode = data.nodes.find(n => n.id === startNodeId)!;
    nodes.push(centerNode);
    visitedNodes.add(startNodeId);
    nodesByDepth[0] = [startNodeId];
    
    // Expand level by level
    while (currentLevel.length > 0 && depth < maxDepth) {
      depth++;
      const nextLevel: string[] = [];
      nodesByDepth[depth] = [];
      
      for (const nodeId of currentLevel) {
        // Find connected edges
        let connectedEdges = data.edges.filter(edge => {
          if (options.direction === 'outgoing') {
            return edge.source === nodeId && !visitedEdges.has(edge.id);
          } else if (options.direction === 'incoming') {
            return edge.target === nodeId && !visitedEdges.has(edge.id);
          } else {
            return (edge.source === nodeId || edge.target === nodeId) && 
                   !visitedEdges.has(edge.id);
          }
        });
        
        // Apply per-level limit
        if (options.maxNeighborsPerLevel) {
          // Sort by confidence and take top N
          connectedEdges = connectedEdges
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, options.maxNeighborsPerLevel);
        }
        
        // Process each edge
        for (const edge of connectedEdges) {
          edges.push(edge);
          visitedEdges.add(edge.id);
          
          // Find the neighbor node
          const neighborId = edge.source === nodeId ? edge.target : edge.source;
          
          if (!visitedNodes.has(neighborId)) {
            const neighborNode = data.nodes.find(n => n.id === neighborId);
            if (neighborNode) {
              nodes.push(neighborNode);
              visitedNodes.add(neighborId);
              nextLevel.push(neighborId);
              nodesByDepth[depth].push(neighborId);
            }
          }
        }
      }
      
      currentLevel = nextLevel;
    }
    
    return {
      nodes,
      edges,
      nodesByDepth,
      depthReached: depth
    };
  }

  /**
   * Validates the input parameters
   * 
   * @param data - Graph data to validate
   * @param nodeId - Node ID to validate
   * @param options - Options to validate
   * @throws {Error} When validation fails
   */
  private validateInput(
    data: GraphData,
    nodeId: string,
    options: ExpandNodeOptions
  ): void {
    if (!data) {
      throw new Error('Graph data is required');
    }
    
    if (!data.nodes || !data.edges) {
      throw new Error('Graph data must contain nodes and edges arrays');
    }
    
    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('Valid node ID is required');
    }
    
    if (options.depth !== undefined) {
      if (!Number.isInteger(options.depth) || options.depth < 1) {
        throw new Error('Depth must be a positive integer');
      }
    }
    
    if (options.maxNeighborsPerLevel !== undefined) {
      if (!Number.isInteger(options.maxNeighborsPerLevel) || options.maxNeighborsPerLevel < 1) {
        throw new Error('maxNeighborsPerLevel must be a positive integer');
      }
    }
    
    if (options.minConfidence !== undefined) {
      if (options.minConfidence < 0 || options.minConfidence > 1) {
        throw new Error('minConfidence must be between 0 and 1');
      }
    }
  }

  /**
   * Groups nodes by type for statistics
   */
  private groupNodesByType(nodes: GraphNode[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const node of nodes) {
      groups[node.type] = (groups[node.type] || 0) + 1;
    }
    return groups;
  }

  /**
   * Groups edges by type for statistics
   */
  private groupEdgesByType(edges: GraphEdge[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const edge of edges) {
      groups[edge.type] = (groups[edge.type] || 0) + 1;
    }
    return groups;
  }

  /**
   * Calculates average confidence across nodes and edges
   */
  private calculateAvgConfidence(nodes: GraphNode[], edges: GraphEdge[]): number {
    const total = nodes.length + edges.length;
    if (total === 0) return 0;
    
    const sum = nodes.reduce((acc, n) => acc + n.confidence, 0) +
                edges.reduce((acc, e) => acc + e.confidence, 0);
    
    return sum / total;
  }

  /**
   * Calculates date range of nodes
   */
  private calculateDateRange(nodes: GraphNode[]): { min: string; max: string } | null {
    if (nodes.length === 0) return null;
    
    const dates = nodes.map(n => n.created).sort();
    return {
      min: dates[0],
      max: dates[dates.length - 1]
    };
  }

  /**
   * Calculates graph density
   */
  private calculateDensity(nodeCount: number, edgeCount: number): number {
    if (nodeCount < 2) return 0;
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    return edgeCount / maxEdges;
  }
}
