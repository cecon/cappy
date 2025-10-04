import { connect, Connection, Table } from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';
import * as path from 'path';
import * as fs from 'fs';

/**
 * LightRAG Database Schema and Operations using LanceDB
 * High-performance vector storage for documents, entities, relationships, and chunks
 */

export interface LightRAGEntity extends Record<string, unknown> {
    id: string;
    name: string;
    type: string;
    description: string;
    documentIds: string[];
    created: string;
    updated: string;
    vector?: number[]; // Optional embedding for semantic search
}

export interface LightRAGRelationship extends Record<string, unknown> {
    id: string;
    source: string;
    target: string;
    type: string;
    description: string;
    weight: number;
    documentIds: string[];
    created: string;
    updated: string;
}

export interface LightRAGDocument extends Record<string, unknown> {
    id: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    filePath: string;
    fileName: string;
    fileSize: number;
    content: string;
    status: 'processing' | 'completed' | 'failed';
    processingResults?: {
        entities: number;
        relationships: number;
        chunks: number;
        processingTime: string;
    };
    created: string;
    updated: string;
    vector?: number[]; // Document-level embedding
}

export interface LightRAGChunk extends Record<string, unknown> {
    id: string;
    documentId: string;
    content: string;
    startPosition: number;
    endPosition: number;
    chunkIndex: number;
    entities: string[];
    relationships: string[];
    created: string;
    vector?: number[]; // Chunk embedding for hybrid search
}

export interface LightRAGStatistics {
    totalDocuments: number;
    totalEntities: number;
    totalRelationships: number;
    totalChunks: number;
    lastUpdated: string;
}

export class LightRAGLanceDatabase {
    private dbPath: string;
    private connection: Connection | null = null;
    private documentsTable: Table | null = null;
    private entitiesTable: Table | null = null;
    private relationshipsTable: Table | null = null;
    private chunksTable: Table | null = null;
    private isInitialized = false;

    constructor(workspacePath: string) {
        this.dbPath = path.join(workspacePath, '.cappy', 'lightrag-lancedb');
        this.ensureDbDirectory();
    }

    private ensureDbDirectory(): void {
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
    }

    /**
     * Initialize LanceDB connection and tables
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log(`[LightRAG LanceDB] Connecting to: ${this.dbPath}`);
            this.connection = await connect(this.dbPath);

            // Initialize all tables
            await this.initializeDocumentsTable();
            await this.initializeEntitiesTable();
            await this.initializeRelationshipsTable();
            await this.initializeChunksTable();

            this.isInitialized = true;
            console.log('[LightRAG LanceDB] Initialized successfully');
        } catch (error) {
            console.error('[LightRAG LanceDB] Initialization failed:', error);
            throw error;
        }
    }

    private async initializeDocumentsTable(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const tableNames = await this.connection.tableNames();
        
        if (tableNames.includes('documents')) {
            this.documentsTable = await this.connection.openTable('documents');
        } else {
            // Define explicit schema for documents table
            const schema = new arrow.Schema([
                new arrow.Field('id', new arrow.Utf8(), false),
                new arrow.Field('title', new arrow.Utf8(), false),
                new arrow.Field('description', new arrow.Utf8(), false),
                new arrow.Field('category', new arrow.Utf8(), false),
                new arrow.Field('tags', new arrow.List(new arrow.Field('item', new arrow.Utf8())), false),
                new arrow.Field('filePath', new arrow.Utf8(), false),
                new arrow.Field('fileName', new arrow.Utf8(), false),
                new arrow.Field('fileSize', new arrow.Float64(), false),
                new arrow.Field('content', new arrow.Utf8(), false),
                new arrow.Field('status', new arrow.Utf8(), false),
                new arrow.Field('created', new arrow.Utf8(), false),
                new arrow.Field('updated', new arrow.Utf8(), false)
            ]);

            // Create empty table with explicit schema
            const emptyData: LightRAGDocument[] = [];
            this.documentsTable = await this.connection.createTable('documents', emptyData, { schema });
            console.log('[LightRAG LanceDB] Documents table created with explicit schema');
        }
    }

    private async initializeEntitiesTable(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const tableNames = await this.connection.tableNames();
        
        if (tableNames.includes('entities')) {
            this.entitiesTable = await this.connection.openTable('entities');
        } else {
            // Define explicit schema for entities table
            const schema = new arrow.Schema([
                new arrow.Field('id', new arrow.Utf8(), false),
                new arrow.Field('name', new arrow.Utf8(), false),
                new arrow.Field('type', new arrow.Utf8(), false),
                new arrow.Field('description', new arrow.Utf8(), false),
                new arrow.Field('documentIds', new arrow.List(new arrow.Field('item', new arrow.Utf8())), false),
                new arrow.Field('created', new arrow.Utf8(), false),
                new arrow.Field('updated', new arrow.Utf8(), false)
            ]);

            const emptyData: LightRAGEntity[] = [];
            this.entitiesTable = await this.connection.createTable('entities', emptyData, { schema });
            console.log('[LightRAG LanceDB] Entities table created with explicit schema');
        }
    }

    private async initializeRelationshipsTable(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const tableNames = await this.connection.tableNames();
        
        if (tableNames.includes('relationships')) {
            this.relationshipsTable = await this.connection.openTable('relationships');
        } else {
            const sampleRel: LightRAGRelationship = {
                id: 'sample-rel',
                source: 'entity1',
                target: 'entity2',
                type: 'related',
                description: 'Sample relationship',
                weight: 1.0,
                documentIds: [],
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            };

            this.relationshipsTable = await this.connection.createTable('relationships', [sampleRel]);
            await this.relationshipsTable.delete("id = 'sample-rel'");
            console.log('[LightRAG LanceDB] Relationships table created');
        }
    }

    private async initializeChunksTable(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const tableNames = await this.connection.tableNames();
        
        if (tableNames.includes('chunks')) {
            this.chunksTable = await this.connection.openTable('chunks');
        } else {
            const sampleChunk: LightRAGChunk = {
                id: 'sample-chunk',
                documentId: 'doc1',
                content: 'Sample content',
                startPosition: 0,
                endPosition: 10,
                chunkIndex: 0,
                entities: [],
                relationships: [],
                created: new Date().toISOString()
            };

            this.chunksTable = await this.connection.createTable('chunks', [sampleChunk]);
            await this.chunksTable.delete("id = 'sample-chunk'");
            console.log('[LightRAG LanceDB] Chunks table created');
        }
    }

    // ============= CRUD Operations =============

    /**
     * Add a new entity
     */
    async addEntity(entity: Omit<LightRAGEntity, 'id' | 'created' | 'updated'>): Promise<string> {
        await this.initialize();
        if (!this.entitiesTable) {
            throw new Error('Entities table not initialized');
        }

        const id = 'entity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        const newEntity: LightRAGEntity = {
            id,
            created: now,
            updated: now,
            ...entity
        } as LightRAGEntity;

        await this.entitiesTable.add([newEntity]);
        return id;
    }

    /**
     * Add a new relationship
     */
    async addRelationship(rel: Omit<LightRAGRelationship, 'id' | 'created' | 'updated'>): Promise<string> {
        await this.initialize();
        if (!this.relationshipsTable) {
            throw new Error('Relationships table not initialized');
        }

        const id = 'rel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        const newRel: LightRAGRelationship = {
            id,
            created: now,
            updated: now,
            ...rel
        } as LightRAGRelationship;

        await this.relationshipsTable.add([newRel]);
        return id;
    }

    /**
     * Add a new chunk
     */
    async addChunk(chunk: Omit<LightRAGChunk, 'id' | 'created'>): Promise<string> {
        await this.initialize();
        if (!this.chunksTable) {
            throw new Error('Chunks table not initialized');
        }

        const id = 'chunk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        const newChunk: LightRAGChunk = {
            id,
            created: now,
            ...chunk
        } as LightRAGChunk;

        await this.chunksTable.add([newChunk]);
        return id;
    }

    /**
     * Add a new document
     */
    addDocument(doc: LightRAGDocument): void {
        this.initialize().then(async () => {
            if (!this.documentsTable) {
                throw new Error('Documents table not initialized');
            }
            await this.documentsTable.add([doc]);
        });
    }

    /**
     * Get all documents
     */
    getDocuments(): LightRAGDocument[] {
        // Synchronous compatibility layer - returns empty for now
        // Use getDocumentsAsync() for real data
        return [];
    }

    /**
     * Get all documents (async)
     */
    async getDocumentsAsync(): Promise<LightRAGDocument[]> {
        await this.initialize();
        if (!this.documentsTable) {
            return [];
        }

        const results = await this.documentsTable.query().limit(1000).toArray();
        return results as LightRAGDocument[];
    }

    /**
     * Get all entities
     */
    getEntities(): LightRAGEntity[] {
        return [];
    }

    async getEntitiesAsync(): Promise<LightRAGEntity[]> {
        await this.initialize();
        if (!this.entitiesTable) {
            return [];
        }

        const results = await this.entitiesTable.query().limit(10000).toArray();
        return results as LightRAGEntity[];
    }

    /**
     * Get all relationships
     */
    getRelationships(): LightRAGRelationship[] {
        return [];
    }

    async getRelationshipsAsync(): Promise<LightRAGRelationship[]> {
        await this.initialize();
        if (!this.relationshipsTable) {
            return [];
        }

        const results = await this.relationshipsTable.query().limit(10000).toArray();
        return results as LightRAGRelationship[];
    }

    /**
     * Get all chunks
     */
    getChunks(): LightRAGChunk[] {
        return [];
    }

    async getChunksAsync(): Promise<LightRAGChunk[]> {
        await this.initialize();
        if (!this.chunksTable) {
            return [];
        }

        const results = await this.chunksTable.query().limit(10000).toArray();
        return results as LightRAGChunk[];
    }

    /**
     * Delete a document and all related data
     */
    async deleteDocument(documentId: string): Promise<void> {
        await this.initialize();

        // Delete from all tables
        if (this.documentsTable) {
            await this.documentsTable.delete(`id = '${documentId}'`);
        }

        if (this.entitiesTable) {
            // Note: LanceDB doesn't support array contains in filter, need to fetch and filter
            const entities = await this.getEntitiesAsync();
            const entityIdsToDelete = entities
                .filter(e => e.documentIds.includes(documentId))
                .map(e => e.id);
            
            for (const entityId of entityIdsToDelete) {
                await this.entitiesTable.delete(`id = '${entityId}'`);
            }
        }

        if (this.relationshipsTable) {
            const relationships = await this.getRelationshipsAsync();
            const relIdsToDelete = relationships
                .filter(r => r.documentIds.includes(documentId))
                .map(r => r.id);
            
            for (const relId of relIdsToDelete) {
                await this.relationshipsTable.delete(`id = '${relId}'`);
            }
        }

        if (this.chunksTable) {
            await this.chunksTable.delete(`documentId = '${documentId}'`);
        }
    }

    /**
     * Get statistics
     */
    getStatistics(): LightRAGStatistics {
        return {
            totalDocuments: 0,
            totalEntities: 0,
            totalRelationships: 0,
            totalChunks: 0,
            lastUpdated: new Date().toISOString()
        };
    }

    async getStatisticsAsync(): Promise<LightRAGStatistics> {
        await this.initialize();

        const [docs, entities, rels, chunks] = await Promise.all([
            this.getDocumentsAsync(),
            this.getEntitiesAsync(),
            this.getRelationshipsAsync(),
            this.getChunksAsync()
        ]);

        return {
            totalDocuments: docs.length,
            totalEntities: entities.length,
            totalRelationships: rels.length,
            totalChunks: chunks.length,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Vector search on chunks (for hybrid RAG)
     */
    async searchChunks(queryVector: number[], limit: number = 10): Promise<LightRAGChunk[]> {
        await this.initialize();
        if (!this.chunksTable) {
            return [];
        }

        // LanceDB vector search
        const results = await this.chunksTable
            .search(queryVector)
            .limit(limit)
            .toArray();

        return results as LightRAGChunk[];
    }

    /**
     * Close connection
     */
    async close(): Promise<void> {
        if (this.connection) {
            // LanceDB auto-manages connections
            this.connection = null;
            this.isInitialized = false;
        }
    }
}

// Singleton instance per workspace
const dbInstances = new Map<string, LightRAGLanceDatabase>();

export function getLightRAGLanceDatabase(workspacePath?: string): LightRAGLanceDatabase {
    const wsPath = workspacePath || process.cwd();
    
    if (!dbInstances.has(wsPath)) {
        dbInstances.set(wsPath, new LightRAGLanceDatabase(wsPath));
    }
    
    return dbInstances.get(wsPath)!;
}
