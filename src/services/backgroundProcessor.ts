/**
 * Background Processor Service
 * Processes documents from the queue using Copilot for intelligent analysis
 */

import * as vscode from 'vscode';
import { 
    DocumentProcessingQueue, 
    getProcessingQueue, 
    ProcessingStatus,
    QueuedDocument 
} from './documentProcessingQueue';
import { getDatabase } from '../commands/cappyrag/utils/databaseHelper';

export interface ChunkAnalysis {
    entities: Array<{
        name: string;
        type: string;
        description: string;
    }>;
    relationships: Array<{
        source: string;
        target: string;
        type: string;
        description: string;
    }>;
    summary: string;
}

/**
 * Background Document Processor
 * Manages intelligent document processing with Copilot
 */
export class BackgroundProcessor {
    private queue: DocumentProcessingQueue;
    private isRunning = false;
    private processingInterval: NodeJS.Timeout | null = null;
    private copilotAvailable = false;
    private onDocumentCompletedCallbacks: Array<(documentId: string) => void> = [];

    constructor() {
        this.queue = getProcessingQueue();
    }

    /**
     * Register callback for when document processing completes
     */
    onDocumentCompleted(callback: (documentId: string) => void): void {
        this.onDocumentCompletedCallbacks.push(callback);
    }

    /**
     * Trigger all registered callbacks
     */
    private triggerDocumentCompleted(documentId: string): void {
        for (const callback of this.onDocumentCompletedCallbacks) {
            try {
                callback(documentId);
            } catch (error) {
                console.error('[Processor] Callback error:', error);
            }
        }
    }

    /**
     * Check if Copilot is available
     */
    async checkCopilotAvailability(): Promise<boolean> {
        try {
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o'
            });
            
            this.copilotAvailable = models.length > 0;
            
            if (!this.copilotAvailable) {
                console.warn('[Processor] GitHub Copilot is not available');
            } else {
                console.log('[Processor] GitHub Copilot is available');
            }
            
            return this.copilotAvailable;
        } catch (error) {
            console.error('[Processor] Failed to check Copilot availability:', error);
            this.copilotAvailable = false;
            return false;
        }
    }

    /**
     * Start background processing
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('[Processor] Already running');
            return;
        }

        // Check Copilot availability first
        const available = await this.checkCopilotAvailability();
        if (!available) {
            vscode.window.showWarningMessage(
                'GitHub Copilot is required for document processing. Please sign in to GitHub Copilot to enable this feature.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'github.copilot');
                }
            });
            return;
        }

        this.isRunning = true;
        console.log('[Processor] Background processor started');

        // Process queue every 5 seconds
        this.processingInterval = setInterval(() => {
            this.processNextDocument();
        }, 5000);

        // Process immediately on start
        this.processNextDocument();
    }

    /**
     * Stop background processing
     */
    stop(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.isRunning = false;
        console.log('[Processor] Background processor stopped');
    }

    /**
     * Process next document in queue
     */
    private async processNextDocument(): Promise<void> {
        // Check if already processing
        if (this.queue.isQueueProcessing()) {
            return;
        }

        // Get next pending document
        const doc = this.queue.getNextPending();
        if (!doc) {
            return;
        }

        console.log(`[Processor] Starting to process: ${doc.title}`);
        this.queue.setProcessing(true);

        try {
            await this.queue.updateStatus(doc.id, ProcessingStatus.processing);
            await this.processDocument(doc);
            await this.queue.updateStatus(doc.id, ProcessingStatus.completed);
            
            // Update document status in database
            const db = getDatabase();
            await db.initialize();
            
            await db.updateDocumentStatus(
                doc.documentId,
                'completed',
                {
                    entities: doc.extractedEntities,
                    relationships: doc.extractedRelationships,
                    chunks: doc.totalChunks,
                    processingTime: '00:00:00'
                }
            );
            
            console.log(`[Processor] Document ${doc.documentId} marked as completed in database`);
            
            // Trigger callbacks to refresh UI
            this.triggerDocumentCompleted(doc.documentId);
            
            vscode.window.showInformationMessage(
                `✅ Document "${doc.title}" processed successfully! Extracted ${doc.extractedEntities} entities and ${doc.extractedRelationships} relationships.`
            );
        } catch (error) {
            console.error('[Processor] Failed to process document:', error);
            await this.queue.updateStatus(
                doc.id, 
                ProcessingStatus.failed, 
                error instanceof Error ? error.message : 'Unknown error'
            );
            
            vscode.window.showErrorMessage(
                `❌ Failed to process document "${doc.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        } finally {
            this.queue.setProcessing(false);
        }
    }

    /**
     * Process a single document
     */
    private async processDocument(doc: QueuedDocument): Promise<void> {
        const db = getDatabase();
        await db.initialize();

        // Step 1: Chunk the document
        await this.queue.updateProgress(doc.id, {
            currentStep: 'Chunking document...',
            progress: 10
        });

        const chunks = this.chunkDocument(doc.content, 1000); // 1000 chars per chunk
        
        await this.queue.updateProgress(doc.id, {
            totalChunks: chunks.length,
            processedChunks: 0,
            progress: 15
        });

        console.log(`[Processor] Document chunked into ${chunks.length} chunks`);

        // Step 2: Analyze each chunk with Copilot
        const allEntities: Map<string, any> = new Map();
        const allRelationships: any[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const progress = 15 + ((i / chunks.length) * 70); // 15% to 85%

            await this.queue.updateProgress(doc.id, {
                currentStep: `Analyzing chunk ${i + 1}/${chunks.length} with Copilot...`,
                progress: Math.floor(progress),
                processedChunks: i
            });

            console.log(`[Processor] Analyzing chunk ${i + 1}/${chunks.length}`);

            try {
                const analysis = await this.analyzeChunkWithCopilot(chunk, doc.title);

                // Store entities
                for (const entity of analysis.entities) {
                    if (!allEntities.has(entity.name.toLowerCase())) {
                        const entityId = await db.addEntity({
                            name: entity.name,
                            type: entity.type,
                            description: entity.description,
                            documentIds: [doc.documentId]
                        });
                        allEntities.set(entity.name.toLowerCase(), entityId);
                    }
                }

                // Store relationships
                for (const rel of analysis.relationships) {
                    const sourceId = allEntities.get(rel.source.toLowerCase());
                    const targetId = allEntities.get(rel.target.toLowerCase());

                    if (sourceId && targetId) {
                        const relId = await db.addRelationship({
                            source: sourceId,
                            target: targetId,
                            type: rel.type,
                            description: rel.description,
                            weight: 1.0,
                            documentIds: [doc.documentId]
                        });
                        allRelationships.push(relId);
                    }
                }

                // Store chunk
                await db.addChunk({
                    documentId: doc.documentId,
                    content: chunk,
                    startPosition: i * 1000,
                    endPosition: Math.min((i + 1) * 1000, doc.content.length),
                    chunkIndex: i,
                    entities: Array.from(allEntities.values()),
                    relationships: allRelationships
                });

            } catch (error) {
                console.error(`[Processor] Failed to analyze chunk ${i + 1}:`, error);
                // Continue with next chunk even if one fails
            }
        }

        // Step 3: Finalize
        await this.queue.updateProgress(doc.id, {
            currentStep: 'Finalizing...',
            progress: 90,
            processedChunks: chunks.length,
            extractedEntities: allEntities.size,
            extractedRelationships: allRelationships.length
        });

        console.log(`[Processor] Processing completed: ${allEntities.size} entities, ${allRelationships.length} relationships`);

        await this.queue.updateProgress(doc.id, {
            currentStep: 'Completed',
            progress: 100
        });
    }

    /**
     * Chunk document into smaller pieces
     */
    private chunkDocument(content: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        
        for (let i = 0; i < content.length; i += chunkSize) {
            chunks.push(content.substring(i, i + chunkSize));
        }
        
        return chunks;
    }

    /**
     * Analyze chunk using Copilot
     */
    private async analyzeChunkWithCopilot(chunk: string, documentTitle: string): Promise<ChunkAnalysis> {
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
        });

        if (models.length === 0) {
            throw new Error('No Copilot model available');
        }

        const model = models[0];

        const prompt = `Analyze this text chunk from document "${documentTitle}" and extract:

1. **Entities**: Important concepts, people, places, technologies, or things mentioned.
2. **Relationships**: How entities relate to each other.
3. **Summary**: Brief summary of the chunk content.

Text chunk:
"""
${chunk}
"""

Respond in JSON format:
{
    "entities": [
        {
            "name": "Entity Name",
            "type": "person|place|concept|technology|organization",
            "description": "Brief description"
        }
    ],
    "relationships": [
        {
            "source": "Entity1",
            "target": "Entity2",
            "type": "uses|contains|implements|relates_to",
            "description": "How they relate"
        }
    ],
    "summary": "Brief summary of this chunk"
}`;

        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        
        // Create cancellation token
        const tokenSource = new vscode.CancellationTokenSource();
        
        // Send request with proper options
        const response = await model.sendRequest(messages, {
            justification: 'Analyzing document chunk to extract entities and relationships for CappyRAG knowledge base'
        }, tokenSource.token);

        let fullResponse = '';
        for await (const chunk of response.text) {
            fullResponse += chunk;
        }

        // Parse JSON response
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse Copilot response');
        }

        const analysis: ChunkAnalysis = JSON.parse(jsonMatch[0]);
        return analysis;
    }

    /**
     * Get processing queue instance
     */
    getQueue(): DocumentProcessingQueue {
        return this.queue;
    }

    /**
     * Check if Copilot is available (cached)
     */
    isCopilotAvailable(): boolean {
        return this.copilotAvailable;
    }
}

// Singleton instance
let processorInstance: BackgroundProcessor | null = null;

export function getBackgroundProcessor(): BackgroundProcessor {
    if (!processorInstance) {
        processorInstance = new BackgroundProcessor();
    }
    return processorInstance;
}
