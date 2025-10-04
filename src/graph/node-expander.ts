import { LanceDBStore } from '../store/lancedb';
import { GraphConfig, defaultGraphConfig } from './config';
import { GraphNode, GraphEdge } from './size-controller';
import { defaultLabelExtractor } from './label-extractor';

/**
 * Expansion options
 */
export interface ExpansionOptions {
  maxNeighbors?: number;
  minWeight?: number;
  maxDepth?: number;
  edgeTypes?: string[];
  includeMetadata?: boolean;
}

/**
 * Result of graph expansion
 */
export interface GraphExpansion {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    addedNodes: number;
    addedEdges: number;
    hasMore: boolean;
    depth: number;
  };
}

/**
 * Subgraph result
 */
export interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: {
    query?: string;
    totalPossibleNodes?: number;
    totalPossibleEdges?: number;
    isPartial?: boolean;
  };
}

/**
 * Expands graph nodes by following edges
 */
export class NodeExpander {
  private config: Required<GraphConfig>;
  private lancedb: LanceDBStore;

  constructor(lancedb: LanceDBStore, config?: Partial<GraphConfig>) {
    this.config = { ...defaultGraphConfig, ...config };
    this.lancedb = lancedb;
  }

  /**
   * Expand a single node by following its edges (1-hop)
   */
  async expandNode(
    nodeId: string,
    options?: ExpansionOptions
  ): Promise<GraphExpansion> {
    const maxNeighbors = options?.maxNeighbors || this.config.maxNeighborsPerNode;
    const minWeight = options?.minWeight || this.config.minEdgeWeight;
    const edgeTypes = options?.edgeTypes || ['REFERS_TO', 'MENTIONS_SYMBOL', 'MEMBER_OF', 'CONTAINS'];

    try {
      // Query edges from this node
      const edges = await this.lancedb.queryEdges({
        source: nodeId,
        minWeight,
        edgeTypes,
        limit: maxNeighbors
      });

      // Get target nodes
      const targetIds = edges.map(e => e.target);
      const targetNodes = await this.lancedb.queryNodesByIds(targetIds);

      // Convert to GraphNode and GraphEdge format
      const newNodes: GraphNode[] = targetNodes.map(node => ({
        id: node.id,
        type: node.type,
        label: defaultLabelExtractor.extractFromNode(node),
        score: node.score,
        addedAt: Date.now()
      }));

      const newEdges: GraphEdge[] = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        weight: edge.weight
      }));

      return {
        nodes: newNodes,
        edges: newEdges,
        stats: {
          addedNodes: newNodes.length,
          addedEdges: newEdges.length,
          hasMore: edges.length === maxNeighbors,
          depth: 1
        }
      };
    } catch (error) {
      console.error(`Failed to expand node ${nodeId}:`, error);
      return {
        nodes: [],
        edges: [],
        stats: {
          addedNodes: 0,
          addedEdges: 0,
          hasMore: false,
          depth: 0
        }
      };
    }
  }

  /**
   * Expand multiple nodes simultaneously
   */
  async expandNodes(
    nodeIds: string[],
    options?: ExpansionOptions
  ): Promise<GraphExpansion> {
    const expansions = await Promise.all(
      nodeIds.map(nodeId => this.expandNode(nodeId, options))
    );

    // Merge all expansions
    const allNodes = new Map<string, GraphNode>();
    const allEdges = new Map<string, GraphEdge>();
    let totalAdded = 0;
    let hasMore = false;

    for (const expansion of expansions) {
      for (const node of expansion.nodes) {
        allNodes.set(node.id, node);
      }
      for (const edge of expansion.edges) {
        allEdges.set(edge.id, edge);
      }
      totalAdded += expansion.stats.addedNodes;
      hasMore = hasMore || expansion.stats.hasMore;
    }

    return {
      nodes: Array.from(allNodes.values()),
      edges: Array.from(allEdges.values()),
      stats: {
        addedNodes: allNodes.size,
        addedEdges: allEdges.size,
        hasMore,
        depth: 1
      }
    };
  }

  /**
   * Build a subgraph starting from initial nodes with depth-limited expansion
   */
  async buildSubgraph(
    initialNodeIds: string[],
    options?: ExpansionOptions
  ): Promise<Subgraph> {
    const maxDepth = options?.maxDepth || this.config.maxExpansionDepth;
    const allNodes = new Map<string, GraphNode>();
    const allEdges = new Map<string, GraphEdge>();
    let currentLevel = initialNodeIds;
    let depth = 0;

    // Get initial nodes
    try {
      const initialNodes = await this.lancedb.queryNodesByIds(initialNodeIds);
      for (const node of initialNodes) {
        allNodes.set(node.id, {
          id: node.id,
          type: node.type,
          label: defaultLabelExtractor.extractFromNode(node),
          score: node.score,
          addedAt: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to get initial nodes:', error);
    }

    // Expand level by level
    while (depth < maxDepth && currentLevel.length > 0) {
      // Check if we're approaching limits
      if (allNodes.size >= this.config.maxVisibleNodes * 0.8) {
        console.log(`Subgraph approaching limit (${allNodes.size} nodes), stopping expansion`);
        break;
      }

      const expansion = await this.expandNodes(currentLevel, options);
      
      // Add new nodes
      for (const node of expansion.nodes) {
        if (!allNodes.has(node.id)) {
          allNodes.set(node.id, node);
        }
      }

      // Add new edges
      for (const edge of expansion.edges) {
        allEdges.set(edge.id, edge);
      }

      // Prepare next level (only new nodes)
      currentLevel = expansion.nodes
        .filter(node => !currentLevel.includes(node.id))
        .map(node => node.id);

      depth++;
    }

    return {
      nodes: Array.from(allNodes.values()),
      edges: Array.from(allEdges.values()),
      metadata: {
        totalPossibleNodes: allNodes.size,
        totalPossibleEdges: allEdges.size,
        isPartial: depth >= maxDepth || allNodes.size >= this.config.maxVisibleNodes
      }
    };
  }

  /**
   * Find siblings (nodes with same parent)
   */
  async findSiblings(nodeId: string): Promise<GraphExpansion> {
    try {
      // Find parent edges (CONTAINS, MEMBER_OF)
      const parentEdges = await this.lancedb.queryEdges({
        target: nodeId,
        edgeTypes: ['CONTAINS', 'MEMBER_OF'],
        limit: 10
      });

      if (parentEdges.length === 0) {
        return {
          nodes: [],
          edges: [],
          stats: { addedNodes: 0, addedEdges: 0, hasMore: false, depth: 0 }
        };
      }

      // Get all children of these parents
      const parentIds = parentEdges.map(e => e.source);
      const siblingEdges = await this.lancedb.queryEdges({
        source: parentIds,
        edgeTypes: ['CONTAINS', 'MEMBER_OF'],
        limit: this.config.maxNeighborsPerNode
      });

      // Filter out the original node
      const siblingTargets = siblingEdges
        .filter(e => e.target !== nodeId)
        .map(e => e.target);

      // Get sibling nodes
      const siblingNodes = await this.lancedb.queryNodesByIds(siblingTargets);

      return {
        nodes: siblingNodes.map(node => ({
          id: node.id,
          type: node.type,
          label: defaultLabelExtractor.extractFromNode(node),
          score: node.score,
          addedAt: Date.now()
        })),
        edges: siblingEdges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight
        })),
        stats: {
          addedNodes: siblingNodes.length,
          addedEdges: siblingEdges.length,
          hasMore: siblingEdges.length === this.config.maxNeighborsPerNode,
          depth: 1
        }
      };
    } catch (error) {
      console.error(`Failed to find siblings for ${nodeId}:`, error);
      return {
        nodes: [],
        edges: [],
        stats: { addedNodes: 0, addedEdges: 0, hasMore: false, depth: 0 }
      };
    }
  }

  /**
   * Find shortest path between two nodes
   */
  async findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 3
  ): Promise<Subgraph | null> {
    // This is a simplified BFS implementation
    // For production, consider using a more sophisticated algorithm
    
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; depth: number }> = [
      { nodeId: sourceId, path: [sourceId], depth: 0 }
    ];

    const allNodes = new Map<string, GraphNode>();
    const allEdges = new Map<string, GraphEdge>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === targetId) {
        // Found path! Build subgraph from path
        const pathNodes = await this.lancedb.queryNodesByIds(current.path);
        for (const node of pathNodes) {
          allNodes.set(node.id, {
            id: node.id,
            type: node.type,
            label: defaultLabelExtractor.extractFromNode(node),
            score: node.score,
            addedAt: Date.now()
          });
        }

        // Get edges between consecutive nodes in path
        for (let i = 0; i < current.path.length - 1; i++) {
          const edges = await this.lancedb.queryEdges({
            source: current.path[i],
            target: current.path[i + 1],
            limit: 1
          });
          if (edges.length > 0) {
            const edge = edges[0];
            allEdges.set(edge.id, {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              type: edge.type,
              weight: edge.weight
            });
          }
        }

        return {
          nodes: Array.from(allNodes.values()),
          edges: Array.from(allEdges.values()),
          metadata: {
            totalPossibleNodes: allNodes.size,
            totalPossibleEdges: allEdges.size,
            isPartial: false
          }
        };
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      visited.add(current.nodeId);

      // Expand neighbors
      const expansion = await this.expandNode(current.nodeId, {
        maxNeighbors: 10,
        minWeight: 0.3
      });

      for (const node of expansion.nodes) {
        if (!visited.has(node.id)) {
          queue.push({
            nodeId: node.id,
            path: [...current.path, node.id],
            depth: current.depth + 1
          });
        }
      }
    }

    // No path found
    return null;
  }
}
