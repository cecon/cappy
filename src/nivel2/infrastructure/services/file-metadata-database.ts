/**
 * @fileoverview Backwards compatibility wrapper for file-metadata-database
 * @deprecated Import from './file-metadata' instead
 * 
 * This file provides backwards compatibility for code that still imports
 * from the old './file-metadata-database' path. New code should import
 * from './file-metadata' directly.
 */

import { SQLiteFileMetadataRepository } from './file-metadata/adapters/SQLiteFileMetadataRepository';
import type { FileMetadata, FileProcessingStatus, DatabaseStats } from './file-metadata/domain/FileMetadata';

/**
 * Backwards compatibility wrapper that maintains the old API
 */
export class FileMetadataDatabase {
  private repository: SQLiteFileMetadataRepository;

  constructor(dbPath: string) {
    this.repository = new SQLiteFileMetadataRepository(dbPath);
  }

  async initialize(): Promise<void> {
    return this.repository.initialize();
  }

  close(): void {
    this.repository.close();
  }

  // Old API method names mapped to new interface
  getAllFileMetadata(): FileMetadata[] {
    // Note: The new API is async, but the old one was sync
    // This is a limitation of the backwards compatibility layer
    throw new Error('getAllFileMetadata() is deprecated. Use the async version or migrate to new API.');
  }

  async getAllFiles(): Promise<FileMetadata[]> {
    return this.repository.getAllFiles();
  }

  async getFilesPaginated(options: {
    page: number;
    limit: number;
    status?: FileProcessingStatus;
    sortBy?: 'id' | 'created_at' | 'updated_at';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    files: FileMetadata[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.repository.getFilesPaginated(options);
  }

  async getFile(fileId: string): Promise<FileMetadata | null> {
    return this.repository.getFile(fileId);
  }

  async insertFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>): Promise<void> {
    return this.repository.insertFile(metadata);
  }

  async updateFile(fileId: string, updates: Partial<FileMetadata>): Promise<void> {
    return this.repository.updateFile(fileId, updates);
  }

  async deleteFile(fileId: string): Promise<void> {
    return this.repository.deleteFile(fileId);
  }

  async getFileByPath(filePath: string): Promise<FileMetadata | null> {
    return this.repository.getFileByPath(filePath);
  }

  async getFilesByStatus(status: FileProcessingStatus): Promise<FileMetadata[]> {
    return this.repository.getFilesByStatus(status);
  }

  async getStats(): Promise<DatabaseStats> {
    return this.repository.getStats();
  }
}

// Re-export types
export type { FileMetadata, FileProcessingStatus, DatabaseStats } from './file-metadata/domain/FileMetadata';
export type { IFileMetadataRepository } from './file-metadata/ports/IFileMetadataRepository';
