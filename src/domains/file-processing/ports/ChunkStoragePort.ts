/**
 * @fileoverview Port for storing document chunks
 * @module domains/file-processing/ports
 */

import type { DocumentChunk } from '../../../shared/types/chunk';

/**
 * Port for storing processed chunks
 */
export interface ChunkStoragePort {
  /**
   * Stores chunks for a file
   * @param filePath File path
   * @param language Detected language
   * @param chunks Document chunks
   */
  storeChunks(filePath: string, language: string, chunks: DocumentChunk[]): Promise<void>;
}
