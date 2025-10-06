import * as vscode from 'vscode';
import { 
    Document, 
    DocumentMetadata, 
    ProcessingOptions, 
    ProcessingResult, 
    ProcessingLogEntry
} from '../models/cappyragTypes';
import { CappyRAGLanceDatabase } from '../store/cappyragLanceDb';

// Import all services
import { EmbeddingService } from './services/embeddingService';
import { LLMService } from './services/llmService';
import { EntityExtractionService } from './services/entityExtractionService';
import { RelationshipExtractionService } from './services/relationshipExtractionService';
import { DocumentService } from './services/documentService';
import { StorageService } from './services/storageService';

/**
 * CappyRAG Document Processor (Modularized)
 * Orchestrates document processing through specialized services
 * 
 * ARCHITECTURE:
 * ✅ Modular service-based design
 * ✅ Separation of concerns
 * ✅ Dependency injection
 * ✅ Single responsibility principle
 * ✅ Testable components
 * ✅ Maintainable codebase
 */
export class CappyRAGDocumentProcessor {
    private database: CappyRAGLanceDatabase;
    
    // Services
    private embeddingService: EmbeddingService;
    private llmService: LLMService;
    private entityExtractionService: EntityExtractionService;
    private relationshipExtractionService: RelationshipExtractionService;
    private documentService: DocumentService;
    private storageService: StorageService;

    constructor(context: vscode.ExtensionContext) {
        // Initialize database
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;
        this.database = new CappyRAGLanceDatabase(workspacePath);
        
        // Initialize services with dependency injection
        this.embeddingService = new EmbeddingService(context);
        this.llmService = new LLMService();
        this.entityExtractionService = new EntityExtractionService(
            this.database,
            this.llmService,
            this.embeddingService
        );
        this.relationshipExtractionService = new RelationshipExtractionService(
            this.database,
            this.llmService
        );
        this.documentService = new DocumentService(this.embeddingService);
        this.storageService = new StorageService(this.database);
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
        const documentId = this.documentService.generateDocumentId(content, metadata);
        const processingLog: ProcessingLogEntry[] = [];

        try {
            // Step 1: Create document record
            this.logStep(processingLog, 'chunking', 'started', 'Creating document record');
            const { document, cappyRagDocument } = await this.documentService.createDocument(
                documentId, 
                content, 
                metadata
            );
            
            // Store document in database
            await this.storageService.storeDocument(cappyRagDocument);
            this.logStep(processingLog, 'chunking', 'completed', 'Document record created and stored');

            // Step 2: Chunk document
            this.logStep(processingLog, 'chunking', 'started', 'Chunking document');
            const chunks = await this.documentService.chunkDocument(
                document,
                options?.maxChunkSize || 512,
                options?.chunkOverlap || 50
            );
            document.chunks = chunks;
            this.logStep(processingLog, 'chunking', 'completed', 
                `Document chunked into ${chunks.length} pieces`, { chunksCreated: chunks.length });

            // Step 3: Extract entities
            this.logStep(processingLog, 'extraction', 'started', 'Extracting entities via LLM');
            const entities = await this.entityExtractionService.extractEntities(
                chunks, 
                options?.entityTypes
            );
            document.entities = entities.map(e => e.id); // Store entity IDs
            this.logStep(processingLog, 'extraction', 'completed', 
                `Found ${entities.length} entities`, { entitiesFound: entities.length });

            // Step 4: Extract relationships
            this.logStep(processingLog, 'extraction', 'started', 'Extracting relationships via LLM');
            const relationships = await this.relationshipExtractionService.extractRelationships(
                chunks, 
                entities
            );
            document.relationships = relationships.map(r => r.id); // Store relationship IDs
            this.logStep(processingLog, 'extraction', 'completed', 
                `Found ${relationships.length} relationships`, { relationshipsFound: relationships.length });

            // Step 5: Deduplication
            this.logStep(processingLog, 'deduplication', 'started', 'Checking for duplicate entities');
            const deduplicationResult = await this.storageService.deduplicateEntities(
                entities, 
                relationships
            );
            this.logStep(processingLog, 'deduplication', 'completed', 
                `Processed ${deduplicationResult.newEntities.length} unique entities`);

            // Step 6: Store results
            this.logStep(processingLog, 'indexing', 'started', 'Storing entities and relationships');
            await this.storageService.storeResults(document, deduplicationResult);
            this.logStep(processingLog, 'indexing', 'completed', 'Document successfully indexed');

            const processingTimeMs = Date.now() - startTime;
            document.status = 'completed';
            document.processingLog = processingLog;

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
    
    /**
     * Get performance metrics from embedding service
     */
    getPerformanceMetrics() {
        return this.embeddingService.getPerformanceMetrics();
    }
    
    /**
     * Log processing step
     */
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