/**
 * @fileoverview File Metadata Module - Hexagonal Architecture
 * @module file-metadata
 */

import { SQLiteFileMetadataRepository } from './adapters/SQLiteFileMetadataRepository';
import { FileMetadataService } from './application/FileMetadataService';

// Domain
export type { FileMetadata, FileProcessingStatus, DatabaseStats } from './domain/FileMetadata';

// Ports
export type { IFileMetadataRepository } from './ports/IFileMetadataRepository';

// Adapters
export { SQLiteFileMetadataRepository } from './adapters/SQLiteFileMetadataRepository';

// Application
export { FileMetadataService } from './application/FileMetadataService';

// Factory
export function createFileMetadataService(dbPath: string): FileMetadataService {
  const repository = new SQLiteFileMetadataRepository(dbPath);
  return new FileMetadataService(repository);
}
