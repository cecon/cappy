import { 
    Entity, 
    Relationship, 
    DocumentChunk 
} from '../../models/cappyragTypes';
import { CappyRAGLanceDatabase } from '../../store/cappyragLanceDb';
import { LLMService } from './llmService';
import { EmbeddingService } from './embeddingService';

/**
 * Entity Extraction Service for CappyRAG
 * Handles entity extraction from document chunks using GitHub Copilot
 */
export class EntityExtractionService {
    
    constructor(
        private database: CappyRAGLanceDatabase,
        private llmService: LLMService,
        private embeddingService: EmbeddingService
    ) {}
    
    /**
     * Extract entities from document chunks
     */
    async extractEntities(
        chunks: DocumentChunk[],
        entityTypes: string[] = ['Person', 'Organization', 'Technology', 'Concept', 'Location', 'Event']
    ): Promise<Entity[]> {
        const entities: Entity[] = [];

        for (const chunk of chunks) {
            try {
                const chunkEntities = await this.extractEntitiesFromChunk(chunk, entityTypes);
                entities.push(...chunkEntities);
                chunk.entities = chunkEntities.map(e => e.id);
                chunk.processingStatus = 'completed';
            } catch (error) {
                chunk.processingStatus = 'error';
                console.error(`Error extracting entities from chunk ${chunk.id}:`, error);
            }
        }

        return entities;
    }
    
    /**
     * Extract entities from a single chunk
     */
    async extractEntitiesFromChunk(
        chunk: DocumentChunk,
        entityTypes: string[]
    ): Promise<Entity[]> {
        // Get existing entities from database for context
        const existingEntities = await this.getExistingEntitiesForContext();
        
        // Enhanced LLM prompt with existing entities context
        const prompt = `
You are an expert knowledge graph builder. Analyze the following text and extract important entities.

CONTEXT - EXISTING ENTITIES IN KNOWLEDGE BASE:
${existingEntities.slice(0, 20).map(e => `- ${e.name} (${e.type}): ${e.description?.substring(0, 80)}...`).join('\n')}

TEXT TO ANALYZE:
${chunk.text}

TASK:
1. Extract entities of these types: ${entityTypes.join(', ')}
2. For each entity, check if it matches or relates to existing entities above
3. Use EXACT same names for entities that already exist
4. Create precise, contextual descriptions
5. Set confidence based on context clarity and existing entity matches

QUALITY GUIDELINES:
- Use specific, technical descriptions (not generic)
- Confidence 0.9+ for exact matches with existing entities
- Confidence 0.7-0.9 for clear new entities
- Confidence 0.4-0.7 for ambiguous entities
- Normalize names consistently (e.g., "Python" not "python programming")

Return JSON format:
{
  "entities": [
    {
      "name": "Python",
      "type": "Technology",
      "description": "High-level programming language known for simplicity and versatility in web development, data science, and automation",
      "confidence": 0.95,
      "isExisting": true,
      "chunkContext": "Brief context from this specific chunk"
    }
  ]
}
`;

        try {
            const response = await this.llmService.callLLM(prompt);
            const parsed = JSON.parse(response);

            const entities: Entity[] = [];
            for (const entityData of parsed.entities || []) {
                const entity: Entity = {
                    id: this.normalizeEntityName(entityData.name),
                    name: entityData.name,
                    type: entityData.type,
                    description: entityData.description || `A ${entityData.type.toLowerCase()} entity representing ${entityData.name}`,
                    properties: {
                        isExisting: entityData.isExisting || false,
                        chunkContext: entityData.chunkContext || '',
                        extractionMethod: 'llm_enhanced',
                        qualityScore: this.calculateEntityQualityScore(entityData)
                    },
                    sourceDocuments: [chunk.documentId],
                    sourceChunks: [chunk.id],
                    confidence: entityData.confidence || 0.5,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Generate embedding for entity with enhanced context
                const embeddingText = `${entity.name} ${entity.type} ${entity.description} ${entityData.chunkContext || ''}`;
                entity.vector = await this.embeddingService.generateEmbedding(embeddingText);

                entities.push(entity);
            }

            return entities;

        } catch (error) {
            console.error('Error in LLM entity extraction:', error);
            return [];
        }
    }
    
    /**
     * Get existing entities from database for context
     */
    private async getExistingEntitiesForContext(): Promise<Entity[]> {
        try {
            // Ensure database is initialized
            await this.database.initialize();
            
            // Get all entities from LanceDB
            const dbEntities = await this.database.getEntitiesAsync();
            
            // Convert CappyRAGEntity to Entity interface
            return dbEntities.map(dbEntity => ({
                id: dbEntity.id,
                name: dbEntity.name,
                type: dbEntity.type,
                description: dbEntity.description,
                properties: {},
                sourceDocuments: dbEntity.documentIds || [],
                sourceChunks: [],
                confidence: 0.8, // Default confidence for existing entities
                createdAt: dbEntity.created,
                updatedAt: dbEntity.updated
            }));
        } catch (error) {
            console.error('Error fetching existing entities:', error);
            return [];
        }
    }
    
    /**
     * Calculate quality score for extracted entity
     */
    private calculateEntityQualityScore(entityData: any): number {
        let score = 0.5; // Base score
        
        // Boost for high confidence
        if (entityData.confidence > 0.8) {
            score += 0.2;
        } else if (entityData.confidence > 0.6) {
            score += 0.1;
        }
        
        // Boost for existing entity match
        if (entityData.isExisting) {
            score += 0.15;
        }
        
        // Boost for good description
        if (entityData.description && entityData.description.length > 50) {
            score += 0.1;
        }
        
        // Boost for chunk context
        if (entityData.chunkContext && entityData.chunkContext.length > 20) {
            score += 0.05;
        }
        
        return Math.min(score, 1.0);
    }
    
    /**
     * Normalize entity name for ID generation
     */
    private normalizeEntityName(name: string): string {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .trim();
    }
}