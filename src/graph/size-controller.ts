import { GraphConfig, defaultGraphConfig } from './config';

/**
 * Node interface for size controller
 */
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  score?: number;
  addedAt?: number; // timestamp
  lastAccessedAt?: number; // timestamp
}

/**
 * Edge interface for size controller
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

/**
 * Result of adding nodes/edges
 */
export interface AddResult {
  added: number;
  removed: number;
  total: number;
  removedNodeIds?: string[];
}

/**
 * Statistics about the graph
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Map<string, number>;
  edgesByType: Map<string, number>;
  averageScore: number;
  oldestNode?: GraphNode;
  newestNode?: GraphNode;
}

/**
 * Controls the size of the visible graph to maintain performance
 */
export class GraphSizeController {
  private config: Required<GraphConfig>;
  private visibleNodes: Map<string, GraphNode> = new Map();
  private visibleEdges: Map<string, GraphEdge> = new Map();

  constructor(config?: Partial<GraphConfig>) {
    this.config = { ...defaultGraphConfig, ...config };
  }

  /**
   * Check if we can add more nodes
   */
  canAddNodes(count: number): boolean {
    return this.visibleNodes.size + count <= this.config.maxVisibleNodes;
  }

  /**
   * Check if we can add more edges
   */
  canAddEdges(count: number): boolean {
    return this.visibleEdges.size + count <= this.config.maxVisibleEdges;
  }

  /**
   * Add nodes with automatic removal of less relevant ones if needed
   */
  async addNodesWithLimit(
    newNodes: GraphNode[],
    newEdges: GraphEdge[]
  ): Promise<AddResult> {
    const now = Date.now();
    const removedNodeIds: string[] = [];

    // Mark new nodes with timestamp
    newNodes.forEach(node => {
      node.addedAt = now;
      node.lastAccessedAt = now;
    });

    // Check if we need to remove existing nodes
    if (!this.canAddNodes(newNodes.length)) {
      const nodesToRemove = this.getLeastRelevantNodes(newNodes.length);
      for (const nodeId of nodesToRemove) {
        this.removeNode(nodeId);
        removedNodeIds.push(nodeId);
      }
    }

    // Add new nodes
    let addedNodes = 0;
    for (const node of newNodes) {
      if (this.visibleNodes.size < this.config.maxVisibleNodes) {
        this.visibleNodes.set(node.id, node);
        addedNodes++;
      } else {
        break;
      }
    }

    // Add edges (only if both source and target exist)
    let addedEdges = 0;
    for (const edge of newEdges) {
      if (
        this.visibleNodes.has(edge.source) &&
        this.visibleNodes.has(edge.target) &&
        this.visibleEdges.size < this.config.maxVisibleEdges
      ) {
        this.visibleEdges.set(edge.id, edge);
        addedEdges++;
      }
    }

    return {
      added: addedNodes,
      removed: removedNodeIds.length,
      total: this.visibleNodes.size,
      removedNodeIds
    };
  }

  /**
   * Remove a node and its connected edges
   */
  removeNode(nodeId: string): boolean {
    const removed = this.visibleNodes.delete(nodeId);
    
    if (removed) {
      // Remove edges connected to this node
      const edgesToRemove: string[] = [];
      for (const [edgeId, edge] of this.visibleEdges) {
        if (edge.source === nodeId || edge.target === nodeId) {
          edgesToRemove.push(edgeId);
        }
      }
      
      for (const edgeId of edgesToRemove) {
        this.visibleEdges.delete(edgeId);
      }
    }

    return removed;
  }

  /**
   * Remove multiple nodes
   */
  removeNodes(nodeIds: string[]): number {
    let removed = 0;
    for (const nodeId of nodeIds) {
      if (this.removeNode(nodeId)) {
        removed++;
      }
    }
    return removed;
  }

  /**
   * Update node access time (for LRU)
   */
  accessNode(nodeId: string): void {
    const node = this.visibleNodes.get(nodeId);
    if (node) {
      node.lastAccessedAt = Date.now();
    }
  }

  /**
   * Get least relevant nodes to remove
   * Strategy: Combination of low score, old age, and least recently used
   */
  private getLeastRelevantNodes(count: number): string[] {
    const nodes = Array.from(this.visibleNodes.values());
    
    // Calculate relevance score for each node
    const now = Date.now();
    const scoredNodes = nodes.map(node => {
      const scoreWeight = (node.score || 0) * 0.5;
      const ageWeight = node.addedAt ? (1 - ((now - node.addedAt) / (now - Math.min(...nodes.map(n => n.addedAt || now))))) * 0.3 : 0;
      const accessWeight = node.lastAccessedAt ? (1 - ((now - node.lastAccessedAt) / (now - Math.min(...nodes.map(n => n.lastAccessedAt || now))))) * 0.2 : 0;
      
      return {
        id: node.id,
        relevance: scoreWeight + ageWeight + accessWeight
      };
    });

    // Sort by relevance (lowest first)
    scoredNodes.sort((a, b) => a.relevance - b.relevance);

    // Return IDs of least relevant nodes
    return scoredNodes.slice(0, count).map(n => n.id);
  }

  /**
   * Filter nodes by score threshold
   */
  filterByScore(minScore: number): number {
    const nodesToRemove: string[] = [];
    
    for (const [nodeId, node] of this.visibleNodes) {
      if ((node.score || 0) < minScore) {
        nodesToRemove.push(nodeId);
      }
    }

    return this.removeNodes(nodesToRemove);
  }

  /**
   * Filter edges by weight threshold
   */
  filterEdgesByWeight(minWeight: number): number {
    const edgesToRemove: string[] = [];
    
    for (const [edgeId, edge] of this.visibleEdges) {
      if (edge.weight < minWeight) {
        edgesToRemove.push(edgeId);
      }
    }

    let removed = 0;
    for (const edgeId of edgesToRemove) {
      if (this.visibleEdges.delete(edgeId)) {
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get current graph statistics
   */
  getStats(): GraphStats {
    const nodesByType = new Map<string, number>();
    const edgesByType = new Map<string, number>();
    let totalScore = 0;
    let countWithScore = 0;
    let oldestNode: GraphNode | undefined;
    let newestNode: GraphNode | undefined;

    // Analyze nodes
    for (const node of this.visibleNodes.values()) {
      // Count by type
      nodesByType.set(node.type, (nodesByType.get(node.type) || 0) + 1);
      
      // Calculate average score
      if (node.score !== undefined) {
        totalScore += node.score;
        countWithScore++;
      }

      // Find oldest and newest
      if (!oldestNode || (node.addedAt && node.addedAt < (oldestNode.addedAt || Infinity))) {
        oldestNode = node;
      }
      if (!newestNode || (node.addedAt && node.addedAt > (newestNode.addedAt || 0))) {
        newestNode = node;
      }
    }

    // Analyze edges
    for (const edge of this.visibleEdges.values()) {
      edgesByType.set(edge.type, (edgesByType.get(edge.type) || 0) + 1);
    }

    return {
      totalNodes: this.visibleNodes.size,
      totalEdges: this.visibleEdges.size,
      nodesByType,
      edgesByType,
      averageScore: countWithScore > 0 ? totalScore / countWithScore : 0,
      oldestNode,
      newestNode
    };
  }

  /**
   * Clear all nodes and edges
   */
  clear(): void {
    this.visibleNodes.clear();
    this.visibleEdges.clear();
  }

  /**
   * Get all visible nodes
   */
  getNodes(): GraphNode[] {
    return Array.from(this.visibleNodes.values());
  }

  /**
   * Get all visible edges
   */
  getEdges(): GraphEdge[] {
    return Array.from(this.visibleEdges.values());
  }

  /**
   * Get a specific node
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.visibleNodes.get(nodeId);
  }

  /**
   * Check if graph is at capacity
   */
  isAtCapacity(): boolean {
    return this.visibleNodes.size >= this.config.maxVisibleNodes;
  }

  /**
   * Get capacity info
   */
  getCapacityInfo(): {
    nodes: { current: number; max: number; percentage: number };
    edges: { current: number; max: number; percentage: number };
  } {
    return {
      nodes: {
        current: this.visibleNodes.size,
        max: this.config.maxVisibleNodes,
        percentage: (this.visibleNodes.size / this.config.maxVisibleNodes) * 100
      },
      edges: {
        current: this.visibleEdges.size,
        max: this.config.maxVisibleEdges,
        percentage: (this.visibleEdges.size / this.config.maxVisibleEdges) * 100
      }
    };
  }
}
