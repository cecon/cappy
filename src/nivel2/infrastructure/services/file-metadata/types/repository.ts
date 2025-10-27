/**
 * @fileoverview Types for File Metadata Repository
 * @module file-metadata/types
 */

import type { FileMetadata, FileProcessingStatus } from '../domain/FileMetadata';

/**
 * Pagination options for querying files
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  status?: FileProcessingStatus;
  sortBy?: 'id' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result for file queries
 */
export interface PaginatedResult {
  files: FileMetadata[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * SQLite row type for file metadata
 */
export interface SQLiteFileRow {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_hash: string;
  file_content: string | null;
  status: string;
  progress: number;
  current_step: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  chunks_count: number | null;
  nodes_count: number | null;
  relationships_count: number | null;
}

/**
 * SQLite count result
 */
export interface SQLiteCountRow {
  total: number;
}

/**
 * SQLite stats row
 */
export interface SQLiteStatsRow {
  status: string;
  count: number;
}

/**
 * SQLite aggregated stats row
 */
export interface SQLiteAggregatedStatsRow {
  total: number;
  pending: number;
  processing: number;
  extracting_entities: number;
  creating_relationships: number;
  entity_discovery: number;
  processed: number;
  completed: number;
  error: number;
  paused: number;
  cancelled: number;
}
