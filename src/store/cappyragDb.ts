import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * CappyRAG Database Schema and Operations
 * Manages entities, relationships, documents, and chunks
 */

export interface CappyRAGEntity {
    id: string;
    name: string;
    type: string;
    description: string;
    documentIds: string[];
    created: string;
    updated: string;
}

export interface CappyRAGRelationship {
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

export interface CappyRAGDocument {
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
}

export interface CappyRAGChunk {
    id: string;
    documentId: string;
    content: string;
    startPosition: number;
    endPosition: number;
    chunkIndex: number;
    entities: string[];
    relationships: string[];
    created: string;
}

export class CappyRAGDatabase {
    private dbPath: string;
    private entities: Map<string, CappyRAGEntity> = new Map();
    private relationships: Map<string, CappyRAGRelationship> = new Map();
    private documents: Map<string, CappyRAGDocument> = new Map();
    private chunks: Map<string, CappyRAGChunk> = new Map();

    constructor(workspacePath: string) {
        this.dbPath = path.join(workspacePath, '.cappy', 'CappyRAG-db');
        this.ensureDbDirectory();
        this.loadDatabase();
    }

    private ensureDbDirectory(): void {
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
    }

    private getFilePath(table: string): string {
        return path.join(this.dbPath, `${table}.json`);
    }

    private loadDatabase(): void {
        try {
            // Load entities
            const entitiesPath = this.getFilePath('entities');
            if (fs.existsSync(entitiesPath)) {
                const entitiesData = JSON.parse(fs.readFileSync(entitiesPath, 'utf8'));
                this.entities = new Map(entitiesData);
            }

            // Load relationships
            const relationshipsPath = this.getFilePath('relationships');
            if (fs.existsSync(relationshipsPath)) {
                const relationshipsData = JSON.parse(fs.readFileSync(relationshipsPath, 'utf8'));
                this.relationships = new Map(relationshipsData);
            }

            // Load documents
            const documentsPath = this.getFilePath('documents');
            if (fs.existsSync(documentsPath)) {
                const documentsData = JSON.parse(fs.readFileSync(documentsPath, 'utf8'));
                this.documents = new Map(documentsData);
            }

            // Load chunks
            const chunksPath = this.getFilePath('chunks');
            if (fs.existsSync(chunksPath)) {
                const chunksData = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
                this.chunks = new Map(chunksData);
            }
        } catch (error) {
            console.warn('Could not load existing database, starting fresh:', error);
        }
    }

    private saveTable(tableName: string, data: Map<string, any>): void {
        try {
            const filePath = this.getFilePath(tableName);
            fs.writeFileSync(filePath, JSON.stringify(Array.from(data.entries()), null, 2));
        } catch (error) {
            console.error(`Failed to save ${tableName}:`, error);
        }
    }

    // Document operations
    async addDocument(document: Omit<CappyRAGDocument, 'id' | 'created' | 'updated'>): Promise<string> {
        const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        const newDocument: CappyRAGDocument = {
            ...document,
            id,
            created: now,
            updated: now
        };

        this.documents.set(id, newDocument);
        this.saveTable('documents', this.documents);
        return id;
    }

    async updateDocument(id: string, updates: Partial<CappyRAGDocument>): Promise<void> {
        const document = this.documents.get(id);
        if (!document) {
            throw new Error(`Document ${id} not found`);
        }

        const updatedDocument = {
            ...document,
            ...updates,
            updated: new Date().toISOString()
        };

        this.documents.set(id, updatedDocument);
        this.saveTable('documents', this.documents);
    }

    async deleteDocument(id: string): Promise<void> {
        const document = this.documents.get(id);
        if (!document) {
            return;
        }

        // Delete associated chunks
        const documentChunks = Array.from(this.chunks.values()).filter(chunk => chunk.documentId === id);
        for (const chunk of documentChunks) {
            this.chunks.delete(chunk.id);
        }

        // Remove document from entities
        for (const entity of this.entities.values()) {
            if (entity.documentIds.includes(id)) {
                entity.documentIds = entity.documentIds.filter(docId => docId !== id);
                if (entity.documentIds.length === 0) {
                    this.entities.delete(entity.id);
                } else {
                    entity.updated = new Date().toISOString();
                    this.entities.set(entity.id, entity);
                }
            }
        }

        // Remove document from relationships
        for (const relationship of this.relationships.values()) {
            if (relationship.documentIds.includes(id)) {
                relationship.documentIds = relationship.documentIds.filter(docId => docId !== id);
                if (relationship.documentIds.length === 0) {
                    this.relationships.delete(relationship.id);
                } else {
                    relationship.updated = new Date().toISOString();
                    this.relationships.set(relationship.id, relationship);
                }
            }
        }

        // Delete the document
        this.documents.delete(id);

        // Save all affected tables
        this.saveTable('documents', this.documents);
        this.saveTable('entities', this.entities);
        this.saveTable('relationships', this.relationships);
        this.saveTable('chunks', this.chunks);
    }

    getDocuments(): CappyRAGDocument[] {
        return Array.from(this.documents.values());
    }

    getDocument(id: string): CappyRAGDocument | undefined {
        return this.documents.get(id);
    }

    getDocumentByFileName(fileName: string): CappyRAGDocument | undefined {
        return Array.from(this.documents.values()).find(doc => doc.fileName === fileName);
    }

    // Entity operations
    async addEntity(entity: Omit<CappyRAGEntity, 'id' | 'created' | 'updated'>): Promise<string> {
        const id = 'entity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        const newEntity: CappyRAGEntity = {
            ...entity,
            id,
            created: now,
            updated: now
        };

        this.entities.set(id, newEntity);
        this.saveTable('entities', this.entities);
        return id;
    }

    getEntities(): CappyRAGEntity[] {
        return Array.from(this.entities.values());
    }

    // Relationship operations
    async addRelationship(relationship: Omit<CappyRAGRelationship, 'id' | 'created' | 'updated'>): Promise<string> {
        const id = 'rel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        const newRelationship: CappyRAGRelationship = {
            ...relationship,
            id,
            created: now,
            updated: now
        };

        this.relationships.set(id, newRelationship);
        this.saveTable('relationships', this.relationships);
        return id;
    }

    getRelationships(): CappyRAGRelationship[] {
        return Array.from(this.relationships.values());
    }

    // Chunk operations
    async addChunk(chunk: Omit<CappyRAGChunk, 'id' | 'created'>): Promise<string> {
        const id = 'chunk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        const newChunk: CappyRAGChunk = {
            ...chunk,
            id,
            created: now
        };

        this.chunks.set(id, newChunk);
        this.saveTable('chunks', this.chunks);
        return id;
    }

    getChunks(documentId?: string): CappyRAGChunk[] {
        const chunks = Array.from(this.chunks.values());
        return documentId ? chunks.filter(chunk => chunk.documentId === documentId) : chunks;
    }

    // Statistics
    getStatistics() {
        return {
            documents: this.documents.size,
            entities: this.entities.size,
            relationships: this.relationships.size,
            chunks: this.chunks.size,
            lastUpdated: new Date().toISOString()
        };
    }

    // Search operations
    searchEntities(query: string): CappyRAGEntity[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.entities.values()).filter(entity =>
            entity.name.toLowerCase().includes(lowerQuery) ||
            entity.description.toLowerCase().includes(lowerQuery)
        );
    }

    searchDocuments(query: string): CappyRAGDocument[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.documents.values()).filter(document =>
            document.title.toLowerCase().includes(lowerQuery) ||
            document.description.toLowerCase().includes(lowerQuery) ||
            document.content.toLowerCase().includes(lowerQuery)
        );
    }

    // Graph data for visualization
    getGraphData() {
        const nodes = this.getEntities().map(entity => ({
            id: entity.id,
            label: entity.name,
            type: entity.type,
            size: entity.documentIds.length,
            color: this.getEntityColor(entity.type)
        }));

        const edges = this.getRelationships().map(rel => ({
            id: rel.id,
            source: rel.source,
            target: rel.target,
            label: rel.type,
            weight: rel.weight,
            color: this.getRelationshipColor(rel.type)
        }));

        return { nodes, edges };
    }

    private getEntityColor(type: string): string {
        const colors: { [key: string]: string } = {};
        colors['PERSON'] = '#4CAF50';
        colors['ORGANIZATION'] = '#2196F3';
        colors['TECHNOLOGY'] = '#FF9800';
        colors['CONCEPT'] = '#9C27B0';
        colors['LOCATION'] = '#F44336';
        colors['EVENT'] = '#00BCD4';
        return colors[type] || '#757575';
    }

    private getRelationshipColor(type: string): string {
        const colors: { [key: string]: string } = {};
        colors['WORKS_FOR'] = '#4CAF50';
        colors['USES'] = '#2196F3';
        colors['PART_OF'] = '#FF9800';
        colors['RELATED_TO'] = '#9C27B0';
        colors['LOCATED_IN'] = '#F44336';
        colors['PARTICIPATES_IN'] = '#00BCD4';
        return colors[type] || '#757575';
    }
}

// Singleton instance
let dbInstance: CappyRAGDatabase | null = null;

export function getCappyRAGDatabase(): CappyRAGDatabase {
    if (!dbInstance) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }
        dbInstance = new CappyRAGDatabase(workspaceFolders[0].uri.fsPath);
    }
    return dbInstance;
}

export function resetCappyRAGDatabase(): void {
    dbInstance = null;
}
