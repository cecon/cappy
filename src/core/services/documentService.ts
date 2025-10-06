import { 
    Document, 
    DocumentMetadata, 
    DocumentChunk 
} from '../../models/cappyragTypes';
import { CappyRAGDocument } from '../../store/cappyragLanceDb';
import { EmbeddingService } from './embeddingService';
import * as crypto from 'crypto';

/**
 * Document Management Service for CappyRAG
 * Handles document creation, chunking, and metadata processing
 */
export class DocumentService {
    
    constructor(private embeddingService: EmbeddingService) {}
    
    /**
     * Generate document ID from content and metadata
     */
    generateDocumentId(content: string, metadata: DocumentMetadata): string {
        const hash = crypto.createHash('sha256');
        hash.update(content + metadata.filename + metadata.uploadedAt);
        return `doc_${hash.digest('hex').substring(0, 16)}`;
    }
    
    /**
     * Create document with embedding and database integration
     */
    async createDocument(
        documentId: string,
        content: string,
        metadata: DocumentMetadata
    ): Promise<{ document: Document; cappyRagDocument: CappyRAGDocument }> {
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

        try {
            console.log(`[CappyRAG] Creating document record for: ${metadata.filename}`);
            
            // Create document summary for embedding (first 1000 chars + metadata)
            const documentSummary = `${metadata.filename} ${metadata.title || ''} ${content.substring(0, 1000)}`;
            const documentEmbedding = await this.embeddingService.generateEmbedding(documentSummary);
            
            // Convert to CappyRAGDocument format for LanceDB storage
            const cappyRagDocument: CappyRAGDocument = {
                id: documentId,
                title: metadata.title || metadata.filename || 'Untitled Document',
                description: `Document containing ${content.length} characters. Content type: ${metadata.contentType}`,
                category: this.inferCategoryFromContentType(metadata.contentType),
                tags: metadata.tags || [],
                filePath: metadata.originalPath || '',
                fileName: metadata.filename || 'unknown',
                fileSize: metadata.size || content.length,
                content: content,
                status: 'processing',
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                vector: documentEmbedding
            };
            
            console.log(`[CappyRAG] Document record created successfully: ${documentId}`);
            
            return { document, cappyRagDocument };
            
        } catch (error) {
            console.error(`[CappyRAG] Error creating document: ${error}`);
            
            // Create fallback CappyRAGDocument without embedding
            const fallbackCappyRagDocument: CappyRAGDocument = {
                id: documentId,
                title: metadata.title || metadata.filename || 'Untitled Document',
                description: `Document containing ${content.length} characters. Content type: ${metadata.contentType}`,
                category: this.inferCategoryFromContentType(metadata.contentType),
                tags: metadata.tags || [],
                filePath: metadata.originalPath || '',
                fileName: metadata.filename || 'unknown',
                fileSize: metadata.size || content.length,
                content: content,
                status: 'processing',
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                vector: new Array(384).fill(0) // Zero vector fallback
            };
            
            return { document, cappyRagDocument: fallbackCappyRagDocument };
        }
    }
    
    /**
     * Chunk document into smaller pieces for processing
     */
    async chunkDocument(
        document: Document,
        maxChunkSize: number = 512,
        chunkOverlap: number = 50
    ): Promise<DocumentChunk[]> {
        // Simple sentence-based chunking for now
        const sentences = this.splitIntoSentences(document.content);
        const chunks: DocumentChunk[] = [];
        
        let currentChunk = '';
        let startChar = 0;

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
    
    /**
     * Infer document category from content type
     */
    private inferCategoryFromContentType(contentType: string): string {
        if (contentType.includes('javascript') || contentType.includes('typescript')) {
            return 'code';
        }
        if (contentType.includes('python')) {
            return 'code';
        }
        if (contentType.includes('java') || contentType.includes('cpp') || contentType.includes('c++')) {
            return 'code';
        }
        if (contentType.includes('html') || contentType.includes('css')) {
            return 'web';
        }
        if (contentType.includes('json') || contentType.includes('yaml') || contentType.includes('xml')) {
            return 'config';
        }
        if (contentType.includes('markdown') || contentType.includes('md')) {
            return 'documentation';
        }
        if (contentType.includes('text') || contentType.includes('txt')) {
            return 'text';
        }
        if (contentType.includes('pdf') || contentType.includes('doc')) {
            return 'document';
        }
        return 'general';
    }
    
    /**
     * Generate chunk ID
     */
    private generateChunkId(documentId: string, startChar: number, endChar: number): string {
        const hash = crypto.createHash('sha256');
        hash.update(`${documentId}_${startChar}_${endChar}`);
        return `chunk_${hash.digest('hex').substring(0, 16)}`;
    }
    
    /**
     * Split text into sentences
     */
    private splitIntoSentences(text: string): string[] {
        // Simple sentence splitting - TODO: use more sophisticated NLP
        return text.split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(s => s + '.');
    }
}