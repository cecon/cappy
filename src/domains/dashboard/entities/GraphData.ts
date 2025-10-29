/**
 * @fileoverview Graph Data aggregate root - Core domain model for the entire graph
 * @module domains/dashboard/entities/GraphData
 * @author Cappy Team
 * @since 3.0.0
 */

import type {
  GraphData as IGraphData,
  GraphStatistics,
  GraphFilter,
  NodeType,
  EdgeType
} from '../types';
import { GraphNode } from './GraphNode';
import { GraphEdge } from './GraphEdge';

/**
 * Graph Data aggregate root representing the complete knowledge graph
 * 
 * This is the main aggregate that coordinates all graph operations and
 * maintains consistency across nodes and edges.
 * 
 * @example
 * ```typescript
 * const graphData = new GraphData();
 * 
 * const node = new GraphNode({...});
 * graphData.addNode(node);
 * 
 * const edge = new GraphEdge({...});
 * graphData.addEdge(edge);
 * 
 * const filtered = graphData.filter({
 *   nodeTypes: ['document', 'entity']
 * });
 * ```
 */
export class GraphData implements IGraphData {
  private _nodes: Map<string, GraphNode>;
  private _edges: Map<string, GraphEdge>;
  private _lastUpdated: string;

  /**
   * Creates a new GraphData instance
   * 
   * @param nodes - Initial nodes (optional)
   * @param edges - Initial edges (optional)
   */
  constructor(nodes: GraphNode[] = [], edges: GraphEdge[] = []) {
    this._nodes = new Map();
    this._edges = new Map();
    this._lastUpdated = new Date().toISOString();

    // Add initial nodes and edges
    nodes.forEach(node => this.addNode(node));
    edges.forEach(edge => this.addEdge(edge));
  }

  /**
   * Gets all nodes as an array
   */
  public get nodes(): GraphNode[] {
    return Array.from(this._nodes.values());
  }

  /**
   * Gets all edges as an array
   */
  public get edges(): GraphEdge[] {
    return Array.from(this._edges.values());
  }

  /**
   * Gets the last updated timestamp
   */
  public get lastUpdated(): string {
    return this._lastUpdated;
  }

  /**
   * Gets current graph statistics
   */
  public get statistics(): GraphStatistics {
    return this.calculateStatistics();
  }

  /**
   * Adds a node to the graph
   * 
   * @param node - Node to add
   * @throws {Error} If node with same ID already exists
   */
  public addNode(node: GraphNode): void {
    if (this._nodes.has(node.id)) {
      throw new Error(`Node with ID '${node.id}' already exists`);
    }

    this._nodes.set(node.id, node);
    this.updateTimestamp();
  }

  /**
   * Removes a node from the graph
   * 
   * @param nodeId - ID of node to remove
   * @returns True if node was removed, false if not found
   */
  public removeNode(nodeId: string): boolean {
    const node = this._nodes.get(nodeId);
    if (!node) {
      return false;
    }

    // Remove all edges connected to this node
    const connectedEdges = this.getEdgesForNode(nodeId);
    connectedEdges.forEach(edge => this.removeEdge(edge.id));

    // Remove the node
    this._nodes.delete(nodeId);
    this.updateTimestamp();
    return true;
  }

  /**
   * Gets a node by ID
   * 
   * @param nodeId - Node ID
   * @returns Node if found, undefined otherwise
   */
  public getNode(nodeId: string): GraphNode | undefined {
    return this._nodes.get(nodeId);
  }

  /**
   * Checks if a node exists
   * 
   * @param nodeId - Node ID
   * @returns True if node exists
   */
  public hasNode(nodeId: string): boolean {
    return this._nodes.has(nodeId);
  }

  /**
   * Adds an edge to the graph
   * 
   * @param edge - Edge to add
   * @throws {Error} If edge with same ID already exists or nodes don't exist
   */
  public addEdge(edge: GraphEdge): void {
    if (this._edges.has(edge.id)) {
      throw new Error(`Edge with ID '${edge.id}' already exists`);
    }

    // Validate that source and target nodes exist
    if (!this._nodes.has(edge.source)) {
      throw new Error(`Source node '${edge.source}' does not exist`);
    }
    if (!this._nodes.has(edge.target)) {
      throw new Error(`Target node '${edge.target}' does not exist`);
    }

    this._edges.set(edge.id, edge);
    this.updateNodeConnections(edge.source);
    this.updateNodeConnections(edge.target);
    this.updateTimestamp();
  }

  /**
   * Removes an edge from the graph
   * 
   * @param edgeId - ID of edge to remove
   * @returns True if edge was removed, false if not found
   */
  public removeEdge(edgeId: string): boolean {
    const edge = this._edges.get(edgeId);
    if (!edge) {
      return false;
    }

    this._edges.delete(edgeId);
    this.updateNodeConnections(edge.source);
    this.updateNodeConnections(edge.target);
    this.updateTimestamp();
    return true;
  }

  /**
   * Gets an edge by ID
   * 
   * @param edgeId - Edge ID
   * @returns Edge if found, undefined otherwise
   */
  public getEdge(edgeId: string): GraphEdge | undefined {
    return this._edges.get(edgeId);
  }

  /**
   * Checks if an edge exists
   * 
   * @param edgeId - Edge ID
   * @returns True if edge exists
   */
  public hasEdge(edgeId: string): boolean {
    return this._edges.has(edgeId);
  }

  /**
   * Gets all edges connected to a node
   * 
   * @param nodeId - Node ID
   * @returns Array of connected edges
   */
  public getEdgesForNode(nodeId: string): GraphEdge[] {
    return this.edges.filter(edge => edge.isIncidentTo(nodeId));
  }

  /**
   * Gets all neighbor nodes of a given node
   * 
   * @param nodeId - Node ID
   * @returns Array of neighbor nodes
   */
  public getNeighbors(nodeId: string): GraphNode[] {
    const neighborIds = new Set<string>();
    
    this.getEdgesForNode(nodeId).forEach(edge => {
      const otherEnd = edge.getOtherEnd(nodeId);
      if (otherEnd) {
        neighborIds.add(otherEnd);
      }
    });

    return Array.from(neighborIds)
      .map(id => this._nodes.get(id))
      .filter((node): node is GraphNode => node !== undefined);
  }

  /**
   * Updates connection metrics for a node
   * 
   * @param nodeId - Node ID
   */
  private updateNodeConnections(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (!node) return;

    const edges = this.getEdgesForNode(nodeId);
    let incoming = 0;
    let outgoing = 0;

    edges.forEach(edge => {
      if (edge.target === nodeId) {
        incoming++;
      }
      if (edge.source === nodeId) {
        outgoing++;
      }
      // For bidirectional edges, count both directions
      if (edge.bidirectional) {
        if (edge.source === nodeId) incoming++;
        if (edge.target === nodeId) outgoing++;
      }
    });

    node.updateConnections({ incoming, outgoing });
  }

  /**
   * Filters the graph based on criteria
   * 
   * @param filter - Filter criteria
   * @returns New GraphData instance with filtered data
   */
  public filter(filter: GraphFilter): GraphData {
    let filteredNodes = this.nodes;
    let filteredEdges = this.edges;

    // Filter by node types
    if (filter.nodeTypes && filter.nodeTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        filter.nodeTypes!.includes(node.type)
      );
    }

    // Filter by edge types
    if (filter.edgeTypes && filter.edgeTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge => 
        filter.edgeTypes!.includes(edge.type)
      );
    }

    // Filter by confidence
    if (filter.minConfidence !== undefined) {
      filteredNodes = filteredNodes.filter(node => 
        node.confidence >= filter.minConfidence!
      );
      filteredEdges = filteredEdges.filter(edge => 
        edge.confidence >= filter.minConfidence!
      );
    }

    // Filter by date range
    if (filter.dateRange) {
      const start = new Date(filter.dateRange.start);
      const end = new Date(filter.dateRange.end);
      
      filteredNodes = filteredNodes.filter(node => {
        const created = new Date(node.created);
        return created >= start && created <= end;
      });
      
      filteredEdges = filteredEdges.filter(edge => {
        const created = new Date(edge.created);
        return created >= start && created <= end;
      });
    }

    // Filter by search query
    if (filter.searchQuery) {
      filteredNodes = filteredNodes.filter(node => 
        node.matchesSearch(filter.searchQuery!)
      );
      filteredEdges = filteredEdges.filter(edge => 
        edge.matchesSearch(filter.searchQuery!)
      );
    }

    // Filter by minimum connections
    if (filter.minConnections !== undefined) {
      filteredNodes = filteredNodes.filter(node => 
        node.connections.total >= filter.minConnections!
      );
    }

    // Only include edges where both nodes are in the filtered set
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    filteredEdges = filteredEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return new GraphData(filteredNodes, filteredEdges);
  }

  /**
   * Searches for nodes and edges matching a query
   * 
   * @param query - Search query
   * @returns Object with matching nodes and edges
   */
  public search(query: string): {
    nodes: GraphNode[];
    edges: GraphEdge[];
  } {
    const matchingNodes = this.nodes.filter(node => node.matchesSearch(query));
    const matchingEdges = this.edges.filter(edge => edge.matchesSearch(query));

    return {
      nodes: matchingNodes,
      edges: matchingEdges
    };
  }

  /**
   * Clears all nodes and edges
   */
  public clear(): void {
    this._nodes.clear();
    this._edges.clear();
    this.updateTimestamp();
  }

  /**
   * Gets nodes by type
   * 
   * @param type - Node type
   * @returns Array of nodes of the specified type
   */
  public getNodesByType(type: NodeType): GraphNode[] {
    return this.nodes.filter(node => node.type === type);
  }

  /**
   * Gets edges by type
   * 
   * @param type - Edge type
   * @returns Array of edges of the specified type
   */
  public getEdgesByType(type: EdgeType): GraphEdge[] {
    return this.edges.filter(edge => edge.type === type);
  }

  /**
   * Calculates current graph statistics
   */
  private calculateStatistics(): GraphStatistics {
    const nodes = this.nodes;
    const edges = this.edges;

    // Count nodes by type
    const nodesByType = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<NodeType, number>);

    // Count edges by type
    const edgesByType = edges.reduce((acc, edge) => {
      acc[edge.type] = (acc[edge.type] || 0) + 1;
      return acc;
    }, {} as Record<EdgeType, number>);

    // Calculate average confidence
    const totalConfidence = nodes.reduce((sum, node) => sum + node.confidence, 0) +
                           edges.reduce((sum, edge) => sum + edge.confidence, 0);
    const avgConfidence = totalConfidence / (nodes.length + edges.length) || 0;

    // Calculate date range
    const allDates = [
      ...nodes.map(node => new Date(node.created).getTime()),
      ...edges.map(edge => new Date(edge.created).getTime())
    ].filter(date => !isNaN(date));

    const dateRange = allDates.length > 0 ? {
      min: new Date(Math.min(...allDates)).toISOString(),
      max: new Date(Math.max(...allDates)).toISOString()
    } : null;

    // Calculate graph density
    const maxPossibleEdges = nodes.length * (nodes.length - 1) / 2;
    const density = maxPossibleEdges > 0 ? edges.length / maxPossibleEdges : 0;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType,
      edgesByType,
      avgConfidence,
      dateRange,
      density
    };
  }

  /**
   * Updates the last updated timestamp
   */
  private updateTimestamp(): void {
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Converts the graph to a plain object for serialization
   */
  public toJSON(): IGraphData {
    return {
      nodes: this.nodes.map(node => node.toJSON()),
      edges: this.edges.map(edge => edge.toJSON()),
      statistics: this.statistics,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Creates a GraphData instance from a plain object
   * 
   * @param data - Plain object data
   * @returns New GraphData instance
   */
  public static fromJSON(data: IGraphData): GraphData {
    const nodes = data.nodes.map(nodeData => new GraphNode(nodeData));
    const edges = data.edges.map(edgeData => new GraphEdge(edgeData));
    
    return new GraphData(nodes, edges);
  }
}