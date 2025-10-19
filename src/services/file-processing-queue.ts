/**
 * @fileoverview File processing queue with transaction support and rollback
 * @module services/file-processing-queue
 * @author Cappy Team
 * @since 3.0.5
 */

import { FileMetadataDatabase, type FileMetadata } from './file-metadata-database';
import { FileProcessingWorker, type ProcessingResult } from './file-processing-worker';
import { EventEmitter } from 'events';

/**
 * Queue configuration
 */
export interface QueueConfig {
  concurrency: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
  autoStart: boolean;
}

/**
 * Queue events
 */
export interface QueueEvents {
  'file:start': (metadata: FileMetadata) => void;
  'file:progress': (metadata: FileMetadata) => void;
  'file:complete': (metadata: FileMetadata, result: ProcessingResult) => void;
  'file:failed': (metadata: FileMetadata, error: Error) => void;
  'queue:empty': () => void;
  'queue:paused': () => void;
  'queue:resumed': () => void;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * File processing queue with transactional support
 */
export class FileProcessingQueue extends EventEmitter {
  private database: FileMetadataDatabase;
  private worker: FileProcessingWorker;
  private config: QueueConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private activeProcesses: Set<string> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    database: FileMetadataDatabase,
    worker: FileProcessingWorker,
    config: Partial<QueueConfig> = {}
  ) {
    super();
    this.database = database;
    this.worker = worker;
    this.config = {
      concurrency: config.concurrency || 2,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      autoStart: config.autoStart ?? true
    };

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Adds a file to the processing queue
   */
  async enqueue(filePath: string, fileHash: string): Promise<string> {
    // Check if file already exists
    const existing = this.database.getFileByPath(filePath);
    if (existing) {
      // If it's failed and retriable, reset it
      if (existing.status === 'failed' && existing.retryCount < existing.maxRetries) {
        this.database.updateFile(existing.id, {
          status: 'pending',
          errorMessage: undefined,
          processingStartedAt: undefined
        });
        return existing.id;
      }
      // If it's completed, return existing ID
      if (existing.status === 'completed') {
        return existing.id;
      }
      // If it's pending or processing, return existing ID
      return existing.id;
    }

    // Create new entry
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    
    // Determine initial file size if available
    let initialSize = 0;
    try {
      const fs = await import('fs');
      if (fs.existsSync(filePath)) {
        initialSize = fs.statSync(filePath).size;
      }
    } catch {
      // ignore
    }

    this.database.insertFile({
      id: fileId,
      filePath,
      fileName,
      fileSize: initialSize, // Best effort; will be updated during processing
      fileHash,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      maxRetries: this.config.maxRetries
    });

    console.log(`📝 File enqueued: ${fileName} (${fileId})`);
    
    // Trigger processing if queue is running
    if (this.isRunning && !this.isPaused) {
      this.processNext();
    }

    return fileId;
  }

  /**
   * Enqueues a file with embedded content (no physical file)
   * Used for uploaded files stored directly in database
   */
  async enqueueWithContent(
    virtualPath: string,
    fileName: string,
    fileHash: string,
    base64Content: string,
    fileSize: number
  ): Promise<string> {
    // Check if file already exists by path
    const existing = this.database.getFileByPath(virtualPath);
    if (existing) {
      // If it's failed and retriable, reset it
      if (existing.status === 'failed' && existing.retryCount < existing.maxRetries) {
        this.database.updateFile(existing.id, {
          status: 'pending',
          errorMessage: undefined,
          processingStartedAt: undefined
        });
        return existing.id;
      }
      // If it's completed, return existing ID
      if (existing.status === 'completed') {
        return existing.id;
      }
      // If it's pending or processing, return existing ID
      return existing.id;
    }

    // Create new entry with embedded content
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    this.database.insertFile({
      id: fileId,
      filePath: virtualPath,
      fileName,
      fileSize,
      fileHash,
      fileContent: base64Content, // Store content in database
      status: 'pending',
      progress: 0,
      retryCount: 0,
      maxRetries: this.config.maxRetries
    });

    console.log(`📝 File enqueued with embedded content: ${fileName} (${fileId})`);
    
    // Trigger processing if queue is running
    if (this.isRunning && !this.isPaused) {
      this.processNext();
    }

    return fileId;
  }

  /**
   * Starts the queue processing
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    console.log('▶️  File processing queue started');
    
    // Start polling for pending files
    this.processingInterval = setInterval(() => {
      if (!this.isPaused) {
        this.processNext();
      }
    }, 1000);

    // Process immediately
    this.processNext();
  }

  /**
   * Pauses the queue processing
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    
    this.isPaused = true;
    console.log('⏸️  File processing queue paused');
    this.emit('queue:paused');
  }

  /**
   * Resumes the queue processing
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    
    this.isPaused = false;
    console.log('▶️  File processing queue resumed');
    this.emit('queue:resumed');
    this.processNext();
  }

  /**
   * Stops the queue processing
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    console.log('⏹️  File processing queue stopped');
  }

  /**
   * Gets queue statistics
   */
  getStats(): QueueStats {
    const dbStats = this.database.getStats();
    return {
      pending: dbStats.pending,
      processing: dbStats.processing,
      completed: dbStats.completed,
      failed: dbStats.failed,
      total: dbStats.total
    };
  }

  /**
   * Retries all failed files
   */
  retryFailed(): void {
    this.database.resetFailedFiles();
    console.log('🔄 Retrying all failed files');
    
    if (this.isRunning && !this.isPaused) {
      this.processNext();
    }
  }

  /**
   * Clears all completed files from the database
   */
  clearCompleted(): void {
    this.database.deleteFilesByStatus('completed');
    console.log('🗑️  Cleared all completed files');
  }

  /**
   * Clears all files from the database
   */
  clearAll(): void {
    this.database.clearAll();
    this.activeProcesses.clear();
    console.log('🗑️  Cleared all files from queue');
  }

  /**
   * Processes next available files from the queue
   */
  private async processNext(): Promise<void> {
    // Check if we can process more files
    if (this.activeProcesses.size >= this.config.concurrency) {
      return;
    }

    // Get pending files
    const availableSlots = this.config.concurrency - this.activeProcesses.size;
    const pendingFiles = this.database.getPendingFiles(availableSlots);

    if (pendingFiles.length === 0) {
      // Check if queue is completely empty
      if (this.activeProcesses.size === 0) {
        this.emit('queue:empty');
      }
      return;
    }

    // Process each pending file
    for (const file of pendingFiles) {
      if (this.activeProcesses.size >= this.config.concurrency) {
        break;
      }
      
      this.processFile(file).catch(error => {
        console.error(`Error processing file ${file.filePath}:`, error);
      });
    }
  }

  /**
   * Processes a single file with transaction support
   */
  private async processFile(metadata: FileMetadata): Promise<void> {
    // Mark as processing
    this.activeProcesses.add(metadata.id);
    
    try {
      console.log(`[Queue] 🔄 Starting to process file: ${metadata.fileName} (${metadata.id})`);
      
      const now = new Date().toISOString();
      // Ensure file size is recorded
      let actualSize = metadata.fileSize;
      try {
        const fs = await import('fs');
        if (fs.existsSync(metadata.filePath)) {
          actualSize = fs.statSync(metadata.filePath).size;
        }
      } catch { /* ignore */ }

      this.database.updateFile(metadata.id, {
        status: 'processing',
        progress: 0,
        processingStartedAt: now,
        currentStep: 'Starting...',
        fileSize: actualSize
      });

      // Emit start event
      const updatedMetadata = this.database.getFile(metadata.id);
      if (updatedMetadata) {
        this.emit('file:start', updatedMetadata);
      }

      console.log(`[Queue] 📝 File marked as processing, calling worker...`);

      // Process file with worker (with progress callback and embedded content if available)
      const result = await this.worker.processFile(
        metadata.filePath,
        (step: string, progress: number) => {
          console.log(`[Queue] 📊 Progress update: ${step} (${progress}%)`);
          this.database.updateFile(metadata.id, {
            currentStep: step,
            progress
          });

          const updated = this.database.getFile(metadata.id);
          if (updated) {
            this.emit('file:progress', updated);
          }
        },
        metadata.fileContent // Pass embedded content if available
      );

      console.log(`[Queue] ✅ Worker completed, updating database...`);

      if (result.chunksCount === 0) {
        // Mark as failed if no content was generated
        this.database.updateFile(metadata.id, {
          status: 'failed',
          progress: 0,
          currentStep: 'Failed',
          errorMessage: 'No chunks generated from file',
          processingCompletedAt: new Date().toISOString(),
          chunksCount: result.chunksCount,
          nodesCount: result.nodesCount,
          relationshipsCount: result.relationshipsCount
        });
      } else {
        // Update as completed
        this.database.updateFile(metadata.id, {
          status: 'completed',
          progress: 100,
          currentStep: 'Completed',
          errorMessage: undefined, // Clear any previous error messages
          processingCompletedAt: new Date().toISOString(),
          chunksCount: result.chunksCount,
          nodesCount: result.nodesCount,
          relationshipsCount: result.relationshipsCount
        });
      }

      const completedMetadata = this.database.getFile(metadata.id);
      if (completedMetadata) {
        this.emit('file:complete', completedMetadata, result);
      }

      console.log(`✅ File processed successfully: ${metadata.fileName}`);

    } catch (error) {
      // Handle failure with retry logic
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'N/A';
      const newRetryCount = metadata.retryCount + 1;
      
      console.error(`[Queue] ❌ File processing failed: ${metadata.fileName}`);
      console.error(`[Queue] ❌ Error message:`, errorMessage);
      console.error(`[Queue] ❌ Error stack:`, errorStack);

      if (newRetryCount < this.config.maxRetries) {
        // Mark as pending for retry
        this.database.updateFile(metadata.id, {
          status: 'pending',
          retryCount: newRetryCount,
          errorMessage,
          processingCompletedAt: new Date().toISOString()
        });

        console.log(`🔄 Will retry file (${newRetryCount}/${this.config.maxRetries}): ${metadata.fileName}`);
        
        // Schedule retry with delay
        setTimeout(() => {
          if (this.isRunning && !this.isPaused) {
            this.processNext();
          }
        }, this.config.retryDelay);
      } else {
        // Mark as failed permanently
        this.database.updateFile(metadata.id, {
          status: 'failed',
          errorMessage,
          processingCompletedAt: new Date().toISOString()
        });

        const failedMetadata = this.database.getFile(metadata.id);
        if (failedMetadata) {
          this.emit('file:failed', failedMetadata, error as Error);
        }
        
        console.log(`💀 File failed permanently: ${metadata.fileName}`);
      }
    } finally {
      // Remove from active processes
      this.activeProcesses.delete(metadata.id);
      
      // Process next file
      if (this.isRunning && !this.isPaused) {
        setImmediate(() => this.processNext());
      }
    }
  }
}
