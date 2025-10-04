/**
 * LightGraph implementation for Mini-LightRAG system
 * Manages semantic relationships between chunks through nodes and edges
 */

import { Chunk, GraphNode, GraphEdge, NodeType, EdgeType, NodeProperties } from './schemas';
import { LanceDBStore } from '../store/lancedb';
import { EmbeddingService } from './embeddings';

/**
 * Configuration for graph building
 */
export interface GraphConfig {
    /** Minimum similarity threshold for creating edges */
    similarityThreshold: number;
    /** Maximum edges per node */
    maxEdgesPerNode: number;
    /** Enable bidirectional edges */
    bidirectional: boolean;
    /** Edge weight calculation method */
    edgeWeight: 'cosine' | 'jaccard' | 'combined';
}

/**
 * Default graph configuration
 */
export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
    similarityThreshold: 0.3,
    maxEdgesPerNode: 10,
    bidirectional: true,
    edgeWeight: 'cosine'
};

/**
 * Extended node for internal processing (with embeddings)
 */
interface ExtendedNode extends GraphNode {
    embedding: number[];
    keywords: string[];
    chunkData: Chunk;
}

/**
 * Graph analysis result
 */
export interface GraphAnalysis {
    totalNodes: number;
    totalEdges: number;
    avgDegree: number;
    connectedComponents: number;
}

/**
 * LightGraph service for managing semantic relationships
 */
export class LightGraphService {
    private readonly config: GraphConfig;
    private readonly lancedbStore: LanceDBStore;
    private readonly embeddingService: EmbeddingService;
    private isInitialized = false;

    constructor(
        lancedbStore: LanceDBStore,
        embeddingService: EmbeddingService,
        config: GraphConfig = DEFAULT_GRAPH_CONFIG
    ) {
        this.config = { ...config };
        this.lancedbStore = lancedbStore;
        this.embeddingService = embeddingService;
    }

    /**
     * Initialize the graph service
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.lancedbStore.initialize();
        await this.embeddingService.initialize();

        this.isInitialized = true;
        console.log('✅ LightGraph service initialized');
    }

    /**
     * Build graph from chunks by finding semantic relationships
     */
    async buildGraph(chunks: Chunk[]): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
        await this.initialize();

        if (chunks.length === 0) {
            return { nodes: [], edges: [] };
        }

        console.log(`🔗 Building graph from ${chunks.length} chunks...`);

        // Create extended nodes for processing
        const extendedNodes = this.createExtendedNodesFromChunks(chunks);

        // Find edges by computing similarities
        const edges = await this.findEdges(extendedNodes);

        // Apply graph optimizations
        const optimizedEdges = this.optimizeEdges(edges);

        // Convert back to regular nodes
        const nodes = extendedNodes.map(node => this.toGraphNode(node));

        console.log(`📊 Graph built: ${nodes.length} nodes, ${optimizedEdges.length} edges`);

        return { nodes, edges: optimizedEdges };
    }

    /**
     * Create extended nodes from chunks (includes embeddings for processing)
     */
    private createExtendedNodesFromChunks(chunks: Chunk[]): ExtendedNode[] {
        return chunks.map(chunk => ({
            id: chunk.id,
            type: this.inferNodeType(chunk),
            label: this.extractTitle(chunk),
            properties: this.createNodeProperties(chunk),
            chunkIds: [chunk.id],
            updatedAt: chunk.updatedAt,
            // Extended fields for processing
            embedding: chunk.vector || [],
            keywords: chunk.keywords,
            chunkData: chunk
        }));
    }

    /**
     * Convert extended node to regular GraphNode
     */
    private toGraphNode(extendedNode: ExtendedNode): GraphNode {
        return {
            id: extendedNode.id,
            type: extendedNode.type,
            label: extendedNode.label,
            properties: extendedNode.properties,
            chunkIds: extendedNode.chunkIds,
            updatedAt: extendedNode.updatedAt
        };
    }

    /**
     * Infer node type from chunk
     */
    private inferNodeType(chunk: Chunk): NodeType {
        if (chunk.type === 'markdown-section') {
            return 'section';
        }
        if (chunk.type.startsWith('code-')) {
            return 'symbol';
        }
        return 'document';
    }

    /**
     * Create node properties from chunk
     */
    private createNodeProperties(chunk: Chunk): NodeProperties {
        const properties: NodeProperties = {
            path: chunk.path,
            language: chunk.language
        };

        // Add symbol information for code chunks
        if (chunk.type.startsWith('code-')) {
            const symbolName = this.extractSymbolName(chunk);
            if (symbolName) {
                properties.symbolInfo = {
                    name: symbolName,
                    kind: chunk.type.replace('code-', ''),
                    signature: chunk.text.split('\n')[0] // First line as signature
                };
            }
        }

        return properties;
    }

    /**
     * Extract symbol name from chunk
     */
    private extractSymbolName(chunk: Chunk): string | undefined {
        const text = chunk.text.trim();
        
        // Function pattern
        const funcMatch = text.match(/(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/); 
        if (funcMatch) {
            return funcMatch[1];
        }

        // Class pattern
        const classMatch = text.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (classMatch) {
            return classMatch[1];
        }

        // Interface pattern
        const interfaceMatch = text.match(/interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (interfaceMatch) {
            return interfaceMatch[1];
        }

        return undefined;
    }

    /**
     * Extract title from chunk
     */
    private extractTitle(chunk: Chunk): string {
        const text = chunk.text.trim();
        
        // For markdown sections, extract heading
        if (chunk.type === 'markdown-section') {
            const headingMatch = text.match(/^#+\s*(.+)$/m);
            if (headingMatch) {
                return headingMatch[1].trim();
            }
        }

        // For code chunks, extract function/class name
        const symbolName = this.extractSymbolName(chunk);
        if (symbolName) {
            return symbolName;
        }

        // Default: use first line or truncated text
        const firstLine = text.split('\n')[0];
        return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    }

    /**
     * Find edges between nodes based on similarity
     */
    private async findEdges(nodes: ExtendedNode[]): Promise<GraphEdge[]> {
        const edges: GraphEdge[] = [];
        
        console.log(`🔍 Computing similarities for ${nodes.length} nodes...`);

        // Compare each pair of nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];

                // Skip if either node has no embedding
                if (!nodeA.embedding || !nodeB.embedding || 
                    nodeA.embedding.length === 0 || nodeB.embedding.length === 0) {
                    continue;
                }

                // Calculate similarity
                const similarity = this.calculateSimilarity(nodeA, nodeB);

                // Create edge if above threshold
                if (similarity >= this.config.similarityThreshold) {
                    const edgeId = `${nodeA.id}-${nodeB.id}`;
                    
                    edges.push({
                        id: edgeId,
                        sourceId: nodeA.id,
                        targetId: nodeB.id,
                        type: this.inferEdgeType(nodeA, nodeB),
                        weight: similarity,
                        properties: {
                            confidence: similarity
                        },
                        updatedAt: new Date().toISOString()
                    });

                    // Add bidirectional edge if enabled
                    if (this.config.bidirectional) {
                        const reverseEdgeId = `${nodeB.id}-${nodeA.id}`;
                        
                        edges.push({
                            id: reverseEdgeId,
                            sourceId: nodeB.id,
                            targetId: nodeA.id,
                            type: this.inferEdgeType(nodeB, nodeA),
                            weight: similarity,
                            properties: {
                                confidence: similarity
                            },
                            updatedAt: new Date().toISOString()
                        });
                    }
                }
            }
        }

        return edges;
    }

    /**
     * Calculate similarity between two nodes
     */
    private calculateSimilarity(nodeA: ExtendedNode, nodeB: ExtendedNode): number {
        switch (this.config.edgeWeight) {
            case 'cosine':
                return EmbeddingService.cosineSimilarity(nodeA.embedding, nodeB.embedding);
                
            case 'jaccard':
                return this.jaccardSimilarity(nodeA.keywords, nodeB.keywords);
                
            case 'combined': {
                const cosine = EmbeddingService.cosineSimilarity(nodeA.embedding, nodeB.embedding);
                const jaccard = this.jaccardSimilarity(nodeA.keywords, nodeB.keywords);
                return (cosine * 0.7) + (jaccard * 0.3); // Weight cosine more heavily
            }
                
            default:
                return EmbeddingService.cosineSimilarity(nodeA.embedding, nodeB.embedding);
        }
    }

    /**
     * Calculate Jaccard similarity between keyword sets
     */
    private jaccardSimilarity(setA: string[], setB: string[]): number {
        if (setA.length === 0 && setB.length === 0) {
            return 0;
        }

        const intersection = setA.filter(x => setB.includes(x)).length;
        const union = new Set([...setA, ...setB]).size;

        return intersection / union;
    }

    /**
     * Infer edge type based on node types and similarity
     */
    private inferEdgeType(sourceNode: ExtendedNode, targetNode: ExtendedNode): EdgeType {
        // Same type connections
        if (sourceNode.type === targetNode.type) {
            return 'SIMILAR_TO';
        }

        // Specific relationship patterns
        if (sourceNode.type === 'symbol' && targetNode.type === 'symbol') {
            return 'REFERS_TO';
        }
        if (sourceNode.type === 'section' && targetNode.type === 'symbol') {
            return 'MENTIONS_SYMBOL';
        }

        // Default semantic relationship
        return 'SIMILAR_TO';
    }

    /**
     * Optimize edges by limiting connections per node
     */
    private optimizeEdges(edges: GraphEdge[]): GraphEdge[] {
        if (this.config.maxEdgesPerNode <= 0) {
            return edges;
        }

        // Group edges by source node
        const edgesBySource = new Map<string, GraphEdge[]>();
        
        for (const edge of edges) {
            if (!edgesBySource.has(edge.sourceId)) {
                edgesBySource.set(edge.sourceId, []);
            }
            edgesBySource.get(edge.sourceId)!.push(edge);
        }

        // Keep only top N edges per node (by weight)
        const optimizedEdges: GraphEdge[] = [];
        
        for (const nodeEdges of edgesBySource.values()) {
            // Sort by weight descending
            const sortedEdges = nodeEdges.sort((a, b) => b.weight - a.weight);
            
            // Take top N edges
            const topEdges = sortedEdges.slice(0, this.config.maxEdgesPerNode);
            optimizedEdges.push(...topEdges);
        }

        return optimizedEdges;
    }

    /**
     * Persist graph to LanceDB
     */
    async saveGraph(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
        await this.initialize();

        console.log(`💾 Saving graph: ${nodes.length} nodes, ${edges.length} edges...`);

        // Save nodes and edges to LanceDB
        await this.lancedbStore.upsertNodes(nodes);
        await this.lancedbStore.upsertEdges(edges);

        console.log('✅ Graph saved successfully');
    }

    /**
     * Load graph from LanceDB
     */
    async loadGraph(): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
        await this.initialize();

        const nodes = await this.lancedbStore.getAllNodes();
        const edges = await this.lancedbStore.getAllEdges();

        console.log(`📥 Loaded graph: ${nodes.length} nodes, ${edges.length} edges`);

        return { nodes, edges };
    }

    /**
     * Analyze graph structure
     */
    async analyzeGraph(): Promise<GraphAnalysis> {
        const { nodes, edges } = await this.loadGraph();

        const totalNodes = nodes.length;
        const totalEdges = edges.length;
        const avgDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;

        // Build adjacency list for connected components
        const adjacency = new Map<string, Set<string>>();
        for (const node of nodes) {
            adjacency.set(node.id, new Set());
        }
        
        for (const edge of edges) {
            adjacency.get(edge.sourceId)?.add(edge.targetId);
            adjacency.get(edge.targetId)?.add(edge.sourceId);
        }

        // Find connected components using DFS
        const visited = new Set<string>();
        let connectedComponents = 0;

        for (const nodeId of adjacency.keys()) {
            if (!visited.has(nodeId)) {
                this.dfsVisit(nodeId, adjacency, visited);
                connectedComponents++;
            }
        }

        return {
            totalNodes,
            totalEdges,
            avgDegree,
            connectedComponents
        };
    }

    /**
     * DFS helper for connected components
     */
    private dfsVisit(nodeId: string, adjacency: Map<string, Set<string>>, visited: Set<string>): void {
        visited.add(nodeId);
        const neighbors = adjacency.get(nodeId) || new Set();
        
        for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
                this.dfsVisit(neighborId, adjacency, visited);
            }
        }
    }

    /**
     * Get service statistics
     */
    getStats(): any {
        return {
            isInitialized: this.isInitialized,
            config: this.config
        };
    }

    /**
     * Find related nodes in the graph (simplified implementation)
     */
    async findRelatedNodes(nodeId: string, maxHops: number = 1): Promise<GraphNode[]> {
        try {
            // For now, return empty array - will be implemented when graph navigation is ready
            console.log(`🕸️  Would find related nodes for ${nodeId} within ${maxHops} hops`);
            
            // In the future, this would traverse the graph:
            // 1. Start from nodeId
            // 2. Follow edges up to maxHops depth
            // 3. Return unique nodes found
            // 4. Apply relevance scoring
            
            return [];
            
        } catch (error) {
            console.error('Error finding related nodes:', error);
            return [];
        }
    }
}