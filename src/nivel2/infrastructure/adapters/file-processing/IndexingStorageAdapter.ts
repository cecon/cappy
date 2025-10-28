/**
 * @fileoverview Indexing adapter for chunk storage
 * @module nivel2/infrastructure/adapters/file-processing
 */

import type { ChunkStoragePort } from '../../../../domains/file-processing/ports/ChunkStoragePort';
import type { DocumentChunk } from '../../../../shared/types/chunk';
import type { IndexingService } from '../../services/indexing-service';

/**
 * Adapter for storing chunks using IndexingService
 */
export class IndexingStorageAdapter implements ChunkStoragePort {
  private readonly indexingService: IndexingService;

  constructor(indexingService: IndexingService) {
    this.indexingService = indexingService;
  }

  async storeChunks(filePath: string, language: string, chunks: DocumentChunk[]): Promise<void> {
    await this.indexingService.indexFile(filePath, language, chunks);
  }
}
