/**
 * @fileoverview Port: File Metadata Repository Interface
 * @module file-metadata/ports
 */

import type { FileMetadata, FileProcessingStatus, DatabaseStats } from '../domain/FileMetadata';
import type { PaginationOptions, PaginatedResult } from '../types';

/**
 * Repository port for file metadata operations
 */
export interface IFileMetadataRepository {
  /**
   * Initializes the repository
   */
  initialize(): Promise<void>;

  /**
   * Inserts a new file record
   */
  insertFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>): Promise<void>;

  /**
   * Updates file metadata
   */
  updateFile(id: string, updates: Partial<Omit<FileMetadata, 'id' | 'createdAt'>>): Promise<void>;

  /**
   * Gets file by ID
   */
  getFile(id: string): Promise<FileMetadata | null>;

  /**
   * Gets file by path
   */
  getFileByPath(filePath: string): Promise<FileMetadata | null>;

  /**
   * Gets all file metadata records
   */
  getAllFiles(): Promise<FileMetadata[]>;

  /**
   * Gets files with pagination and filtering
   */
  getFilesPaginated(options: PaginationOptions): Promise<PaginatedResult>;

  /**
   * Gets files by status
   */
  getFilesByStatus(status: FileProcessingStatus): Promise<FileMetadata[]>;

  /**
   * Gets pending files with optional limit
   */
  getPendingFiles(limit?: number): Promise<FileMetadata[]>;

  /**
   * Gets database statistics
   */
  getStats(): Promise<DatabaseStats>;

  /**
   * Deletes a file record
   */
  deleteFile(id: string): Promise<void>;

  /**
   * Deletes files by status
   */
  deleteFilesByStatus(status: FileProcessingStatus): Promise<void>;

  /**
   * Clears all records
   */
  clearAll(): Promise<void>;

  /**
   * Resets failed files for retry
   */
  resetFailedFiles(): Promise<void>;

  /**
   * Closes repository connection
   */
  close(): Promise<void>;
}
