/**
 * Types for LightRAG-compatible document processing system
 * Based on the architecture defined in SPEC.md
 */

// Core entity type following LightRAG pattern
export interface Entity {
    id: string;                    // Nome único normalizado
    name: string;                  // Nome legível
    type: string;                  // Tipo: "Person", "Technology", "Concept", etc.
    description: string;           // Descrição extraída via LLM
    properties: Record<string, any>; // Propriedades específicas do tipo
    vector?: number[];             // Embedding vetorial (384d MiniLM ou 1024d BGE-M3)
    keyValuePairs?: KeyValuePair[]; // Pares chave-valor para busca eficiente
    sourceDocuments: string[];     // IDs dos documentos fonte
    sourceChunks: string[];        // Chunks específicos de onde foi extraída
    confidence: number;            // Confiança da extração (0-1)
    createdAt: string;             // ISO datetime de criação
    updatedAt: string;             // ISO datetime de última atualização
    mergedFrom?: string[];         // IDs de entidades que foram merged nesta
}

// Relationship type following LightRAG pattern
export interface Relationship {
    id: string;                    // ID único hash(source + target + type)
    source: string;                // ID da entidade origem
    target: string;                // ID da entidade destino
    type: string;                  // Tipo: "WORKS_FOR", "PART_OF", "INFLUENCES", etc.
    description: string;           // Descrição do relacionamento extraída via LLM
    properties: Record<string, any>; // Propriedades específicas
    weight: number;                // Força do relacionamento (0-1)
    bidirectional: boolean;        // Se o relacionamento é bidirecional
    keyValuePairs?: KeyValuePair[]; // Pares para busca (com temas globais)
    sourceDocuments: string[];     // IDs dos documentos fonte
    sourceChunks: string[];        // Chunks específicos de onde foi extraída
    confidence: number;            // Confiança da extração (0-1)
    createdAt: string;             // ISO datetime de criação
    updatedAt: string;             // ISO datetime de última atualização
    mergedFrom?: string[];         // IDs de relacionamentos que foram merged
}

// Key-value pairs for efficient search (LightRAG profiling system)
export interface KeyValuePair {
    key: string;                   // Palavra-chave para busca (indexada)
    value: string;                 // Parágrafo resumindo informações relevantes
    type: 'entity' | 'relationship';
    sourceId: string;              // ID da entidade/relacionamento origem
    themes?: string[];             // Temas globais conectados (para relationships)
    vector?: number[];             // Embedding do valor para similarity search
    indexedAt: string;             // ISO datetime de indexação
}

// Document metadata for uploaded files
export interface DocumentMetadata {
    title: string;                 // Título do documento
    author?: string;               // Autor se identificado
    tags?: string[];               // Tags manuais ou automáticas
    language?: string;             // Idioma detectado ou especificado
    filename: string;              // Nome do arquivo
    originalPath?: string;         // Caminho original se aplicável
    contentType: string;           // MIME type ou extensão
    size: number;                  // Tamanho em bytes
    uploadedAt: string;            // ISO datetime de upload
}

// Document with full processing information
export interface Document {
    id: string;                    // hash(path + content) ou UUID para uploads
    content: string;               // Texto completo do documento
    metadata: DocumentMetadata;    // Metadados do documento
    chunks: DocumentChunk[];       // Chunks para processamento
    entities: string[];            // IDs das entidades extraídas
    relationships: string[];       // IDs dos relacionamentos extraídos
    status: 'processing' | 'completed' | 'error'; // Status do processamento
    processingLog?: ProcessingLogEntry[]; // Log de processamento
    processedAt?: string;          // ISO datetime de conclusão
}

// Chunk for processing (temporary, not stored long-term)
export interface DocumentChunk {
    id: string;                    // hash(documentId + startChar + endChar)
    documentId: string;            // ID do documento pai
    startChar: number;             // Posição inicial no documento
    endChar: number;               // Posição final no documento
    text: string;                  // Texto do chunk
    entities: string[];            // IDs das entidades extraídas deste chunk
    relationships: string[];       // IDs dos relacionamentos extraídos
    vector?: number[];             // Embedding do chunk
    processingStatus: 'pending' | 'completed' | 'error';
    extractedAt?: string;          // ISO datetime de extração
}

// Processing log for audit trail
export interface ProcessingLogEntry {
    timestamp: string;             // ISO datetime
    step: 'chunking' | 'extraction' | 'deduplication' | 'indexing';
    status: 'started' | 'completed' | 'error';
    message: string;               // Mensagem descritiva
    details?: any;                 // Detalhes específicos do step
    entitiesFound?: number;        // Quantas entidades foram encontradas
    relationshipsFound?: number;   // Quantos relacionamentos foram encontrados
    duration?: number;             // Duração em ms
}

// Processing options for document upload
export interface ProcessingOptions {
    // Chunking options
    chunkingStrategy?: 'semantic' | 'fixed' | 'adaptive';
    maxChunkSize?: number;         // Maximum tokens per chunk
    chunkOverlap?: number;         // Overlap between chunks
    
    // LLM extraction options
    llmModel?: string;             // Which LLM to use for extraction
    temperature?: number;          // LLM temperature (0-1)
    maxTokens?: number;            // Max tokens for LLM responses
    
    // Entity extraction options
    entityTypes?: string[];        // Specific entity types to look for
    minConfidence?: number;        // Minimum confidence threshold (0-1)
    
    // Relationship extraction options
    relationshipTypes?: string[];  // Specific relationship types to look for
    minWeight?: number;            // Minimum relationship weight (0-1)
    
    // Deduplication options
    similarityThreshold?: number;  // Threshold for entity merging (0-1)
    autoMerge?: boolean;           // Auto-merge high confidence matches
    
    // Performance options
    batchSize?: number;            // Batch size for processing
    maxConcurrency?: number;       // Max concurrent operations
    timeout?: number;              // Processing timeout in ms
}

// Processing result returned after document processing
export interface ProcessingResult {
    documentId: string;
    status: 'processing' | 'completed' | 'error';
    entities: Entity[];
    relationships: Relationship[];
    processingTimeMs: number;
    processingLog: ProcessingLogEntry[];
    errors?: string[];
    warnings?: string[];
}

// Subgraph result for graph operations
export interface SubgraphResult {
    entities: Entity[];
    relationships: Relationship[];
    startingEntity: string;
    maxDepth: number;
    actualDepth: number;
    isTruncated: boolean;
}

// Search result types
export interface EntitySearchResult {
    entity: Entity;
    relevanceScore: number;
    matchType: 'exact' | 'semantic' | 'fuzzy';
    matchedFields: string[];
}

export interface RelationshipSearchResult {
    relationship: Relationship;
    relevanceScore: number;
    contextEntities: Entity[];
}

export interface KeyValueSearchResult {
    keyValuePair: KeyValuePair;
    relevanceScore: number;
    matchType: 'keyword' | 'semantic' | 'full-text';
}

// Dual-level retrieval results (LightRAG pattern)
export interface LowLevelRetrievalResult {
    entities: EntitySearchResult[];
    relationships: RelationshipSearchResult[];
    confidence: number;
    queryType: 'entity-specific';
}

export interface HighLevelRetrievalResult {
    concepts: Entity[];
    relationships: Relationship[];
    themes: string[];
    confidence: number;
    queryType: 'concept-abstract';
}

export interface DualLevelRetrievalResult {
    lowLevel: LowLevelRetrievalResult;
    highLevel: HighLevelRetrievalResult;
    combinedScore: number;
    explanation: string;
}

// Deduplication result types
export interface EntitySimilarity {
    entity: Entity;
    similarity: number;
}

export interface DeduplicationResult {
    entitiesToMerge: Array<{
        newEntity: Entity;
        targetEntity: Entity;
        confidence: number;
        suggestedAction: 'merge' | 'keep_separate';
    }>;
    relationshipsToMerge: Array<{
        newRelationship: Relationship;
        targetRelationship: Relationship;
        confidence: number;
        suggestedAction: 'merge' | 'keep_separate';
    }>;
    newEntities: Entity[];
    newRelationships: Relationship[];
    mergeConfidences: number[];
}

// Graph metrics for quality assessment
export interface GraphMetrics {
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
    avgConnectivity: number;
    isolatedEntities: number;
    stronglyConnectedComponents: number;
    density: number;
    avgClusteringCoefficient: number;
}

// Quality metrics for processing assessment
export interface QualityMetrics {
    documentQuality: {
        extractionAccuracy: number;      // % entidades aprovadas vs extraídas
        relationshipAccuracy: number;    // % relacionamentos aprovados
        processingTime: number;          // ms total
        humanReviewTime: number;         // ms gastos em validação
    };
    
    graphQuality: {
        entityDiversity: number;         // Tipos únicos de entidades
        relationshipDiversity: number;   // Tipos únicos de relacionamentos
        connectivityIndex: number;       // Quão bem conectado está o grafo
        isolatedNodes: number;           // Entidades sem relacionamentos
    };
    
    userSatisfaction: {
        rejectionRate: number;           // % entidades/relacionamentos rejeitados
        editRate: number;               // % que precisaram edição
        overallRating?: number;         // 1-5 rating opcional do usuário
    };
}

// Error types for better error handling
export class LightRAGError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'LightRAGError';
    }
}

export class ProcessingError extends LightRAGError {
    constructor(message: string, details?: any) {
        super(message, 'PROCESSING_ERROR', details);
    }
}

export class ValidationError extends LightRAGError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', details);
    }
}

export class StorageError extends LightRAGError {
    constructor(message: string, details?: any) {
        super(message, 'STORAGE_ERROR', details);
    }
}
