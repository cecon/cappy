/**
 * Simplified LightRAG Document Processor for MCP Testing
 * This is a mock implementation for testing the MCP system
 */

import { Document, Entity, Relationship, KeyValuePair, DocumentMetadata, ProcessingOptions } from "../models/lightragTypes";

export class LightRAGDocumentProcessor {
    
    async processDocument(
        filePath: string,
        content: string,
        metadata: DocumentMetadata,
        options: ProcessingOptions
    ): Promise<{
        document: Document;
        entities: Entity[];
        relationships: Relationship[];
        keyValues: KeyValuePair[];
        chunks: string[];
    }> {
        // Mock processing for testing
        console.log(`Processing document: ${filePath}`);
        console.log(`Content length: ${content.length} characters`);
        console.log(`Options:`, options);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate mock results
        const documentId = this.generateId();
        
        const document: Document = {
            id: documentId,
            content,
            metadata,
            chunks: [],
            entities: [],
            relationships: [],
            status: 'completed',
            processedAt: new Date().toISOString()
        };
        
        // Mock entities
        const entities: Entity[] = this.extractMockEntities(content, metadata, documentId);
        
        // Mock relationships
        const relationships: Relationship[] = this.extractMockRelationships(entities, documentId);
        
        // Mock key-value pairs
        const keyValues: KeyValuePair[] = this.extractMockKeyValues(content, metadata);
        
        // Mock chunks
        const chunks: string[] = this.chunkContent(content);
        
        return {
            document,
            entities,
            relationships,
            keyValues,
            chunks
        };
    }
    
    private generateId(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    
    private getContentType(filePath: string): string {
        const ext = filePath.toLowerCase().split('.').pop();
        const types: Record<string, string> = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'md': 'text/markdown'
        };
        return types[ext || ''] || 'text/plain';
    }
    
    private extractMockEntities(content: string, metadata: DocumentMetadata, documentId: string): Entity[] {
        const entities: Entity[] = [];
        
        // Extract mock entities based on content
        const words = content.split(/\s+/).filter(w => w.length > 3);
        const uniqueWords = [...new Set(words)].slice(0, 10);
        
        uniqueWords.forEach((word, index) => {
            entities.push({
                id: this.generateId(),
                name: word,
                type: this.classifyEntityType(word),
                description: `Entity extracted from ${metadata.title}`,
                properties: {
                    source: metadata.title,
                    confidence: 0.8 + Math.random() * 0.2,
                    mentions: Math.floor(Math.random() * 5) + 1
                },
                vector: new Array(384).fill(0).map(() => Math.random()),
                sourceDocuments: [documentId],
                sourceChunks: ['chunk_0'],
                confidence: 0.8 + Math.random() * 0.2,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        });
        
        return entities;
    }
    
    private classifyEntityType(word: string): string {
        const types = ['PERSON', 'ORGANIZATION', 'LOCATION', 'CONCEPT', 'TECHNOLOGY'];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    private extractMockRelationships(entities: Entity[], documentId: string): Relationship[] {
        const relationships: Relationship[] = [];
        
        // Create relationships between entities
        for (let i = 0; i < entities.length - 1; i++) {
            for (let j = i + 1; j < entities.length && relationships.length < 5; j++) {
                relationships.push({
                    id: this.generateId(),
                    source: entities[i].id,
                    target: entities[j].id,
                    type: this.getRelationshipType(),
                    description: `Relationship between ${entities[i].name} and ${entities[j].name}`,
                    properties: {
                        confidence: 0.7 + Math.random() * 0.3,
                        context: 'Extracted from document analysis'
                    },
                    weight: Math.random(),
                    bidirectional: false,
                    sourceDocuments: [documentId],
                    sourceChunks: ['chunk_0'],
                    confidence: 0.7 + Math.random() * 0.3,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }
        
        return relationships;
    }
    
    private getRelationshipType(): string {
        const types = ['RELATED_TO', 'PART_OF', 'WORKS_FOR', 'LOCATED_IN', 'USES'];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    private extractMockKeyValues(content: string, metadata: DocumentMetadata): KeyValuePair[] {
        return [
            {
                key: 'summary',
                value: content.substring(0, 200) + '...',
                type: 'entity',
                sourceId: this.generateId(),
                indexedAt: new Date().toISOString()
            },
            {
                key: 'word_count',
                value: content.split(/\s+/).length.toString(),
                type: 'entity',
                sourceId: this.generateId(),
                indexedAt: new Date().toISOString()
            },
            {
                key: 'language',
                value: 'en',
                type: 'entity',
                sourceId: this.generateId(),
                indexedAt: new Date().toISOString()
            }
        ];
    }
    
    private chunkContent(content: string): string[] {
        // Simple chunking - split by paragraphs or every 500 characters
        const chunks: string[] = [];
        const chunkSize = 500;
        
        for (let i = 0; i < content.length; i += chunkSize) {
            chunks.push(content.substring(i, i + chunkSize));
        }
        
        return chunks.filter(chunk => chunk.trim().length > 0);
    }
}