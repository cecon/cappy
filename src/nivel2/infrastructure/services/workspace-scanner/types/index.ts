/**
 * @fileoverview Types and interfaces for workspace scanner
 * @module workspace-scanner/types
 */

import type { ParserService } from '../../parser-service';
import type { IndexingService } from '../../indexing-service';
import type { GraphStorePort } from '../../../../../domains/graph/ports/indexing-port';
import type { FileMetadataDatabase } from '../../file-metadata-database';
import type { FileIndexEntry } from '../../../../../shared/types/chunk';

/**
 * Workspace scanner configuration
 */
export interface WorkspaceScannerConfig {
  workspaceRoot: string;
  repoId: string;
  parserService: ParserService;
  indexingService: IndexingService;
  graphStore: GraphStorePort;
  metadataDatabase?: FileMetadataDatabase;
  batchSize?: number;
  concurrency?: number;
}

/**
 * Scan progress information
 */
export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  status: 'scanning' | 'processing' | 'completed' | 'error';
  errors: Array<{ file: string; error: string }>;
}

/**
 * Cross-file relationship
 */
export interface CrossFileRelationship {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, string | number | boolean | string[] | null>;
}

/**
 * File sorting result
 */
export interface SortedFiles {
  sourceFiles: FileIndexEntry[];
  docFiles: FileIndexEntry[];
}

/**
 * Progress callback function
 */
export type ProgressCallback = (progress: ScanProgress) => void;
