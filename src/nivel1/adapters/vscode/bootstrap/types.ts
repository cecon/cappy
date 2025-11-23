/**
 * Type definitions for FileProcessingSystemBootstrap and related modules
 */

// Re-export types using export...from syntax
export type { ParserService } from '../../../../nivel2/infrastructure/services/parser-service';
export type { FileHashService } from '../../../../nivel2/infrastructure/services/file-hash-service';
export type { EmbeddingService } from '../../../../nivel2/infrastructure/services/embedding-service';
export type { ConfigService } from '../../../../nivel2/infrastructure/services/config-service';
export type { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
export type { FileProcessingQueue } from '../../../../nivel2/infrastructure/services/file-processing-queue';
export type { FileProcessingWorker } from '../../../../nivel2/infrastructure/services/file-processing-worker';
export type { FileChangeWatcher as FileWatcher } from '../../../../nivel2/infrastructure/services/file-change-watcher';
export type { GraphStorePort as GraphStore, VectorStorePort as VectorStore } from '../../../../domains/dashboard/ports/indexing-port';
export type { GraphCleanupService as CleanupService } from '../../../../nivel2/infrastructure/services/graph-cleanup-service';
export type { IndexingService } from '../../../../nivel2/infrastructure/services/indexing-service';

// Import types that are used in interfaces below
import type { ParserService } from '../../../../nivel2/infrastructure/services/parser-service';
import type { FileHashService } from '../../../../nivel2/infrastructure/services/file-hash-service';
import type { EmbeddingService } from '../../../../nivel2/infrastructure/services/embedding-service';
import type { ConfigService } from '../../../../nivel2/infrastructure/services/config-service';
import type { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import type { FileProcessingQueue } from '../../../../nivel2/infrastructure/services/file-processing-queue';
import type { FileProcessingWorker } from '../../../../nivel2/infrastructure/services/file-processing-worker';
import type { FileChangeWatcher } from '../../../../nivel2/infrastructure/services/file-change-watcher';
import type { GraphStorePort, VectorStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import type { GraphCleanupService } from '../../../../nivel2/infrastructure/services/graph-cleanup-service';
import type { IndexingService } from '../../../../nivel2/infrastructure/services/indexing-service';
import type { HybridRetriever } from '../../../../nivel2/infrastructure/services/hybrid-retriever';

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
  hybridRetriever: HybridRetriever;
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
