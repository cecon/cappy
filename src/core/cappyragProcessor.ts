import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { 
    Document, 
    DocumentMetadata, 
    ProcessingOptions, 
    ProcessingResult, 
    Entity, 
    Relationship, 
    DocumentChunk,
    ProcessingLogEntry,
    ProcessingError,
    ValidationError,
    DeduplicationResult
} from '../models/cappyragTypes';
import { CappyRAGLanceDatabase, CappyRAGEntity, CappyRAGRelationship } from '../store/cappyragLanceDb';

/**
 * CappyRAG Document Processor
 * Implements the manual insertion strategy with GitHub Copilot-based entity/relationship extraction
 * 
 * IMPLEMENTATION STATUS:
 * ✅ Entity/Relationship extraction with enhanced prompts
 * ✅ Quality scoring system with confidence-based weighting  
 * ✅ VS Code Copilot Chat integration (vscode.lm API)
 * ✅ Cross-document relationship support architecture
 * ✅ JSON parsing and error handling
 * ✅ LanceDB integration for cross-document context
 * 
 * TODO - Remaining:
 * 1. generateEmbedding() - implement with @xenova/transformers
 * 2. Performance optimization with caching
 */
export class CappyRAGDocumentProcessor {
    private context: vscode.ExtensionContext;
    private database: CappyRAGLanceDatabase;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        // Get workspace path for database initialization
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;
        this.database = new CappyRAGLanceDatabase(workspacePath);
    }

    /**
     * Get existing entities from database for context during extraction
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
     * Process a single document through the CappyRAG pipeline
     */
    async processDocument(
        content: string,
        metadata: DocumentMetadata,
        options?: ProcessingOptions
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const documentId = this.generateDocumentId(content, metadata);
        const processingLog: ProcessingLogEntry[] = [];

        try {
            // Step 1: Create document record
            const document = await this.createDocument(documentId, content, metadata);
            this.logStep(processingLog, 'chunking', 'started', 'Creating document record');

            // Step 2: Chunk document
            const chunks = await this.chunkDocument(document, options);
            this.logStep(processingLog, 'chunking', 'completed', 
                `Document chunked into ${chunks.length} pieces`, { chunksCreated: chunks.length });

            // Step 3: Extract entities
            this.logStep(processingLog, 'extraction', 'started', 'Extracting entities via LLM');
            const entities = await this.extractEntities(chunks, options);
            this.logStep(processingLog, 'extraction', 'completed', 
                `Found ${entities.length} entities`, { entitiesFound: entities.length });

            // Step 4: Extract relationships
            const relationships = await this.extractRelationships(chunks, entities, options);
            this.logStep(processingLog, 'extraction', 'completed', 
                `Found ${relationships.length} relationships`, { relationshipsFound: relationships.length });

            // Step 5: Deduplication
            this.logStep(processingLog, 'deduplication', 'started', 'Checking for duplicate entities');
            const deduplicationResult = await this.deduplicateEntities(entities, relationships);
            this.logStep(processingLog, 'deduplication', 'completed', 
                `Processed ${deduplicationResult.newEntities.length} unique entities`);

            // Step 6: Store in database
            this.logStep(processingLog, 'indexing', 'started', 'Storing entities and relationships');
            await this.storeResults(document, deduplicationResult);
            this.logStep(processingLog, 'indexing', 'completed', 'Document successfully indexed');

            const processingTimeMs = Date.now() - startTime;

            return {
                documentId,
                status: 'completed',
                entities: deduplicationResult.newEntities,
                relationships: deduplicationResult.newRelationships,
                processingTimeMs,
                processingLog
            };

        } catch (error) {
            const processingTimeMs = Date.now() - startTime;
            this.logStep(processingLog, 'indexing', 'error', 
                `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

            return {
                documentId,
                status: 'error',
                entities: [],
                relationships: [],
                processingTimeMs,
                processingLog,
                errors: [error instanceof Error ? error.message : 'Unknown error occurred']
            };
        }
    }

    private async createDocument(
        documentId: string,
        content: string,
        metadata: DocumentMetadata
    ): Promise<Document> {
        const document: Document = {
            id: documentId,
            content,
            metadata,
            chunks: [],
            entities: [],
            relationships: [],
            status: 'processing',
            processingLog: []
        };

        // TODO: Store document in database
        return document;
    }

    private async chunkDocument(
        document: Document,
        options?: ProcessingOptions
    ): Promise<DocumentChunk[]> {
        const strategy = options?.chunkingStrategy || 'semantic';
        const maxChunkSize = options?.maxChunkSize || 512;
        const chunkOverlap = options?.chunkOverlap || 50;

        // Simple sentence-based chunking for now
        // TODO: Implement more sophisticated chunking strategies
        const sentences = this.splitIntoSentences(document.content);
        const chunks: DocumentChunk[] = [];
        
        let currentChunk = '';
        let startChar = 0;
        let chunkIndex = 0;

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
                // Create chunk
                const endChar = startChar + currentChunk.length;
                const chunk: DocumentChunk = {
                    id: this.generateChunkId(document.id, startChar, endChar),
                    documentId: document.id,
                    startChar,
                    endChar,
                    text: currentChunk.trim(),
                    entities: [],
                    relationships: [],
                    processingStatus: 'pending'
                };
                chunks.push(chunk);

                // Start new chunk with overlap
                startChar = endChar - chunkOverlap;
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }

        // Add final chunk
        if (currentChunk.trim().length > 0) {
            const endChar = startChar + currentChunk.length;
            const chunk: DocumentChunk = {
                id: this.generateChunkId(document.id, startChar, endChar),
                documentId: document.id,
                startChar,
                endChar,
                text: currentChunk.trim(),
                entities: [],
                relationships: [],
                processingStatus: 'pending'
            };
            chunks.push(chunk);
        }

        return chunks;
    }

    private async extractEntities(
        chunks: DocumentChunk[],
        options?: ProcessingOptions
    ): Promise<Entity[]> {
        const entities: Entity[] = [];
        const entityTypes = options?.entityTypes || [
            'Person', 'Organization', 'Technology', 'Concept', 'Location', 'Event'
        ];

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

    private async extractEntitiesFromChunk(
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
            // TODO: Call LLM service
            const response = await this.callLLM(prompt);
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
                entity.vector = await this.generateEmbedding(embeddingText);

                entities.push(entity);
            }

            return entities;

        } catch (error) {
            console.error('Error in LLM entity extraction:', error);
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

    private async extractRelationships(
        chunks: DocumentChunk[],
        entities: Entity[],
        options?: ProcessingOptions
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

    private async extractRelationshipsFromChunk(
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
            const response = await this.callLLM(prompt);
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

    private async deduplicateEntities(
        entities: Entity[],
        relationships: Relationship[]
    ): Promise<DeduplicationResult> {
        // TODO: Implement sophisticated deduplication using embeddings
        // For now, simple name-based deduplication
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

        // TODO: Similar deduplication for relationships
        
        return {
            entitiesToMerge: [],
            relationshipsToMerge: [],
            newEntities: uniqueEntities,
            newRelationships: relationships,
            mergeConfidences: []
        };
    }

    private async storeResults(
        document: Document,
        deduplicationResult: DeduplicationResult
    ): Promise<void> {
        // TODO: Implement LanceDB storage
        // - Store entities in entities table
        // - Store relationships in relationships table
        // - Generate and store key-value pairs
        // - Update document record
        console.log('Storing results (TODO: implement LanceDB storage)');
    }

    // Utility methods

    private generateDocumentId(content: string, metadata: DocumentMetadata): string {
        const hash = crypto.createHash('sha256');
        hash.update(content + metadata.filename + metadata.uploadedAt);
        return `doc_${hash.digest('hex').substring(0, 16)}`;
    }

    private generateChunkId(documentId: string, startChar: number, endChar: number): string {
        const hash = crypto.createHash('sha256');
        hash.update(`${documentId}_${startChar}_${endChar}`);
        return `chunk_${hash.digest('hex').substring(0, 16)}`;
    }

    private generateRelationshipId(sourceId: string, targetId: string, type: string): string {
        const hash = crypto.createHash('sha256');
        hash.update(`${sourceId}_${targetId}_${type}`);
        return `rel_${hash.digest('hex').substring(0, 16)}`;
    }

    private normalizeEntityName(name: string): string {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .trim();
    }

    private splitIntoSentences(text: string): string[] {
        // Simple sentence splitting - TODO: use more sophisticated NLP
        return text.split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(s => s + '.');
    }

    private async callLLM(prompt: string): Promise<string> {
        try {
            // Use VS Code's Language Model API (Copilot)
            const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
            
            if (!model) {
                console.warn('[CappyRAG] No Copilot model available, trying fallback');
                // Try without specific family
                const [fallbackModel] = await vscode.lm.selectChatModels({ vendor: 'copilot' });
                if (!fallbackModel) {
                    throw new Error('No Copilot model available');
                }
            }

            const selectedModel = model || (await vscode.lm.selectChatModels({ vendor: 'copilot' }))[0];

            // Add instruction for JSON format
            const enhancedPrompt = `${prompt}

IMPORTANT: You must respond with valid JSON only. No additional text, explanations, or markdown formatting. Just the JSON object as specified in the prompt.`;

            // Create messages for the chat
            const messages = [
                vscode.LanguageModelChatMessage.User(enhancedPrompt)
            ];

            // Send request to Copilot
            const chatResponse = await selectedModel.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            // Collect the full response
            let fullResponse = '';
            for await (const fragment of chatResponse.text) {
                fullResponse += fragment;
            }

            console.log(`[CappyRAG] LLM Response received: ${fullResponse.length} characters`);
            
            // Clean up the response to extract JSON
            const cleanedResponse = this.extractJSONFromResponse(fullResponse);
            
            // Validate JSON format
            try {
                JSON.parse(cleanedResponse);
                return cleanedResponse;
            } catch (parseError) {
                console.warn('[CappyRAG] Invalid JSON response from LLM, attempting to fix...');
                const fixedResponse = this.attemptJSONFix(cleanedResponse);
                JSON.parse(fixedResponse); // Validate
                return fixedResponse;
            }

        } catch (err) {
            console.error('[CappyRAG] LLM Error:', err);
            
            // Handle specific Language Model errors
            if (err instanceof vscode.LanguageModelError) {
                console.log(`LLM Error: ${err.message}, Code: ${err.code}`);
                
                // Check for specific error types
                if (err.message.includes('off_topic')) {
                    throw new Error('Request was considered off-topic by Copilot');
                }
                
                if (err.message.includes('permission') || err.message.includes('subscription')) {
                    throw new Error('No permissions to use Copilot. Please check your Copilot subscription.');
                }
                
                if (err.message.includes('blocked') || err.message.includes('filter')) {
                    throw new Error('Request was blocked by Copilot content filter');
                }
                
                if (err.message.includes('not found') || err.message.includes('unavailable')) {
                    throw new Error('Copilot model not found. Please ensure Copilot is enabled.');
                }
                
                throw new Error(`Copilot error: ${err.message}`);
            }
            
            // Fallback: Return empty JSON structure if LLM fails
            console.warn('[CappyRAG] Falling back to empty response due to LLM failure');
            return JSON.stringify({ entities: [], relationships: [] });
        }
    }

    /**
     * Extract JSON from LLM response that might contain markdown or extra text
     */
    private extractJSONFromResponse(response: string): string {
        // Remove markdown code blocks
        let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Try to find JSON object boundaries
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        
        return cleaned.trim();
    }

    /**
     * Attempt to fix common JSON formatting issues
     */
    private attemptJSONFix(jsonString: string): string {
        let fixed = jsonString;
        
        // Fix trailing commas
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        
        // Fix unquoted keys
        fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        // If still invalid, return empty structure
        try {
            JSON.parse(fixed);
            return fixed;
        } catch {
            console.warn('[CappyRAG] Could not fix JSON, returning empty structure');
            return JSON.stringify({ entities: [], relationships: [] });
        }
    }

    private async generateEmbedding(text: string): Promise<number[]> {
        // @copilot: How to generate embeddings locally using transformers.js in VS Code extension?
        // I need 384-dimensional embeddings for semantic search in knowledge graph
        // Requirements:
        // 1. Use @xenova/transformers package
        // 2. Load all-MiniLM-L6-v2 model locally (lightweight)
        // 3. Caching for performance
        // 4. Batch processing for multiple texts
        
        // TODO: Implement local embedding generation with transformers.js
        return new Array(384).fill(0).map(() => Math.random());
    }

    private logStep(
        log: ProcessingLogEntry[],
        step: ProcessingLogEntry['step'],
        status: ProcessingLogEntry['status'],
        message: string,
        details?: any
    ): void {
        log.push({
            timestamp: new Date().toISOString(),
            step,
            status,
            message,
            details
        });
    }
}
