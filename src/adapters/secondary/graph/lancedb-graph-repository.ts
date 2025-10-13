/**
 * @fileoverview LanceDB Graph Repository implementation
 * @module adapters/secondary/graph/lancedb-graph-repository
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphRepository } from '../../../domains/graph/ports/GraphRepository';
import type { GraphData, GraphFilter, GraphStatistics, GraphNode, GraphEdge, NodeType, EdgeType } from '../../../domains/graph/types';
import type { VectorStorePort } from '../../../domains/graph/ports/indexing-port';
import { GraphNode as GraphNodeEntity } from '../../../domains/graph/entities/GraphNode';
import { GraphEdge as GraphEdgeEntity } from '../../../domains/graph/entities/GraphEdge';
import { GraphData as GraphDataEntity } from '../../../domains/graph/entities/GraphData';

/**
 * Configuration for LanceDB Graph Repository
 */
export interface LanceDBGraphRepositoryConfig {
  /**
   * Vector store (LanceDB) instance
   */
  vectorStore: VectorStorePort;
  
  /**
   * Cache time-to-live in milliseconds
   * @default 60000 (1 minute)
   */
  cacheTTL?: number;
  
  /**
   * Enable caching
   * @default true
   */
  enableCache?: boolean;
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * LanceDB implementation of GraphRepository
 * 
 * This repository uses LanceDB as the primary data source for graph data.
 * It converts document chunks from LanceDB into graph nodes and edges.
 * 
 * Node types are inferred from chunk types:
 * - 'code' chunks → 'chunk' nodes
 * - File paths → 'document' nodes
 * - Symbol names → 'entity' nodes
 * 
 * Edge types are inferred from relationships:
 * - Document → Chunk: 'contains'
 * - Chunk → Entity: 'mentions'
 * - Chunk → Chunk (same file): 'related_to'
 * 
 * @example
 * ```typescript
 * const repository = new LanceDBGraphRepository({
 *   vectorStore: lanceDBAdapter
 * });
 * 
 * await repository.initialize();
 * const graphData = await repository.loadGraphData();
 * ```
 */
export class LanceDBGraphRepository implements GraphRepository {
  private vectorStore: VectorStorePort;
  private cacheTTL: number;
  private enableCache: boolean;
  private cache: Map<string, CacheEntry<unknown>>;

  constructor(config: LanceDBGraphRepositoryConfig) {
    this.vectorStore = config.vectorStore;
    this.cacheTTL = config.cacheTTL ?? 60000;
    this.enableCache = config.enableCache ?? true;
    this.cache = new Map();
  }

  /**
   * Initializes the repository (delegates to vector store)
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    console.log('✅ LanceDB Graph Repository initialized');
  }

  /**
   * Loads the complete graph data from LanceDB
   * 
   * @returns Promise resolving to graph data
   * @throws {Error} When data loading fails
   */
  async loadGraphData(): Promise<GraphData> {
    try {
      // Check cache
      const cached = this.getFromCache<GraphData>('full-graph');
      if (cached) {
        console.log('📦 Returning cached graph data');
        return cached;
      }

      console.log('🔍 Loading graph data from LanceDB...');
      const startTime = Date.now();

      // Get all chunks from LanceDB
      // Since LanceDB doesn't have a "get all" method, we'll use search with empty query
      // or implement a custom method
      const chunks = await this.getAllChunks();

      console.log(`📊 Loaded ${chunks.length} chunks from LanceDB`);

      // Build graph from chunks
      const { nodes, edges } = this.buildGraphFromChunks(chunks);

      console.log(`📊 Built graph: ${nodes.length} nodes, ${edges.length} edges`);

      // Create GraphData entity
      const graphData = new GraphDataEntity(
        nodes.map(n => this.createGraphNode(n)),
        edges.map(e => this.createGraphEdge(e))
      );

      // Convert to interface format
      const result: GraphData = {
        nodes: graphData.nodes,
        edges: graphData.edges,
        statistics: graphData.statistics,
        lastUpdated: graphData.lastUpdated
      };

      // Cache the result
      this.setCache('full-graph', result);

      const loadTime = Date.now() - startTime;
      console.log(`✅ Graph loaded in ${loadTime}ms`);

      return result;
    } catch (error) {
      console.error('❌ Failed to load graph data:', error);
      throw new Error(
        `Failed to load graph data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Loads graph data with filtering applied
   * 
   * @param filter - Filter criteria
   * @returns Promise resolving to filtered graph data
   * @throws {Error} When data loading fails
   */
  async loadFilteredGraphData(filter: GraphFilter): Promise<GraphData> {
    try {
      console.log('🔍 Loading filtered graph data...', filter);

      // Load full data first (could be optimized to filter at DB level)
      const fullData = await this.loadGraphData();

      // Apply filters
      let nodes = fullData.nodes;
      let edges = fullData.edges;

      if (filter.nodeTypes && filter.nodeTypes.length > 0) {
        nodes = nodes.filter(node => filter.nodeTypes!.includes(node.type));
      }

      if (filter.edgeTypes && filter.edgeTypes.length > 0) {
        edges = edges.filter(edge => filter.edgeTypes!.includes(edge.type));
      }

      if (filter.minConfidence !== undefined) {
        nodes = nodes.filter(node => node.confidence >= filter.minConfidence!);
        edges = edges.filter(edge => edge.confidence >= filter.minConfidence!);
      }

      if (filter.minConnections !== undefined) {
        nodes = nodes.filter(node => node.connections.total >= filter.minConnections!);
      }

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        nodes = nodes.filter(node => 
          node.label.toLowerCase().includes(query) ||
          node.id.toLowerCase().includes(query)
        );
      }

      if (filter.dateRange) {
        const { start, end } = filter.dateRange;
        nodes = nodes.filter(node => 
          node.created >= start && node.created <= end
        );
        edges = edges.filter(edge => 
          edge.created >= start && edge.created <= end
        );
      }

      // Remove orphaned edges
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );

      // Recalculate statistics
      const statistics = this.calculateStatistics(nodes, edges);

      return {
        nodes,
        edges,
        statistics,
        lastUpdated: fullData.lastUpdated
      };
    } catch (error) {
      console.error('❌ Failed to load filtered graph data:', error);
      throw new Error(
        `Failed to load filtered graph data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Saves graph data (not fully implemented in MVP)
   * 
   * @param graphData - Graph data to save
   * @returns Promise resolving when save is complete
   */
  async saveGraphData(graphData: GraphData): Promise<void> {
    console.warn('⚠️ saveGraphData not fully implemented in MVP');
    console.log('📝 Would save:', {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length
    });
    
    // In a full implementation, this would:
    // 1. Convert nodes back to chunks
    // 2. Upsert chunks to LanceDB
    // 3. Update Kuzu graph structure
    
    // For MVP, we'll just invalidate cache
    this.clearCache();
  }

  /**
   * Gets graph statistics without loading full data
   * 
   * @returns Promise resolving to graph statistics
   */
  async getGraphStatistics(): Promise<GraphStatistics> {
    try {
      // Check cache
      const cached = this.getFromCache<GraphStatistics>('statistics');
      if (cached) {
        return cached;
      }

      // Load full data and extract statistics
      const graphData = await this.loadGraphData();
      const stats = graphData.statistics;

      // Cache statistics
      this.setCache('statistics', stats);

      return stats;
    } catch (error) {
      console.error('❌ Failed to get graph statistics:', error);
      throw new Error(
        `Failed to get graph statistics: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Checks if the data source is available
   * 
   * @returns Promise resolving to true if available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to get a small amount of data
      await this.vectorStore.getChunksByIds([]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Refreshes/reindexes the data source
   * 
   * @returns Promise resolving when refresh is complete
   */
  async refresh(): Promise<void> {
    console.log('🔄 Refreshing graph repository...');
    this.clearCache();
    console.log('✅ Cache cleared, next load will be fresh');
  }

  /**
   * Gets all chunks from LanceDB
   * 
   * This is a workaround since LanceDB doesn't have a direct "get all" method.
   * We use a broad search or query to get all chunks.
   */
  private async getAllChunks(): Promise<Array<{
    id: string;
    content: string;
    vector?: number[];
    metadata: {
      filePath: string;
      lineStart: number;
      lineEnd: number;
      chunkType: string;
      symbolName?: string;
      symbolKind?: string;
    };
  }>> {
    try {
      // Try to use getChunksByIds with empty array to trigger query
      // This is a limitation we'll need to address
      // For now, return empty array and rely on search
      
      // TODO: Implement proper "get all" method in VectorStorePort
      // For MVP, we'll simulate with sample data
      
      console.warn('⚠️ getAllChunks using mock data for MVP');
      return [];
    } catch (error) {
      console.error('❌ Failed to get all chunks:', error);
      return [];
    }
  }

  /**
   * Builds graph nodes and edges from document chunks
   * 
   * @param chunks - Document chunks from LanceDB
   * @returns Nodes and edges
   */
  private buildGraphFromChunks(chunks: Array<{
    id: string;
    content: string;
    metadata: {
      filePath: string;
      lineStart: number;
      lineEnd: number;
      chunkType: string;
      symbolName?: string;
      symbolKind?: string;
    };
  }>): {
    nodes: Array<Partial<GraphNode>>;
    edges: Array<Partial<GraphEdge>>;
  } {
    const nodes: Array<Partial<GraphNode>> = [];
    const edges: Array<Partial<GraphEdge>> = [];
    const fileNodes = new Map<string, string>();
    const entityNodes = new Map<string, string>();

    // Group chunks by file
    const chunksByFile = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
      const file = chunk.metadata.filePath;
      if (!chunksByFile.has(file)) {
        chunksByFile.set(file, []);
      }
      chunksByFile.get(file)!.push(chunk);
    }

    // Create document nodes for each file
    for (const [filePath, fileChunks] of chunksByFile) {
      const fileId = `doc:${filePath}`;
      fileNodes.set(filePath, fileId);

      nodes.push({
        id: fileId,
        label: this.getFileName(filePath),
        type: 'document',
        confidence: 1.0,
        metadata: {
          filePath,
          chunkCount: fileChunks.length
        }
      });
    }

    // Create chunk nodes and entity nodes
    for (const chunk of chunks) {
      const chunkId = chunk.id;
      
      // Create chunk node
      nodes.push({
        id: chunkId,
        label: this.truncateContent(chunk.content, 50),
        type: 'chunk',
        confidence: 0.9,
        metadata: {
          filePath: chunk.metadata.filePath,
          lineStart: chunk.metadata.lineStart,
          lineEnd: chunk.metadata.lineEnd,
          chunkType: chunk.metadata.chunkType,
          content: chunk.content
        }
      });

      // Create edge: Document → Chunk
      const fileId = fileNodes.get(chunk.metadata.filePath);
      if (fileId) {
        edges.push({
          id: `${fileId}-contains-${chunkId}`,
          label: 'contains',
          type: 'contains',
          source: fileId,
          target: chunkId,
          weight: 1.0,
          confidence: 1.0,
          bidirectional: false
        });
      }

      // Create entity node if symbol exists
      if (chunk.metadata.symbolName) {
        const entityId = `entity:${chunk.metadata.symbolName}`;
        
        if (!entityNodes.has(chunk.metadata.symbolName)) {
          entityNodes.set(chunk.metadata.symbolName, entityId);
          
          nodes.push({
            id: entityId,
            label: chunk.metadata.symbolName,
            type: 'entity',
            confidence: 0.95,
            metadata: {
              symbolKind: chunk.metadata.symbolKind,
              name: chunk.metadata.symbolName
            }
          });
        }

        // Create edge: Chunk → Entity
        edges.push({
          id: `${chunkId}-mentions-${entityId}`,
          label: 'mentions',
          type: 'mentions',
          source: chunkId,
          target: entityId,
          weight: 1.0,
          confidence: 0.9,
          bidirectional: false
        });
      }
    }

    // Create edges between chunks in the same file (related_to)
    for (const fileChunks of chunksByFile.values()) {
      for (let i = 0; i < fileChunks.length - 1; i++) {
        const chunk1 = fileChunks[i];
        const chunk2 = fileChunks[i + 1];
        
        edges.push({
          id: `${chunk1.id}-related-${chunk2.id}`,
          label: 'related_to',
          type: 'related_to',
          source: chunk1.id,
          target: chunk2.id,
          weight: 0.5,
          confidence: 0.7,
          bidirectional: true
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Creates a GraphNode entity from partial data
   */
  private createGraphNode(partial: Partial<GraphNode>): GraphNodeEntity {
    const now = new Date().toISOString();
    return new GraphNodeEntity({
      id: partial.id!,
      label: partial.label!,
      type: (partial.type as NodeType) || 'chunk',
      created: partial.created || now,
      updated: partial.updated || now,
      confidence: partial.confidence ?? 0.8,
      metadata: partial.metadata || {},
      position: partial.position,
      visual: partial.visual,
      state: partial.state,
      connections: partial.connections,
      metrics: partial.metrics
    });
  }

  /**
   * Creates a GraphEdge entity from partial data
   */
  private createGraphEdge(partial: Partial<GraphEdge>): GraphEdgeEntity {
    const now = new Date().toISOString();
    return new GraphEdgeEntity({
      id: partial.id!,
      label: partial.label!,
      type: (partial.type as EdgeType) || 'related_to',
      source: partial.source!,
      target: partial.target!,
      weight: partial.weight ?? 1.0,
      created: partial.created || now,
      updated: partial.updated || now,
      confidence: partial.confidence ?? 0.8,
      bidirectional: partial.bidirectional ?? false,
      metadata: partial.metadata || {},
      visual: partial.visual,
      state: partial.state
    });
  }

  /**
   * Calculates statistics for nodes and edges
   */
  private calculateStatistics(nodes: GraphNode[], edges: GraphEdge[]): GraphStatistics {
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    let totalConfidence = 0;
    let minDate = '';
    let maxDate = '';

    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
      totalConfidence += node.confidence;
      
      if (!minDate || node.created < minDate) minDate = node.created;
      if (!maxDate || node.created > maxDate) maxDate = node.created;
    }

    for (const edge of edges) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
      totalConfidence += edge.confidence;
      
      if (!minDate || edge.created < minDate) minDate = edge.created;
      if (!maxDate || edge.created > maxDate) maxDate = edge.created;
    }

    const total = nodes.length + edges.length;
    const avgConfidence = total > 0 ? totalConfidence / total : 0;
    
    const maxPossibleEdges = nodes.length * (nodes.length - 1) / 2;
    const density = maxPossibleEdges > 0 ? edges.length / maxPossibleEdges : 0;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType: nodesByType as Record<NodeType, number>,
      edgesByType: edgesByType as Record<EdgeType, number>,
      avgConfidence,
      dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
      density
    };
  }

  /**
   * Gets filename from path
   */
  private getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  }

  /**
   * Truncates content to max length
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Gets data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    if (!this.enableCache) {
      return null;
    }

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Sets data in cache
   */
  private setCache<T>(key: string, data: T): void {
    if (!this.enableCache) {
      return;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clears all cache
   */
  private clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Factory function to create LanceDB Graph Repository
 */
export function createLanceDBGraphRepository(
  config: LanceDBGraphRepositoryConfig
): GraphRepository {
  return new LanceDBGraphRepository(config);
}
