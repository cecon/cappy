import * as vscode from 'vscode';
import { LightRAGDocument } from '../../../store/lightragLanceDb';
import { getDatabase } from '../utils/databaseHelper';

/**
 * Generate intelligent chunk title from content
 * Inspired by LightRAG's semantic chunking approach
 */
function generateChunkTitle(content: string, chunkIndex: number): string {
    if (!content || content.trim().length === 0) {
        return `Chunk ${chunkIndex}`;
    }
    
    // Try to extract first sentence (up to ., !, ? or newline)
    const firstSentenceMatch = content.match(/^[^.!?\n]+[.!?]?/);
    if (firstSentenceMatch && firstSentenceMatch[0].length > 0) {
        const sentence = firstSentenceMatch[0].trim();
        // Limit to 60 characters for display
        if (sentence.length <= 60) {
            return sentence;
        }
        return sentence.substring(0, 57) + '...';
    }
    
    // Fallback: first 50 chars
    const preview = content.trim().substring(0, 50);
    return preview + (content.length > 50 ? '...' : '');
}

/**
 * Handle getting graph data for visualization
 */
export async function handleGetGraphData(panel: vscode.WebviewPanel): Promise<void> {
    try {
        console.log('[Backend] Getting graph data...');
        const db = getDatabase();
        await db.initialize();
        const documents = await db.getDocumentsAsync();
        const entities = await db.getEntitiesAsync();
        const relationships = await db.getRelationshipsAsync();
        const chunks = await db.getChunksAsync();
        
        console.log(`[Backend] Found: ${documents.length} docs, ${entities.length} entities, ${relationships.length} rels, ${chunks.length} chunks`);

        // Build graph data structure
        const nodes: any[] = [];
        const edges: any[] = [];

        // Add document nodes
        documents.forEach((doc: LightRAGDocument) => {
            nodes.push({
                id: doc.id,
                label: doc.title,
                type: 'document',
                size: 15,
                color: '#10b981',
                metadata: {
                    category: doc.category,
                    status: doc.status,
                    created: doc.created,
                    fileName: doc.fileName
                }
            });
        });

        // Add entity nodes
        entities.forEach((entity: any) => {
            // Convert Apache Arrow array to JS array if needed
            let documentIds: string[] = [];
            if (entity.documentIds) {
                if (Array.isArray(entity.documentIds)) {
                    documentIds = entity.documentIds;
                } else if (typeof entity.documentIds.toArray === 'function') {
                    documentIds = entity.documentIds.toArray();
                } else if (typeof entity.documentIds === 'object' && entity.documentIds.length !== undefined) {
                    // Apache Arrow Vector - convert to array manually
                    documentIds = Array.from({ length: entity.documentIds.length }, (_, i) => entity.documentIds[i]);
                }
            }
            
            nodes.push({
                id: entity.id,
                label: entity.name,
                type: 'entity',
                size: 10,
                color: '#3b82f6',
                metadata: {
                    type: entity.type,
                    documentIds: documentIds
                }
            });

            // Connect entity to its documents
            if (documentIds && documentIds.length > 0) {
                documentIds.forEach((docId: string) => {
                    if (docId) { // Skip null/undefined
                        edges.push({
                            source: docId,
                            target: entity.id,
                            label: 'contains',
                            type: 'line',
                            size: 2
                        });
                    }
                });
            }
        });

        // Add relationship edges
        relationships.forEach((rel: any) => {
            edges.push({
                source: rel.source,
                target: rel.target,
                label: rel.type,
                type: 'line',
                size: 3,
                color: '#f97316'
            });
        });

        // Add chunk nodes (smaller, connected to documents)
        chunks.slice(0, 50).forEach((chunk: any) => { // Limit to 50 chunks for performance
            // Generate intelligent chunk title from content (first sentence or first 50 chars)
            const chunkTitle = generateChunkTitle(chunk.content, chunk.chunkIndex);
            
            // Convert Apache Arrow arrays to JS arrays if needed
            let chunkEntities: string[] = [];
            if (chunk.entities) {
                if (Array.isArray(chunk.entities)) {
                    chunkEntities = chunk.entities;
                } else if (typeof chunk.entities.toArray === 'function') {
                    chunkEntities = chunk.entities.toArray();
                } else if (typeof chunk.entities === 'object' && chunk.entities.length !== undefined) {
                    chunkEntities = Array.from({ length: chunk.entities.length }, (_, i) => chunk.entities[i]);
                }
            }
            
            let chunkRelationships: string[] = [];
            if (chunk.relationships) {
                if (Array.isArray(chunk.relationships)) {
                    chunkRelationships = chunk.relationships;
                } else if (typeof chunk.relationships.toArray === 'function') {
                    chunkRelationships = chunk.relationships.toArray();
                } else if (typeof chunk.relationships === 'object' && chunk.relationships.length !== undefined) {
                    chunkRelationships = Array.from({ length: chunk.relationships.length }, (_, i) => chunk.relationships[i]);
                }
            }
            
            nodes.push({
                id: chunk.id,
                label: chunkTitle,
                type: 'chunk',
                size: 5,
                color: '#8b5cf6',
                metadata: {
                    chunkIndex: chunk.chunkIndex,
                    contentLength: chunk.content.length,
                    documentId: chunk.documentId,
                    entities: chunkEntities.length,
                    relationships: chunkRelationships.length,
                    contentPreview: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
                    fullContent: chunk.content // Include full content for detailed view
                }
            });

            // Connect chunk to its document
            if (chunk.documentId) {
                edges.push({
                    source: chunk.documentId,
                    target: chunk.id,
                    label: 'chunk',
                    type: 'line',
                    size: 1
                });
            }
        });

        console.log(`[Backend] Sending graph data: ${nodes.length} nodes, ${edges.length} edges`);
        panel.webview.postMessage({
            command: 'graphData',
            data: {
                nodes,
                edges
            }
        });

    } catch (error) {
        console.error('[Backend] Error loading graph data:', error);
        panel.webview.postMessage({
            command: 'graphDataError',
            data: { message: error instanceof Error ? error.message : 'Failed to load graph data' }
        });
    }
}
