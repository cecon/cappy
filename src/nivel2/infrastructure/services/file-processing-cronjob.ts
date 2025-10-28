/**
 * @fileoverview Cronjob for automated file processing from queue
 * @module services/file-processing-cronjob
 * @author Cappy Team
 * @since 3.0.6
 */

import { FileMetadataDatabase } from './file-metadata-database';
import type { FileProcessingWorker } from './file-processing-worker';

/**
 * Cronjob configuration
 */
export interface CronJobConfig {
  intervalMs: number;        // Processing interval (default: 10000ms)
  autoStart: boolean;        // Auto start on creation (default: true)
  workspaceRoot: string;     // Workspace root path
}

/**
 * Cronjob for processing files from the queue
 * Implements semaphore to prevent concurrent processing
 * Uses FileProcessingWorker to do the actual processing
 */
export class FileProcessingCronJob {
  private readonly database: FileMetadataDatabase;
  private readonly worker: FileProcessingWorker;
  private readonly config: CronJobConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false; // Semaphore

  constructor(
    database: FileMetadataDatabase,
    worker: FileProcessingWorker,
    config: Partial<CronJobConfig> = {}
  ) {
    this.database = database;
    this.worker = worker;
    
    this.config = {
      intervalMs: config.intervalMs || 10000, // 10 seconds
      autoStart: config.autoStart ?? true,
      workspaceRoot: config.workspaceRoot || process.cwd()
    };

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Starts the cronjob
   */
  start(): void {
    if (this.intervalId) {
      console.log('⚠️ [CronJob] Already running');
      return;
    }

    console.log(`🔄 [CronJob] Started (interval: ${this.config.intervalMs}ms)`);
    
    // Process immediately on start
    this.processNextFile().catch(err => {
      console.error('❌ [CronJob] Initial processing error:', err);
    });

    // Then schedule regular intervals
    this.intervalId = setInterval(() => {
      this.processNextFile().catch(err => {
        console.error('❌ [CronJob] Processing error:', err);
      });
    }, this.config.intervalMs);
  }

  /**
   * Stops the cronjob
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ [CronJob] Stopped');
    }
  }

  /**
   * Checks if cronjob is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Processes the next pending file in the queue
   */
  private async processNextFile(): Promise<void> {
    // Semaphore: prevent concurrent processing
    if (this.isProcessing) {
      console.log('⏳ [CronJob] Already processing a file, skipping...');
      return;
    }

    try {
      this.isProcessing = true;

      // Get next pending file
      const pendingFiles = await this.database.getFilesByStatus('pending');
      
      if (pendingFiles.length === 0) {
        // No pending files
        return;
      }

      const file = pendingFiles[0];
      console.log(`\n📄 [CronJob] Processing file: ${file.filePath}`);

      // Update status to processing
      await this.database.updateFile(file.id, {
        status: 'processing',
        processingStartedAt: new Date().toISOString(),
        currentStep: 'Processing file...',
        progress: 5
      });

      try {
        // Create progress callback to update database
        const onProgress = (step: string, progress: number): void => {
          // Update database without awaiting to avoid blocking
          this.database.updateFile(file.id, {
            currentStep: step,
            progress
          }).catch(err => console.error('Failed to update progress:', err));
        };

        // Use FileProcessingWorker to process the file
        const result = await this.worker.processFile(
          file.filePath,
          onProgress,
          file.fileContent // Pass base64 content if file is uploaded
        );

        // Mark as completed
        await this.database.updateFile(file.id, {
          status: 'processed',
          processingCompletedAt: new Date().toISOString(),
          currentStep: 'Completed',
          progress: 100,
          errorMessage: undefined,
          chunksCount: result.chunksCount,
          nodesCount: result.nodesCount,
          relationshipsCount: result.relationshipsCount
        });

        console.log(`✅ [CronJob] Successfully processed: ${file.filePath}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Chunks: ${result.chunksCount}`);
        console.log(`   Nodes: ${result.nodesCount}`);
        console.log(`   Relationships: ${result.relationshipsCount}`);

      } catch (error) {
        // Mark as error
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ [CronJob] Error processing ${file.filePath}:`, errorMessage);

        await this.database.updateFile(file.id, {
          status: 'error',
          errorMessage,
          processingCompletedAt: new Date().toISOString(),
          retryCount: file.retryCount + 1
        });
      }

    } finally {
      // Release semaphore
      this.isProcessing = false;
    }
  }
}
