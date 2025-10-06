import { 
    Entity, 
    Relationship, 
    DocumentChunk 
} from '../../models/cappyragTypes';
import { CappyRAGLanceDatabase } from '../../store/cappyragLanceDb';
import { LLMService } from './llmService';
import * as crypto from 'crypto';

/**
 * Relationship Extraction Service for CappyRAG
 * Handles relationship extraction between entities using GitHub Copilot
 */
export class RelationshipExtractionService {
    
    constructor(
        private database: CappyRAGLanceDatabase,
        private llmService: LLMService
    ) {}
    
    /**
     * Extract relationships from document chunks
     */
    async extractRelationships(
        chunks: DocumentChunk[],
        entities: Entity[]
    ): Promise<Relationship[]> {
        const relationships: Relationship[] = [];

        for (const chunk of chunks) {
            try {
                const chunkEntities = entities.filter(e => e.sourceChunks.includes(chunk.id));
                if (chunkEntities.length < 2) {
                    continue; // Need at least 2 entities for relationships
                }

                const chunkRelationships = await this.extractRelationshipsFromChunk(
                    chunk, 
                    chunkEntities
                );
                relationships.push(...chunkRelationships);
                chunk.relationships = chunkRelationships.map(r => r.id);

            } catch (error) {
                console.error(`Error extracting relationships from chunk ${chunk.id}:`, error);
            }
        }

        return relationships;
    }
    
    /**
     * Extract relationships from a single chunk
     */
    async extractRelationshipsFromChunk(
        chunk: DocumentChunk,
        entities: Entity[]
    ): Promise<Relationship[]> {
        // Get existing relationships for pattern matching
        const existingRelationships = await this.getExistingRelationshipsForContext();
        const existingEntitiesInOtherDocs = await this.getEntitiesFromOtherDocuments(chunk.documentId);
        
        const prompt = `
You are building a knowledge graph. Extract relationships from this text, considering existing patterns.

CONTEXT - EXISTING RELATIONSHIP PATTERNS:
${existingRelationships.slice(0, 15).map(r => `- ${r.type}: ${r.description}`).join('\n')}

CONTEXT - ENTITIES FROM OTHER DOCUMENTS:
${existingEntitiesInOtherDocs.slice(0, 10).map(e => `- ${e.name} (${e.type}) from ${e.sourceDocuments?.[0] || 'unknown'}`).join('\n')}

TEXT TO ANALYZE:
${chunk.text}

ENTITIES IN THIS CHUNK:
${entities.map(e => `- ${e.name} (${e.type}): ${e.description}`).join('\n')}

TASK:
1. Extract relationships between entities in this chunk
2. Find relationships to entities from other documents (cross-document links)
3. Use consistent relationship types from existing patterns
4. Create specific, technical descriptions
5. Set weight based on relationship strength and evidence

RELATIONSHIP TYPES (use these patterns):
- TECHNICAL: implements, uses, depends_on, extends, integrates_with
- STRUCTURAL: contains, part_of, composed_of, includes
- FUNCTIONAL: enables, supports, processes, manages, executes
- SEMANTIC: similar_to, relates_to, classified_as, categorized_as
- TEMPORAL: created_by, updated_by, derived_from, evolved_from

QUALITY GUIDELINES:
- Weight 0.8-1.0 for strong technical relationships
- Weight 0.5-0.8 for clear semantic relationships  
- Weight 0.2-0.5 for weak/inferred relationships
- Bidirectional=true for symmetric relationships (similar_to, compatible_with)
- Use exact entity names (case-sensitive matching)

Return JSON format:
{
  "relationships": [
    {
      "source": "Cappy",
      "target": "VS Code",
      "type": "compatible_with",
      "description": "Cappy extension is designed to work seamlessly within VS Code IDE environment",
      "weight": 0.9,
      "bidirectional": true,
      "confidence": 0.95,
      "evidenceText": "Brief quote from chunk supporting this relationship"
    }
  ]
}
`;

        try {
            const response = await this.llmService.callLLM(prompt);
            const parsed = JSON.parse(response);

            const relationships: Relationship[] = [];
            for (const relData of parsed.relationships || []) {
                // Find source and target entities (in current chunk or from other documents)
                let sourceEntity = entities.find(e => e.name === relData.source);
                let targetEntity = entities.find(e => e.name === relData.target);
                
                // If not found in current entities, check existing entities from other documents
                if (!sourceEntity) {
                    const existingEntities = await this.getEntitiesFromOtherDocuments(chunk.documentId);
                    sourceEntity = existingEntities.find(e => e.name === relData.source);
                }
                
                if (!targetEntity) {
                    const existingEntities = await this.getEntitiesFromOtherDocuments(chunk.documentId);
                    targetEntity = existingEntities.find(e => e.name === relData.target);
                }

                if (!sourceEntity || !targetEntity) {
                    console.warn(`Relationship skipped: Entity not found - ${relData.source} -> ${relData.target}`);
                    continue;
                }

                const relationship: Relationship = {
                    id: this.generateRelationshipId(sourceEntity.id, targetEntity.id, relData.type),
                    source: sourceEntity.id,
                    target: targetEntity.id,
                    type: relData.type,
                    description: relData.description || `${relData.type} relationship between ${sourceEntity.name} and ${targetEntity.name}`,
                    properties: {
                        evidenceText: relData.evidenceText || '',
                        extractionMethod: 'llm_enhanced',
                        crossDocument: sourceEntity.sourceDocuments?.[0] !== targetEntity.sourceDocuments?.[0],
                        qualityScore: this.calculateRelationshipQualityScore(relData)
                    },
                    weight: relData.weight || 0.5,
                    bidirectional: relData.bidirectional || false,
                    sourceDocuments: [chunk.documentId],
                    sourceChunks: [chunk.id],
                    confidence: relData.confidence || 0.8,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                relationships.push(relationship);
            }

            return relationships;

        } catch (error) {
            console.error('Error in LLM relationship extraction:', error);
            return [];
        }
    }
    
    /**
     * Get existing relationships for pattern matching
     */
    private async getExistingRelationshipsForContext(): Promise<Relationship[]> {
        try {
            // Ensure database is initialized
            await this.database.initialize();
            
            // Get all relationships from LanceDB
            const dbRelationships = await this.database.getRelationshipsAsync();
            
            // Convert CappyRAGRelationship to Relationship interface
            return dbRelationships.map(dbRel => ({
                id: dbRel.id,
                source: dbRel.source,
                target: dbRel.target,
                type: dbRel.type,
                description: dbRel.description,
                properties: {},
                weight: dbRel.weight,
                bidirectional: true, // Default to bidirectional
                sourceDocuments: dbRel.documentIds || [],
                sourceChunks: [],
                confidence: 0.8, // Default confidence for existing relationships
                createdAt: dbRel.created,
                updatedAt: dbRel.updated
            }));
        } catch (error) {
            console.error('Error fetching existing relationships:', error);
            return [];
        }
    }
    
    /**
     * Get entities from other documents to enable cross-document relationships
     */
    private async getEntitiesFromOtherDocuments(currentDocumentId: string): Promise<Entity[]> {
        try {
            // Ensure database is initialized
            await this.database.initialize();
            
            // Get all entities from LanceDB
            const allEntities = await this.database.getEntitiesAsync();
            
            // Filter entities that are NOT from the current document
            const entitiesFromOtherDocs = allEntities.filter(entity => 
                entity.documentIds && 
                !entity.documentIds.includes(currentDocumentId) &&
                entity.documentIds.length > 0
            );
            
            console.log(`[CappyRAG] Found ${entitiesFromOtherDocs.length} entities from other documents for cross-document linking`);
            
            // Convert to Entity interface
            return entitiesFromOtherDocs.map(dbEntity => ({
                id: dbEntity.id,
                name: dbEntity.name,
                type: dbEntity.type,
                description: dbEntity.description,
                properties: {},
                sourceDocuments: dbEntity.documentIds || [],
                sourceChunks: [],
                confidence: 0.8,
                createdAt: dbEntity.created,
                updatedAt: dbEntity.updated
            }));
        } catch (error) {
            console.error('Error fetching entities from other documents:', error);
            return [];
        }
    }
    
    /**
     * Calculate quality score for extracted relationship
     */
    private calculateRelationshipQualityScore(relData: any): number {
        let score = 0.5; // Base score
        
        // Boost for high confidence
        if (relData.confidence > 0.8) {
            score += 0.2;
        } else if (relData.confidence > 0.6) {
            score += 0.1;
        }
        
        // Boost for high weight
        if (relData.weight > 0.8) {
            score += 0.15;
        } else if (relData.weight > 0.6) {
            score += 0.1;
        }
        
        // Boost for evidence text
        if (relData.evidenceText && relData.evidenceText.length > 20) {
            score += 0.1;
        }
        
        // Boost for good description
        if (relData.description && relData.description.length > 30) {
            score += 0.05;
        }
        
        return Math.min(score, 1.0);
    }
    
    /**
     * Generate relationship ID
     */
    private generateRelationshipId(sourceId: string, targetId: string, type: string): string {
        const hash = crypto.createHash('sha256');
        hash.update(`${sourceId}_${targetId}_${type}`);
        return `rel_${hash.digest('hex').substring(0, 16)}`;
    }
}