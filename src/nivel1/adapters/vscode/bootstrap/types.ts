/**
 * Type definitions for FileProcessingSystemBootstrap and related modules
 */

// Import types directly for use in interfaces (without .js extension for types)
import type { ParserService } from '../../../../nivel2/infrastructure/services/parser-service';
import type { FileHashService } from '../../../../nivel2/infrastructure/services/file-hash-service';
import type { EmbeddingService } from '../../../../nivel2/infrastructure/services/embedding-service';
import type { ConfigService } from '../../../../nivel2/infrastructure/services/config-service';
import type { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import type { FileProcessingQueue } from '../../../../nivel2/infrastructure/services/file-processing-queue';
import type { FileProcessingWorker } from '../../../../nivel2/infrastructure/services/file-processing-worker';
import type { FileChangeWatcher } from '../../../../nivel2/infrastructure/services/file-change-watcher';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import type { GraphCleanupService } from '../../../../nivel2/infrastructure/services/graph-cleanup-service';
import type { IndexingService } from '../../../../nivel2/infrastructure/services/indexing-service';
import type { VectorStorePort } from '../../../../domains/dashboard/ports/indexing-port';

// Re-export types with cleaner names
export type { ParserService, FileHashService, EmbeddingService, ConfigService };
export type { FileMetadataDatabase, FileProcessingQueue, FileProcessingWorker };
export type { FileChangeWatcher as FileWatcher };
export type { GraphStorePort as GraphStore };
export type { GraphCleanupService as CleanupService };
export type { IndexingService };
export type { VectorStorePort as VectorStore };

/**
 * Core services used throughout file processing
 */
export interface CoreServices {
  parserService: ParserService;
  hashService: FileHashService;
  embeddingService: EmbeddingService;
  configService: ConfigService;
}

/**
 * Result returned by FileProcessingSystemBootstrap initialization
 */
export interface FileProcessingSystemResult {
  fileDatabase: FileMetadataDatabase;
  queue: FileProcessingQueue;
  worker: FileProcessingWorker;
  watcher: FileChangeWatcher;
  graphStore: GraphStorePort;
  cleanupService: GraphCleanupService;
  vectorStore: VectorStorePort;
  indexingService: IndexingService;
}

/**
 * Options for paginated file retrieval
 */
export interface GetFilesPaginatedOptions {
  page?: number;
  limit?: number;
  status?: FileProcessingStatus;
  sortBy?: 'id' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

// Import FileProcessingStatus
import type { FileProcessingStatus } from '../../../../nivel2/infrastructure/services/file-metadata/domain/FileMetadata';
