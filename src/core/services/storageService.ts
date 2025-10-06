import { 
    Entity, 
    Relationship,
    Document,
    DeduplicationResult 
} from '../../models/cappyragTypes';
import { CappyRAGLanceDatabase } from '../../store/cappyragLanceDb';

/**
 * Storage Service for CappyRAG
 * Handles database operations and result storage
 */
export class StorageService {
    
    constructor(private database: CappyRAGLanceDatabase) {}
    
    /**
     * Store document in database
     */
    async storeDocument(cappyRagDocument: any): Promise<void> {
        try {
            await this.database.initialize();
            this.database.addDocument(cappyRagDocument);
            console.log(`[CappyRAG] Document stored successfully: ${cappyRagDocument.id}`);
        } catch (error) {
            console.error(`[CappyRAG] Error storing document: ${error}`);
            throw error;
        }
    }
    
    /**
     * Store processing results (entities and relationships)
     */
    async storeResults(
        document: Document,
        deduplicationResult: DeduplicationResult
    ): Promise<void> {
        try {
            console.log(`[CappyRAG] Storing results for document: ${document.id}`);
            
            // Ensure database is initialized
            await this.database.initialize();
            
            // Store entities in LanceDB
            for (const entity of deduplicationResult.newEntities) {
                const entityData = {
                    name: entity.name,
                    type: entity.type,
                    description: entity.description,
                    documentIds: entity.sourceDocuments,
                    vector: entity.vector || new Array(384).fill(0)
                };
                
                await this.database.addEntity(entityData);
            }
            
            // Store relationships in LanceDB
            for (const relationship of deduplicationResult.newRelationships) {
                const relationshipData = {
                    source: relationship.source,
                    target: relationship.target,
                    type: relationship.type,
                    description: relationship.description,
                    weight: relationship.weight,
                    documentIds: relationship.sourceDocuments
                };
                
                await this.database.addRelationship(relationshipData);
            }
            
            // Update document status and processing results
            await this.database.updateDocumentStatus(document.id, 'completed', {
                entities: deduplicationResult.newEntities.length,
                relationships: deduplicationResult.newRelationships.length,
                chunks: document.chunks?.length || 0,
                processingTime: new Date().toISOString()
            });
            
            console.log(`[CappyRAG] Successfully stored ${deduplicationResult.newEntities.length} entities and ${deduplicationResult.newRelationships.length} relationships`);
            
        } catch (error) {
            console.error('[CappyRAG] Error storing results:', error);
            
            // Try to update document status to failed
            try {
                await this.database.updateDocumentStatus(document.id, 'failed');
            } catch (updateError) {
                console.error('[CappyRAG] Failed to update document status:', updateError);
            }
            
            throw error;
        }
    }
    
    /**
     * Simple deduplication based on entity names
     */
    async deduplicateEntities(
        entities: Entity[],
        relationships: Relationship[]
    ): Promise<DeduplicationResult> {
        // Simple name-based deduplication
        const uniqueEntities: Entity[] = [];
        const entityMap = new Map<string, Entity>();

        for (const entity of entities) {
            const existing = entityMap.get(entity.name.toLowerCase());
            if (existing) {
                // Merge entities
                existing.sourceDocuments = [...new Set([...existing.sourceDocuments, ...entity.sourceDocuments])];
                existing.sourceChunks = [...new Set([...existing.sourceChunks, ...entity.sourceChunks])];
                existing.confidence = Math.max(existing.confidence, entity.confidence);
                existing.updatedAt = new Date().toISOString();
            } else {
                entityMap.set(entity.name.toLowerCase(), entity);
                uniqueEntities.push(entity);
            }
        }
        
        return {
            entitiesToMerge: [],
            relationshipsToMerge: [],
            newEntities: uniqueEntities,
            newRelationships: relationships,
            mergeConfidences: []
        };
    }
}