import { GraphNode, GraphEdge } from './size-controller';
import { GraphConfig, defaultGraphConfig, DetailLevel } from './config';
import { defaultLabelExtractor } from './label-extractor';

/**
 * Graph data structure
 */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Cluster of nodes
 */
export interface NodeCluster {
  id: string;
  name: string;
  nodes: GraphNode[];
  count: number;
  centroid?: GraphNode; // Representative node
}

/**
 * LOD (Level of Detail) Manager
 * Manages graph complexity by applying different detail levels
 */
export class LODManager {
  private config: Required<GraphConfig>;

  constructor(config?: Partial<GraphConfig>) {
    this.config = { ...defaultGraphConfig, ...config };
  }

  /**
   * Determine appropriate detail level based on node count
   */
  getDetailLevel(nodeCount: number): DetailLevel {
    // Use fixed thresholds for LOD
    const detailedThreshold = 30;
    const simplifiedThreshold = 70;
    
    if (nodeCount <= detailedThreshold) {
      return DetailLevel.DETAILED;
    } else if (nodeCount <= simplifiedThreshold) {
      return DetailLevel.SIMPLIFIED;
    } else {
      return DetailLevel.CLUSTERED;
    }
  }

  /**
   * Apply LOD strategy to a graph
   */
  applyLOD(graph: Graph): Graph {
    const level = this.getDetailLevel(graph.nodes.length);
    
    console.log(`Applying LOD: ${level} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
    
    switch (level) {
      case DetailLevel.DETAILED:
        return graph; // No modifications needed
        
      case DetailLevel.SIMPLIFIED:
        return this.simplifyGraph(graph);
        
      case DetailLevel.CLUSTERED:
        return this.clusterGraph(graph);
        
      default:
        return graph;
    }
  }

  /**
   * Simplify graph by hiding less important details
   */
  private simplifyGraph(graph: Graph): Graph {
    console.log('Simplifying graph...');
    
    // Keep all nodes but remove low-weight edges
    const minWeight = this.config.minEdgeWeight || 0.5;
    const filteredEdges = graph.edges.filter(edge => edge.weight >= minWeight);
    
    // Simplify node labels
    const simplifiedNodes = graph.nodes.map(node => ({
      ...node,
      // Remove some metadata to reduce visual clutter
      score: undefined
    }));
    
    console.log(`Simplified: ${graph.edges.length} → ${filteredEdges.length} edges`);
    
    return {
      nodes: simplifiedNodes,
      edges: filteredEdges
    };
  }

  /**
   * Cluster nodes to reduce visual complexity
   */
  private clusterGraph(graph: Graph): Graph {
    console.log('Clustering graph...');
    
    // Group nodes by type and path similarity
    const clusters = this.groupNodesByPathAndType(graph.nodes);
    
    // Convert clusters to cluster nodes
    const clusterNodes: GraphNode[] = [];
    const nodeToCluster = new Map<string, string>();
    
    for (const cluster of clusters) {
      if (cluster.nodes.length > 1) {
        // Create cluster node
        const clusterNode: GraphNode = {
          id: cluster.id,
          type: 'Cluster',
          label: cluster.name,
          score: cluster.nodes.reduce((sum, n) => sum + (n.score || 0), 0) / cluster.nodes.length
        };
        
        clusterNodes.push(clusterNode);
        
        // Map original nodes to cluster
        for (const node of cluster.nodes) {
          nodeToCluster.set(node.id, cluster.id);
        }
      } else {
        // Keep single nodes as-is
        clusterNodes.push(cluster.nodes[0]);
      }
    }
    
    // Aggregate edges between clusters
    const edgeMap = new Map<string, GraphEdge>();
    
    for (const edge of graph.edges) {
      const sourceCluster = nodeToCluster.get(edge.source) || edge.source;
      const targetCluster = nodeToCluster.get(edge.target) || edge.target;
      
      // Skip self-loops
      if (sourceCluster === targetCluster) {
        continue;
      }
      
      const edgeKey = `${sourceCluster}->${targetCluster}:${edge.type}`;
      
      if (edgeMap.has(edgeKey)) {
        // Aggregate weights
        const existing = edgeMap.get(edgeKey)!;
        existing.weight = Math.max(existing.weight, edge.weight);
      } else {
        edgeMap.set(edgeKey, {
          id: edgeKey,
          source: sourceCluster,
          target: targetCluster,
          type: edge.type,
          weight: edge.weight
        });
      }
    }
    
    const clusteredEdges = Array.from(edgeMap.values());
    
    console.log(`Clustered: ${graph.nodes.length} → ${clusterNodes.length} nodes, ${graph.edges.length} → ${clusteredEdges.length} edges`);
    
    return {
      nodes: clusterNodes,
      edges: clusteredEdges
    };
  }

  /**
   * Group nodes by path and type similarity
   */
  private groupNodesByPathAndType(nodes: GraphNode[]): NodeCluster[] {
    // Group by type first
    const typeGroups = this.groupByType(nodes);
    
    const clusters: NodeCluster[] = [];
    let clusterIndex = 0;
    
    // For each type, further group by path prefix
    for (const typeNodes of typeGroups.values()) {
      const pathGroups = this.groupByPath(typeNodes);
      
      // Create clusters for each path group
      for (const pathNodes of pathGroups.values()) {
        const newClusters = this.createClustersFromGroup(pathNodes, clusterIndex);
        clusters.push(...newClusters);
        clusterIndex += newClusters.filter(c => c.count > 1).length;
      }
    }
    
    return clusters;
  }

  /**
   * Group nodes by type
   */
  private groupByType(nodes: GraphNode[]): Map<string, GraphNode[]> {
    const groups = new Map<string, GraphNode[]>();
    
    for (const node of nodes) {
      const type = node.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(node);
    }
    
    return groups;
  }

  /**
   * Group nodes by path prefix
   */
  private groupByPath(nodes: GraphNode[]): Map<string, GraphNode[]> {
    const groups = new Map<string, GraphNode[]>();
    
    for (const node of nodes) {
      const pathKey = this.extractPathPrefix(node);
      if (!groups.has(pathKey)) {
        groups.set(pathKey, []);
      }
      groups.get(pathKey)!.push(node);
    }
    
    return groups;
  }

  /**
   * Create clusters from a group of nodes
   */
  private createClustersFromGroup(nodes: GraphNode[], startIndex: number): NodeCluster[] {
    const clusters: NodeCluster[] = [];
    
    if (nodes.length >= 3) {
      // Create cluster for 3+ nodes
      const clusterId = `cluster_${startIndex}`;
      const clusterName = defaultLabelExtractor.createClusterLabel(nodes);
      
      clusters.push({
        id: clusterId,
        name: clusterName,
        nodes: nodes,
        count: nodes.length,
        centroid: this.selectCentroid(nodes)
      });
    } else {
      // Keep small groups as individual nodes
      for (const node of nodes) {
        clusters.push({
          id: node.id,
          name: node.label,
          nodes: [node],
          count: 1,
          centroid: node
        });
      }
    }
    
    return clusters;
  }

  /**
   * Extract path prefix for grouping
   */
  private extractPathPrefix(node: GraphNode): string {
    // Try to extract from node ID or label
    if (node.id.includes(':')) {
      const parts = node.id.split(':');
      if (parts.length > 1) {
        // For IDs like "doc:path/to/file", extract directory
        const path = parts[1];
        const pathParts = path.split('/');
        if (pathParts.length > 1) {
          return pathParts.slice(0, -1).join('/'); // Directory
        }
      }
    }
    
    // Default grouping by type
    return node.type;
  }

  /**
   * Select centroid (most representative node) from a cluster
   */
  private selectCentroid(nodes: GraphNode[]): GraphNode {
    // Select node with highest score
    let best = nodes[0];
    let bestScore = best.score || 0;
    
    for (const node of nodes) {
      const score = node.score || 0;
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    
    return best;
  }

  /**
   * Check if graph needs LOD
   */
  needsLOD(graph: Graph): boolean {
    return graph.nodes.length > 30; // Detailed threshold
  }

  /**
   * Get LOD statistics
   */
  getLODStats(graph: Graph): {
    level: DetailLevel;
    originalNodes: number;
    originalEdges: number;
    currentNodes: number;
    currentEdges: number;
    reductionPercent: number;
  } {
    const level = this.getDetailLevel(graph.nodes.length);
    const simplified = this.applyLOD(graph);
    
    const reductionPercent = graph.nodes.length > 0
      ? ((graph.nodes.length - simplified.nodes.length) / graph.nodes.length) * 100
      : 0;
    
    return {
      level,
      originalNodes: graph.nodes.length,
      originalEdges: graph.edges.length,
      currentNodes: simplified.nodes.length,
      currentEdges: simplified.edges.length,
      reductionPercent
    };
  }

  /**
   * Expand a cluster to show its member nodes
   */
  expandCluster(clusterId: string, allNodes: GraphNode[]): GraphNode[] {
    // In a real implementation, this would retrieve nodes from the cluster
    // For now, return nodes whose IDs suggest they belong to this cluster
    return allNodes.filter(node => 
      node.id.startsWith(clusterId) || node.type === 'Cluster'
    );
  }
}

/**
 * Default LOD manager instance
 */
export const defaultLODManager = new LODManager();
