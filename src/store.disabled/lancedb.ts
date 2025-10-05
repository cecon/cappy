import { connect, Connection, Table } from '@lancedb/lancedb';
import * as fs from 'fs';
import { Chunk } from '../core/schemas';

/**
 * Configuration for LanceDB store
 */
export interface LanceDBConfig {
    /** Database directory path */
    dbPath: string;
    /** Vector dimension for chunks table */
    vectorDimension: number;
    /** Enable write-ahead logging */
    writeMode: 'append' | 'overwrite';
    /** Index configuration */
    indexConfig: {
        metric: 'cosine' | 'l2' | 'dot';
        indexType: 'IVF_PQ' | 'HNSW';
        numPartitions?: number;
        numSubQuantizers?: number;
        m?: number;              // HNSW parameter
        efConstruction?: number; // HNSW parameter
    };
}

/**
 * Default LanceDB configuration
 */
export const DEFAULT_LANCEDB_CONFIG: LanceDBConfig = {
    dbPath: '',  // Will be set by VS Code extension context
    vectorDimension: 384,
    writeMode: 'append',
    indexConfig: {
        metric: 'cosine',
        indexType: 'HNSW',
        m: 16,
        efConstruction: 200
    }
};

/**
 * Schema for chunks table in LanceDB
 */
export interface ChunkRecord extends Record<string, any> {
    /** Unique chunk ID (BLAKE3 hash) */
    id: string;
    /** File path */
    path: string;
    /** Programming language */
    language: string;
    /** Chunk type */
    type: string;
    /** Text hash for change detection */
    textHash: string;
    /** Text content */
    text: string;
    /** Start line number */
    startLine: number;
    /** End line number */
    endLine: number;
    /** Keywords array as JSON string */
    keywords: string;
    /** Metadata as JSON string */
    metadata: string;
    /** Vector embedding */
    vector: number[];
    /** Update timestamp */
    updatedAt: string;
    /** Version number */
    version: number;
}

/**
 * Schema for neighbors table (optional pre-computed similarities)
 */
export interface NeighborRecord extends Record<string, any> {
    /** Source chunk ID */
    sourceId: string;
    /** Target chunk ID */
    targetId: string;
    /** Similarity score */
    similarity: number;
    /** Rank in top-N */
    rank: number;
    /** Update timestamp */
    updatedAt: string;
}

/**
 * Search result from vector query
 */
export interface VectorSearchResult {
    /** Chunk record */
    chunk: ChunkRecord;
    /** Similarity score */
    score: number;
    /** Distance value */
    distance: number;
}

/**
 * LanceDB store for vector operations
 */
export class LanceDBStore {
    private readonly config: LanceDBConfig;
    private connection: Connection | null = null;
    private chunksTable: Table | null = null;
    private neighborsTable: Table | null = null;
    private isInitialized = false;

    constructor(config: LanceDBConfig = DEFAULT_LANCEDB_CONFIG) {
        this.config = { ...config };
    }

    /**
     * Set database path (called by VS Code extension)
     */
    setDbPath(dbPath: string): void {
        this.config.dbPath = dbPath;
    }

    /**
     * Initialize the LanceDB connection and tables
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Ensure database directory exists
            if (!fs.existsSync(this.config.dbPath)) {
                fs.mkdirSync(this.config.dbPath, { recursive: true });
            }

            // Connect to LanceDB
            console.log(`Connecting to LanceDB at: ${this.config.dbPath}`);
            this.connection = await connect(this.config.dbPath);

            // Initialize chunks table
            await this.initializeChunksTable();

            // Initialize neighbors table (optional)
            await this.initializeNeighborsTable();

            this.isInitialized = true;
            console.log('LanceDB store initialized successfully');

        } catch (error) {
            console.error('Failed to initialize LanceDB store:', error);
            throw new Error(`LanceDB initialization failed: ${error}`);
        }
    }

    /**
     * Initialize chunks table with schema
     */
    private async initializeChunksTable(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        try {
            // Check if table exists
            const tableNames = await this.connection.tableNames();
            
            if (tableNames.includes('chunks')) {
                console.log('Loading existing chunks table');
                this.chunksTable = await this.connection.openTable('chunks');
            } else {
                console.log('Creating new chunks table');
                
                // Create sample record to define schema
                const sampleData: ChunkRecord[] = [{
                    id: 'sample',
                    path: '/sample/path.ts',
                    language: 'typescript',
                    type: 'code-function',
                    textHash: 'sample-hash',
                    text: 'function sample() { return true; }',
                    startLine: 1,
                    endLine: 1,
                    keywords: JSON.stringify(['function', 'sample']),
                    metadata: JSON.stringify({}),
                    vector: new Array(this.config.vectorDimension).fill(0),
                    updatedAt: new Date().toISOString(),
                    version: 1
                }];

                this.chunksTable = await this.connection.createTable('chunks', sampleData);
                
                // Remove sample data
                await this.chunksTable.delete("id = 'sample'");
            }

            // Create vector index if not exists
            await this.createVectorIndex();

        } catch (error) {
            console.error('Failed to initialize chunks table:', error);
            throw error;
        }
    }

    /**
     * Initialize neighbors table for pre-computed similarities
     */
    private async initializeNeighborsTable(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        try {
            const tableNames = await this.connection.tableNames();
            
            if (tableNames.includes('neighbors')) {
                this.neighborsTable = await this.connection.openTable('neighbors');
            } else {
                const sampleData: NeighborRecord[] = [{
                    sourceId: 'sample-source',
                    targetId: 'sample-target',
                    similarity: 0.5,
                    rank: 1,
                    updatedAt: new Date().toISOString()
                }];

                this.neighborsTable = await this.connection.createTable('neighbors', sampleData);
                await this.neighborsTable.delete("sourceId = 'sample-source'");
            }

        } catch (error) {
            console.warn('Failed to initialize neighbors table (optional):', error);
            // Neighbors table is optional, don't fail initialization
        }
    }

    /**
     * Create vector index for efficient similarity search
     */
    private async createVectorIndex(): Promise<void> {
        if (!this.chunksTable) {
            return;
        }

        try {
            console.log('Creating vector index...');
            
            await this.chunksTable.createIndex('vector', {
                config: this.config.indexConfig as any
            });

            console.log('Vector index created successfully');

        } catch (error) {
            console.warn('Failed to create vector index:', error);
            // Index creation might fail if table is empty, that's OK
        }
    }

    /**
     * Upsert chunks into the database
     */
    async upsertChunks(chunks: Chunk[]): Promise<void> {
        await this.initialize();
        
        if (!this.chunksTable) {
            throw new Error('Chunks table not initialized');
        }

        try {
            // Convert chunks to records
            const records: ChunkRecord[] = chunks.map(chunk => ({
                id: chunk.id,
                path: chunk.path,
                language: chunk.language,
                type: chunk.type,
                textHash: chunk.textHash,
                text: chunk.text,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                keywords: JSON.stringify(chunk.keywords),
                metadata: JSON.stringify(chunk.metadata),
                vector: chunk.vector || new Array(this.config.vectorDimension).fill(0),
                updatedAt: chunk.updatedAt,
                version: chunk.version
            }));

            // Delete existing chunks with same IDs
            const existingIds = records.map(r => `'${r.id}'`).join(',');
            if (existingIds) {
                await this.chunksTable.delete(`id IN (${existingIds})`);
            }

            // Insert new records
            await this.chunksTable.add(records as Record<string, any>[]);

            console.log(`Upserted ${records.length} chunks`);

        } catch (error) {
            console.error('Failed to upsert chunks:', error);
            throw error;
        }
    }

    /**
     * Perform vector similarity search
     */
    async vectorSearch(
        queryVector: number[], 
        limit: number = 20,
        filters?: Record<string, any>
    ): Promise<VectorSearchResult[]> {
        await this.initialize();
        
        if (!this.chunksTable) {
            throw new Error('Chunks table not initialized');
        }

        try {
            let query = this.chunksTable
                .search(queryVector)
                .limit(limit);

            // Apply filters
            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    if (Array.isArray(value)) {
                        const valueList = value.map(v => `'${v}'`).join(',');
                        query = query.where(`${key} IN (${valueList})`);
                    } else {
                        query = query.where(`${key} = '${value}'`);
                    }
                }
            }

            const results = await query.toArray();

            return results.map((result: any) => ({
                chunk: {
                    id: result.id,
                    path: result.path,
                    language: result.language,
                    type: result.type,
                    textHash: result.textHash,
                    text: result.text,
                    startLine: result.startLine,
                    endLine: result.endLine,
                    keywords: JSON.parse(result.keywords || '[]'),
                    metadata: JSON.parse(result.metadata || '{}'),
                    vector: result.vector,
                    updatedAt: result.updatedAt,
                    version: result.version
                },
                score: result._score || 0,
                distance: result._distance || 0
            }));

        } catch (error) {
            console.error('Vector search failed:', error);
            throw error;
        }
    }

    /**
     * Get chunks by IDs
     */
    async getChunksByIds(ids: string[]): Promise<ChunkRecord[]> {
        await this.initialize();
        
        if (!this.chunksTable) {
            throw new Error('Chunks table not initialized');
        }

        if (ids.length === 0) {
            return [];
        }

        try {
            // Use countRows to check if table has data first
            const count = await this.chunksTable.countRows();
            if (count === 0) {
                return [];
            }

            // For now, we'll get all records and filter in memory
            // This is not ideal for large datasets but works for the initial implementation
            const allResults = await this.chunksTable
                .search(Array(384).fill(0)) // Dummy vector with correct dimension
                .limit(1000) // Reasonable limit
                .toArray();

            const filteredResults = allResults.filter((result: any) => ids.includes(result.id));

            return filteredResults.map((result: any) => ({
                id: result.id,
                path: result.path,
                language: result.language,
                type: result.type,
                textHash: result.textHash,
                text: result.text,
                startLine: result.startLine,
                endLine: result.endLine,
                keywords: JSON.parse(result.keywords || '[]'),
                metadata: JSON.parse(result.metadata || '{}'),
                vector: result.vector,
                updatedAt: result.updatedAt,
                version: result.version
            }));

        } catch (error) {
            console.error('Failed to get chunks by IDs:', error);
            throw error;
        }
    }

    /**
     * Delete chunks by IDs
     */
    async deleteChunks(ids: string[]): Promise<void> {
        await this.initialize();
        
        if (!this.chunksTable || ids.length === 0) {
            return;
        }

        try {
            const idList = ids.map(id => `'${id}'`).join(',');
            await this.chunksTable.delete(`id IN (${idList})`);
            console.log(`Deleted ${ids.length} chunks`);

        } catch (error) {
            console.error('Failed to delete chunks:', error);
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    async getStats(): Promise<{
        chunksCount: number;
        neighborsCount: number;
        dbSize: string;
    }> {
        await this.initialize();

        try {
            const chunksCount = this.chunksTable ? await this.chunksTable.countRows() : 0;
            const neighborsCount = this.neighborsTable ? await this.neighborsTable.countRows() : 0;
            
            // Get database directory size
            let dbSize = '0 MB';
            try {
                const stats = fs.statSync(this.config.dbPath);
                if (stats.isDirectory()) {
                    // This is a rough approximation - actual calculation would require recursion
                    dbSize = '< 1 MB';
                }
            } catch {
                // Ignore size calculation errors
            }

            return { chunksCount, neighborsCount, dbSize };

        } catch (error) {
            console.error('Failed to get database stats:', error);
            return { chunksCount: 0, neighborsCount: 0, dbSize: 'Unknown' };
        }
    }

    // ========== Graph Operations ==========

    /**
     * Query edges from the graph
     */
    async queryEdges(query: {
        source?: string | string[];
        target?: string | string[];
        minWeight?: number;
        edgeTypes?: string[];
        limit?: number;
    }): Promise<Array<{
        id: string;
        source: string;
        target: string;
        type: string;
        weight: number;
    }>> {
        await this.initialize();
        
        if (!this.chunksTable) {
            return [];
        }

        try {
            // Build WHERE clause
            const conditions: string[] = ["path = '/graph/edges'"];
            
            // Parse edges and filter
            const results = await this.chunksTable
                .search(new Array(this.config.vectorDimension).fill(0))
                .where(conditions.join(' AND '))
                .limit(query.limit || 1000)
                .toArray();

            // Parse and filter edges
            let edges = results.map((result: any) => {
                const edge = JSON.parse(result.text);
                return {
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    type: edge.type,
                    weight: edge.weight
                };
            });

            // Apply filters in memory (since LanceDB doesn't support complex JSON queries)
            if (query.source) {
                const sources = Array.isArray(query.source) ? query.source : [query.source];
                edges = edges.filter(e => sources.includes(e.source));
            }

            if (query.target) {
                const targets = Array.isArray(query.target) ? query.target : [query.target];
                edges = edges.filter(e => targets.includes(e.target));
            }

            if (query.minWeight !== undefined) {
                edges = edges.filter(e => e.weight >= query.minWeight!);
            }

            if (query.edgeTypes && query.edgeTypes.length > 0) {
                edges = edges.filter(e => query.edgeTypes!.includes(e.type));
            }

            // Sort by weight descending
            edges.sort((a, b) => b.weight - a.weight);

            // Apply limit
            if (query.limit) {
                edges = edges.slice(0, query.limit);
            }

            return edges;

        } catch (error) {
            console.error('Failed to query edges:', error);
            return [];
        }
    }

    /**
     * Query nodes by their IDs
     */
    async queryNodesByIds(ids: string[]): Promise<Array<{
        id: string;
        type: string;
        label?: string;
        path?: string;
        score?: number;
    }>> {
        await this.initialize();
        
        if (!this.chunksTable || ids.length === 0) {
            return [];
        }

        try {
            // Get all graph nodes
            const results = await this.chunksTable
                .search(new Array(this.config.vectorDimension).fill(0))
                .where("path = '/graph/nodes'")
                .limit(1000)
                .toArray();

            // Parse and filter by IDs
            const nodes = results
                .map((result: any) => JSON.parse(result.text))
                .filter((node: any) => ids.includes(node.id));

            return nodes.map((node: any) => ({
                id: node.id,
                type: node.type,
                label: node.label,
                path: node.path,
                score: node.score
            }));

        } catch (error) {
            console.error('Failed to query nodes by IDs:', error);
            return [];
        }
    }

    /**
     * Upsert graph nodes
     */
    async upsertNodes(nodes: import('../core/schemas').GraphNode[]): Promise<void> {
        // For now, we'll store nodes as special chunks with type 'graph-node'
        // This is a simplified implementation - in production, you'd want separate tables
        console.log(`Storing ${nodes.length} graph nodes as special chunks...`);
        
        const nodeChunks = nodes.map(node => ({
            id: `node:${node.id}`,
            path: '/graph/nodes',
            language: 'graph',
            type: 'graph-node' as any,
            textHash: node.id,
            text: JSON.stringify(node),
            startLine: 1,
            endLine: 1,
            keywords: ['graph', 'node', node.type],
            metadata: { complexity: 0 },
            vector: new Array(this.config.vectorDimension).fill(0),
            updatedAt: node.updatedAt,
            version: 1
        }));
        
        await this.upsertChunks(nodeChunks);
    }

    /**
     * Upsert graph edges
     */
    async upsertEdges(edges: import('../core/schemas').GraphEdge[]): Promise<void> {
        // Store edges as special chunks with type 'graph-edge'
        console.log(`Storing ${edges.length} graph edges as special chunks...`);
        
        const edgeChunks = edges.map(edge => ({
            id: `edge:${edge.id}`,
            path: '/graph/edges',
            language: 'graph',
            type: 'graph-edge' as any,
            textHash: edge.id,
            text: JSON.stringify(edge),
            startLine: 1,
            endLine: 1,
            keywords: ['graph', 'edge', edge.type],
            metadata: { complexity: 0 },
            vector: new Array(this.config.vectorDimension).fill(0),
            updatedAt: edge.updatedAt,
            version: 1
        }));
        
        await this.upsertChunks(edgeChunks);
    }

    /**
     * Get all graph nodes
     */
    async getAllNodes(): Promise<import('../core/schemas').GraphNode[]> {
        if (!this.chunksTable) {
            return [];
        }

        try {
            // Search for chunks with type 'graph-node'
            const results = await this.chunksTable
                .search(new Array(this.config.vectorDimension).fill(0))
                .where("path = '/graph/nodes'")
                .limit(1000)
                .toArray();

            return results.map((result: any) => JSON.parse(result.text));
        } catch (error) {
            console.error('Failed to get graph nodes:', error);
            return [];
        }
    }

    /**
     * Get all graph edges
     */
    async getAllEdges(): Promise<import('../core/schemas').GraphEdge[]> {
        if (!this.chunksTable) {
            return [];
        }

        try {
            // Search for chunks with type 'graph-edge'
            const results = await this.chunksTable
                .search(new Array(this.config.vectorDimension).fill(0))
                .where("path = '/graph/edges'")
                .limit(1000)
                .toArray();

            return results.map((result: any) => JSON.parse(result.text));
        } catch (error) {
            console.error('Failed to get graph edges:', error);
            return [];
        }
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.connection) {
            // LanceDB connections are automatically managed
            this.connection = null;
            this.chunksTable = null;
            this.neighborsTable = null;
            this.isInitialized = false;
        }
    }

    /**
     * Search for similar chunks using vector similarity
     */
    async searchSimilar(queryVector: number[], topK: number = 20): Promise<import('../core/schemas').Chunk[]> {
        await this.initialize();
        
        try {
            if (!this.chunksTable) {
                console.warn('Chunks table not initialized, returning empty results');
                return [];
            }

            // For now, return empty array - will be implemented when vector search is ready
            console.log(`🔍 Would search for ${topK} similar chunks (vector dim: ${queryVector.length})`);
            
            // In the future, this would use LanceDB vector search:
            // const results = await this.chunksTable
            //   .search(queryVector)
            //   .limit(topK)
            //   .toArray();
            // return results.map(this.recordToChunk);
            
            return [];
            
        } catch (error) {
            console.error('Error searching similar chunks:', error);
            return [];
        }
    }

    /**
     * Get chunk by ID
     */
    async getChunkById(chunkId: string): Promise<import('../core/schemas').Chunk | null> {
        await this.initialize();
        
        try {
            if (!this.chunksTable) {
                console.warn('Chunks table not initialized');
                return null;
            }

            // For now, return null - will be implemented when queries are ready
            console.log(`🔍 Would get chunk by ID: ${chunkId}`);
            
            // In the future, this would query LanceDB:
            // const results = await this.chunksTable
            //   .where(`id = '${chunkId}'`)
            //   .limit(1)
            //   .toArray();
            // return results.length > 0 ? this.recordToChunk(results[0]) : null;
            
            return null;
            
        } catch (error) {
            console.error('Error getting chunk by ID:', error);
            return null;
        }
    }
}
