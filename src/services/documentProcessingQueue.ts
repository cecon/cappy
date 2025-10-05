/**
 * Document Processing Queue System
 * Manages async document processing with Copilot analysis
 */

export enum ProcessingStatus {
    pending = 'pending',
    processing = 'processing',
    completed = 'completed',
    failed = 'failed'
}

export interface QueuedDocument {
    id: string;
    documentId: string;
    title: string;
    fileName: string;
    content: string;
    status: ProcessingStatus;
    progress: number; // 0-100
    currentStep: string;
    totalChunks: number;
    processedChunks: number;
    extractedEntities: number;
    extractedRelationships: number;
    error?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
}

export interface ProcessingProgress {
    queueId: string;
    status: ProcessingStatus;
    progress: number;
    currentStep: string;
    processedChunks: number;
    totalChunks: number;
    extractedEntities: number;
    extractedRelationships: number;
}

/**
 * Document Processing Queue
 * Manages the queue of documents waiting for AI processing
 */
export class DocumentProcessingQueue {
    private queue: QueuedDocument[] = [];
    private isProcessing = false;
    private maxConcurrent = 1; // Process one document at a time
    
    constructor() {
        this.loadQueue();
    }

    /**
     * Add document to processing queue
     */
    async enqueue(document: {
        documentId: string;
        title: string;
        fileName: string;
        content: string;
    }): Promise<string> {
        const queueId = `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const queuedDoc: QueuedDocument = {
            id: queueId,
            documentId: document.documentId,
            title: document.title,
            fileName: document.fileName,
            content: document.content,
            status: ProcessingStatus.pending,
            progress: 0,
            currentStep: 'Queued for processing',
            totalChunks: 0,
            processedChunks: 0,
            extractedEntities: 0,
            extractedRelationships: 0,
            createdAt: new Date().toISOString()
        };

        this.queue.push(queuedDoc);
        await this.saveQueue();
        
        console.log(`[Queue] Document enqueued: ${queueId} - ${document.title}`);
        
        return queueId;
    }

    /**
     * Get queue status
     */
    getQueueStatus(): {
        total: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    } {
        return {
            total: this.queue.length,
            pending: this.queue.filter(d => d.status === ProcessingStatus.pending).length,
            processing: this.queue.filter(d => d.status === ProcessingStatus.processing).length,
            completed: this.queue.filter(d => d.status === ProcessingStatus.completed).length,
            failed: this.queue.filter(d => d.status === ProcessingStatus.failed).length
        };
    }

    /**
     * Get all queued documents
     */
    getAllQueued(): QueuedDocument[] {
        return [...this.queue];
    }

    /**
     * Get all items (alias for getAllQueued for consistency)
     */
    getAllItems(): QueuedDocument[] {
        return this.getAllQueued();
    }

    /**
     * Get document by queue ID
     */
    getById(queueId: string): QueuedDocument | undefined {
        return this.queue.find(d => d.id === queueId);
    }

    /**
     * Get next document to process
     */
    getNextPending(): QueuedDocument | undefined {
        return this.queue.find(d => d.status === ProcessingStatus.pending);
    }

    /**
     * Update document status
     */
    async updateStatus(queueId: string, status: ProcessingStatus, error?: string): Promise<void> {
        const doc = this.queue.find(d => d.id === queueId);
        if (!doc) {
            return;
        }

        doc.status = status;
        
        if (status === ProcessingStatus.processing) {
            doc.startedAt = new Date().toISOString();
        } else if (status === ProcessingStatus.completed || status === ProcessingStatus.failed) {
            doc.completedAt = new Date().toISOString();
            doc.progress = status === ProcessingStatus.completed ? 100 : doc.progress;
        }

        if (error) {
            doc.error = error;
        }

        await this.saveQueue();
    }

    /**
     * Update processing progress
     */
    async updateProgress(queueId: string, progress: Partial<ProcessingProgress>): Promise<void> {
        const doc = this.queue.find(d => d.id === queueId);
        if (!doc) {
            return;
        }

        if (progress.progress !== undefined) {
            doc.progress = progress.progress;
        }
        if (progress.currentStep) {
            doc.currentStep = progress.currentStep;
        }
        if (progress.processedChunks !== undefined) {
            doc.processedChunks = progress.processedChunks;
        }
        if (progress.totalChunks !== undefined) {
            doc.totalChunks = progress.totalChunks;
        }
        if (progress.extractedEntities !== undefined) {
            doc.extractedEntities = progress.extractedEntities;
        }
        if (progress.extractedRelationships !== undefined) {
            doc.extractedRelationships = progress.extractedRelationships;
        }

        await this.saveQueue();
    }

    /**
     * Remove completed/failed documents from queue
     */
    async clearCompleted(): Promise<void> {
        this.queue = this.queue.filter(
            d => d.status !== ProcessingStatus.completed && d.status !== ProcessingStatus.failed
        );
        await this.saveQueue();
    }

    /**
     * Retry failed document
     */
    async retry(queueId: string): Promise<void> {
        const doc = this.queue.find(d => d.id === queueId);
        if (!doc || doc.status !== ProcessingStatus.failed) {
            return;
        }

        doc.status = ProcessingStatus.pending;
        doc.progress = 0;
        doc.currentStep = 'Retrying...';
        doc.error = undefined;
        doc.startedAt = undefined;
        doc.completedAt = undefined;

        await this.saveQueue();
    }

    /**
     * Check if queue is currently processing
     */
    isQueueProcessing(): boolean {
        return this.isProcessing;
    }

    /**
     * Set processing state
     */
    setProcessing(state: boolean): void {
        this.isProcessing = state;
    }

    /**
     * Save queue to local storage
     */
    private async saveQueue(): Promise<void> {
        try {
            // In a real implementation, this would save to LanceDB
            // For now, we'll keep it in memory
            console.log(`[Queue] Queue saved: ${this.queue.length} documents`);
        } catch (error) {
            console.error('[Queue] Failed to save queue:', error);
        }
    }

    /**
     * Load queue from storage
     */
    private loadQueue(): void {
        try {
            // In a real implementation, this would load from LanceDB
            console.log('[Queue] Queue loaded');
        } catch (error) {
            console.error('[Queue] Failed to load queue:', error);
        }
    }
}

// Singleton instance
let queueInstance: DocumentProcessingQueue | null = null;

export function getProcessingQueue(): DocumentProcessingQueue {
    if (!queueInstance) {
        queueInstance = new DocumentProcessingQueue();
    }
    return queueInstance;
}
