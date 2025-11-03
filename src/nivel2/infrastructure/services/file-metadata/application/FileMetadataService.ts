/**
 * @fileoverview Application: File Metadata Service (Use Case Layer)
 * @module file-metadata/application
 */

import type { IFileMetadataRepository } from '../ports/IFileMetadataRepository';
import type { FileMetadata, FileProcessingStatus, DatabaseStats } from '../domain/FileMetadata';

/**
 * File metadata service - orchestrates file metadata operations
 */
export class FileMetadataService {
  private readonly repository: IFileMetadataRepository;

  constructor(repository: IFileMetadataRepository) {
    this.repository = repository;
  }

  async initialize(): Promise<void> {
    await this.repository.initialize();
  }

  async addFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.repository.insertFile(metadata);
  }

  async updateFileStatus(
    id: string,
    status: FileProcessingStatus,
    additionalUpdates?: Partial<Omit<FileMetadata, 'id' | 'createdAt' | 'status'>>
  ): Promise<void> {
    const updates: Partial<Omit<FileMetadata, 'id' | 'createdAt'>> = {
      status,
      ...additionalUpdates
    };

    if (status === 'processing' && !additionalUpdates?.processingStartedAt) {
      updates.processingStartedAt = new Date().toISOString();
    }

    // Support both 'completed' and legacy 'processed' status
    if ((status === 'processed' || status === 'completed') && !additionalUpdates?.processingCompletedAt) {
      updates.processingCompletedAt = new Date().toISOString();
      updates.progress = 100;
      // Normalize 'processed' to 'completed' for consistency
      if (status === 'processed') {
        updates.status = 'completed';
      }
    }

    await this.repository.updateFile(id, updates);
  }

  async updateFileProgress(id: string, progress: number, currentStep?: string): Promise<void> {
    await this.repository.updateFile(id, { progress, currentStep });
  }

  async markFileAsError(id: string, errorMessage: string): Promise<void> {
    const file = await this.repository.getFile(id);
    if (!file) {
      throw new Error(`File not found: ${id}`);
    }

    const retryCount = file.retryCount + 1;
    const status: FileProcessingStatus = retryCount >= file.maxRetries ? 'error' : 'pending';

    await this.repository.updateFile(id, {
      status,
      errorMessage,
      retryCount,
      processingCompletedAt: new Date().toISOString()
    });
  }

  async getFile(id: string): Promise<FileMetadata | null> {
    return this.repository.getFile(id);
  }

  async getFileByPath(filePath: string): Promise<FileMetadata | null> {
    return this.repository.getFileByPath(filePath);
  }

  async getAllFiles(): Promise<FileMetadata[]> {
    return this.repository.getAllFiles();
  }

  async getFilesByStatus(status: FileProcessingStatus): Promise<FileMetadata[]> {
    return this.repository.getFilesByStatus(status);
  }

  async getPendingFiles(limit?: number): Promise<FileMetadata[]> {
    return this.repository.getPendingFiles(limit);
  }

  async getProcessingQueue(): Promise<FileMetadata[]> {
    return this.repository.getFilesByStatus('processing');
  }

  async getStats(): Promise<DatabaseStats> {
    return this.repository.getStats();
  }

  async deleteFile(id: string): Promise<void> {
    await this.repository.deleteFile(id);
  }

  async deleteFilesByStatus(status: FileProcessingStatus): Promise<void> {
    await this.repository.deleteFilesByStatus(status);
  }

  async clearAll(): Promise<void> {
    await this.repository.clearAll();
  }

  async retryFailedFiles(): Promise<void> {
    await this.repository.resetFailedFiles();
  }

  async close(): Promise<void> {
    await this.repository.close();
  }
}
