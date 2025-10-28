/**
 * @fileoverview Unified queue processor with state machine for file processing
 * @module services/unified-queue-processor
 * @author Cappy Team
 * @since 3.1.0
 * 
 * This processor handles all file processing through a unified queue based on
 * the file_metadata table status. It implements a state machine that transitions
 * files through different processing stages.
 */

import { EventEmitter } from 'events';
import { FileMetadataDatabase, type FileMetadata, type FileProcessingStatus } from './file-metadata-database';
import { FileProcessingWorker, type ProgressCallback } from './file-processing-worker';

/**
 * Queue processor configuration
 */
export interface QueueProcessorConfig {
  concurrency: number;        // Max files processed in parallel
  pollInterval: number;        // Milliseconds between queue checks
  batchSize: number;          // Max files to fetch per poll
  maxRetries: number;         // Max retries before marking as error
  retryDelay: number;         // Milliseconds to wait before retry
}

/**
 * Queue processor events
 */
export interface QueueProcessorEvents {
  'file:start': (metadata: FileMetadata) => void;
  'file:progress': (metadata: FileMetadata) => void;
  'file:state-change': (metadata: FileMetadata, from: FileProcessingStatus, to: FileProcessingStatus) => void;
  'file:complete': (metadata: FileMetadata) => void;
  'file:error': (metadata: FileMetadata, error: Error) => void;
  'queue:empty': () => void;
  'queue:paused': () => void;
  'queue:resumed': () => void;
  'queue:stopped': () => void;
}

/**
 * Unified queue processor with state machine
 * 
 * State transitions:
 * pending -> processing -> extracting_entities -> creating_relationships -> entity_discovery -> processed
 *         -> paused (user action)
 *         -> error (on failure)
 */
export class UnifiedQueueProcessor extends EventEmitter {
  private database: FileMetadataDatabase;
  private worker: FileProcessingWorker;
  private config: QueueProcessorConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private activeProcesses: Set<string> = new Set();

  constructor(
    database: FileMetadataDatabase,
    worker: FileProcessingWorker,
    config: Partial<QueueProcessorConfig> = {}
  ) {
    super();
    this.database = database;
    this.worker = worker;
    this.config = {
      concurrency: config.concurrency || 2,
      pollInterval: config.pollInterval || 1000,
      batchSize: config.batchSize || 10,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000
    };
  }

  /**
   * Starts the queue processor
   */
  start(): void {
    if (this.isRunning) return;

    console.log('🚀 Starting UnifiedQueueProcessor...');
    this.isRunning = true;
    this.isPaused = false;

    // Start polling for pending files
    this.processingInterval = setInterval(() => {
      if (!this.isPaused) {
        this.processNextBatch().catch(error => {
          console.error('❌ Error in processNextBatch:', error);
        });
      }
    }, this.config.pollInterval);

    console.log(`✅ Queue processor started (concurrency: ${this.config.concurrency}, poll: ${this.config.pollInterval}ms)`);
  }

  /**
   * Stops the queue processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🛑 Stopping UnifiedQueueProcessor...');
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Mark all processing files as paused
    const processingFiles = await this.database.getFilesByStatus('processing');
    for (const file of processingFiles) {
      await this.transitionState(file.id, 'processing', 'paused');
    }

    this.emit('queue:stopped');
    console.log('✅ Queue processor stopped');
  }

  /**
   * Resumes queue processing (un-pauses paused files)
   */
  async resume(): Promise<void> {
    console.log('▶️ Resuming queue processor...');

    // Mark all paused files as pending
    const processingFiles = await this.database.getFilesByStatus('processing');
    for (const file of processingFiles) {
      await this.transitionState(file.id, 'processing', 'pending');
    }

    this.emit('queue:resumed');
    console.log('✅ Queue resumed');
  }

  /**
   * Resets failed files to pending state
   */
  async retryFailed(): Promise<void> {
    console.log('🔄 Retrying failed files...');

    const pausedFiles = await this.database.getFilesByStatus('paused');
    for (const file of pausedFiles) {
      await this.transitionState(file.id, 'paused', 'pending');
    }

    this.emit('queue:retried');
    console.log(`✅ Retried ${pausedFiles.length} failed files`);
  }    /**
   * Pauses queue processing without stopping
   */
  pause(): void {
    if (this.isPaused) return;

    console.log('⏸️  Pausing queue processor...');
    this.isPaused = true;

    // Mark all currently processing files as paused
    this.database.getFilesByStatus('processing').then(processingFiles => {
      return Promise.all(
        processingFiles.map(file => this.transitionState(file.id, 'processing', 'paused'))
      );
    }).then(() => {
      this.emit('queue:paused');
      console.log('✅ Queue processor paused');
    }).catch(err => console.error('Failed to pause:', err));
  }

  /**
   * Gets current processor state
   */
  getState(): { isRunning: boolean; isPaused: boolean; activeProcesses: number } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      activeProcesses: this.activeProcesses.size
    };
  }

  /**
   * Processes next batch of pending files
   */
  private async processNextBatch(): Promise<void> {
    // Check if we have capacity
    const availableSlots = this.config.concurrency - this.activeProcesses.size;
    if (availableSlots <= 0) {
      return;
    }

    // Get pending files
    const allPending = await this.database.getFilesByStatus('pending');
    const pendingFiles = allPending.slice(0, Math.min(availableSlots, this.config.batchSize));

    if (pendingFiles.length === 0) {
      this.emit('queue:empty');
      return;
    }

    console.log(`[UnifiedQueueProcessor] 📦 Processing batch of ${pendingFiles.length} files`);

    // Process files in parallel
    const promises = pendingFiles.map((file: FileMetadata) => this.processFile(file));
    await Promise.allSettled(promises);
  }

  /**
   * Processes a single file through the state machine
   */
  private async processFile(metadata: FileMetadata): Promise<void> {
    const fileId = metadata.id;
    
    // Mark as active
    this.activeProcesses.add(fileId);
    this.emit('file:start', metadata);

    try {
      // Transition: pending -> processing
      this.transitionState(fileId, 'pending', 'processing');

      // State 1: Extract entities
      await this.executeState(fileId, 'extracting_entities', async (meta) => {
        const progressCallback: ProgressCallback = (step, progress) => {
          this.database.updateFile(meta.id, {
            currentStep: step,
            progress: Math.min(progress, 40)
          });
        };
        await this.worker.processFile(
          meta.filePath,
          progressCallback,
          meta.fileContent // base64 if uploaded
        );
      });

      // State 2: Create relationships
      await this.executeState(fileId, 'creating_relationships', async (meta) => {
        const progressCallback: ProgressCallback = (step, progress) => {
          this.database.updateFile(meta.id, {
            currentStep: step,
            progress: 40 + Math.min(progress * 0.3, 30)
          });
        };
        await this.worker.processFile(
          meta.filePath,
          progressCallback,
          meta.fileContent
        );
      });

      // State 3: Entity discovery (if needed)
      const shouldRunDiscovery = this.shouldRunEntityDiscovery(metadata);
      if (shouldRunDiscovery) {
        await this.executeState(fileId, 'entity_discovery', async (meta) => {
          const progressCallback: ProgressCallback = (step, progress) => {
            this.database.updateFile(meta.id, {
              currentStep: step,
              progress: 70 + Math.min(progress * 0.25, 25)
            });
          };
          await this.worker.processFile(
            meta.filePath,
            progressCallback,
            meta.fileContent
          );
        });
      }

      // Transition: -> processed
      this.transitionState(fileId, metadata.status, 'processed');
      
      const finalMetadata = await this.database.getFile(fileId);
      if (finalMetadata) {
        this.emit('file:complete', finalMetadata);
      }

    } catch (error) {
      this.handleError(fileId, error);
    } finally {
      this.activeProcesses.delete(fileId);
    }
  }

  /**
   * Executes a processing state
   */
  private async executeState(
    fileId: string,
    state: FileProcessingStatus,
    action: (metadata: FileMetadata) => Promise<void>
  ): Promise<void> {
    const metadata = await this.database.getFile(fileId);
    if (!metadata) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Transition to state
    const currentState = metadata.status;
    this.transitionState(fileId, currentState, state);

    // Execute action
    await action(metadata);

    // Update progress
    const progress = this.calculateProgress(state);
    await this.database.updateFile(fileId, { progress });
    
    const updatedMetadata = await this.database.getFile(fileId);
    if (updatedMetadata) {
      this.emit('file:progress', updatedMetadata);
    }
  }

  /**
   * Transitions file state (without waiting for result)
   */
  private transitionState(
    fileId: string,
    fromState: FileProcessingStatus,
    toState: FileProcessingStatus
  ): void {
    const updates: Partial<FileMetadata> = {
      status: toState,
      updatedAt: new Date().toISOString()
    };

    // Add state-specific updates
    if (toState === 'processing') {
      updates.processingStartedAt = new Date().toISOString();
      updates.currentStep = 'Starting processing';
      updates.progress = 0;
    } else if (toState === 'extracting_entities') {
      updates.currentStep = 'Extracting entities from file';
      updates.progress = 25;
    } else if (toState === 'creating_relationships') {
      updates.currentStep = 'Creating relationships in graph';
      updates.progress = 50;
    } else if (toState === 'entity_discovery') {
      updates.currentStep = 'Running LLM entity discovery';
      updates.progress = 75;
    } else if (toState === 'processed') {
      updates.processingCompletedAt = new Date().toISOString();
      updates.currentStep = 'Processing completed';
      updates.progress = 100;
    } else if (toState === 'error') {
      updates.processingCompletedAt = new Date().toISOString();
      updates.currentStep = 'Processing failed';
    }

    // Fire and forget - don't wait
    this.database.updateFile(fileId, updates).then(() => {
      return this.database.getFile(fileId);
    }).then((metadata) => {
      if (metadata) {
        this.emit('file:state-change', metadata, fromState, toState);
      }
    }).catch(err => console.error('Failed to transition state:', err));
  }

  /**
   * Handles processing errors
   */
  private async handleError(fileId: string, error: unknown): Promise<void> {
    const metadata = await this.database.getFile(fileId);
    if (!metadata) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const retryCount = metadata.retryCount + 1;

    console.error(`❌ Error processing ${metadata.fileName}:`, errorMessage);

    if (retryCount < this.config.maxRetries) {
      // Schedule retry
      console.log(`🔄 Scheduling retry ${retryCount}/${this.config.maxRetries} for ${metadata.fileName}`);
      
      setTimeout(() => {
        this.database.updateFile(fileId, {
          status: 'pending',
          retryCount,
          errorMessage,
          currentStep: `Retry ${retryCount}/${this.config.maxRetries}`,
          updatedAt: new Date().toISOString()
        });
      }, this.config.retryDelay);
    } else {
      // Mark as error
      await this.database.updateFile(fileId, {
        status: 'error',
        retryCount,
        errorMessage,
        processingCompletedAt: new Date().toISOString(),
        currentStep: 'Processing failed',
        updatedAt: new Date().toISOString()
      });

      const errorMetadata = await this.database.getFile(fileId);
      if (errorMetadata) {
        this.emit('file:error', errorMetadata, error as Error);
      }
    }
  }

  /**
   * Determines if entity discovery should run for this file
   */
  private shouldRunEntityDiscovery(metadata: FileMetadata): boolean {
    // Run discovery for code files (not docs)
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.go', '.rs', '.php'];
    const ext = metadata.fileName.toLowerCase().substring(metadata.fileName.lastIndexOf('.'));
    return codeExtensions.includes(ext);
  }

  /**
   * Calculates progress percentage based on state
   */
  private calculateProgress(state: FileProcessingStatus): number {
    switch (state) {
      case 'pending': return 0;
      case 'processing': return 10;
      case 'extracting_entities': return 35;
      case 'creating_relationships': return 65;
      case 'entity_discovery': return 85;
      case 'processed': return 100;
      default: return 0;
    }
  }
}
