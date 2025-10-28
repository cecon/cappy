/**
 * @fileoverview Port for parsing file content
 * @module domains/file-processing/ports
 */

import type { DocumentChunk } from '../../../shared/types/chunk';

/**
 * Port for parsing files into chunks
 */
export interface FileParserPort {
  /**
   * Parses file content into document chunks
   * @param filePath File path (absolute)
   * @param content File content
   * @returns Array of document chunks
   */
  parseFile(filePath: string, content: string): Promise<DocumentChunk[]>;
  
  /**
   * Creates fallback chunk when parsing produces no results
   * @param filePath File path
   * @param content File content
   * @returns Fallback document chunk
   */
  createFallbackChunk(filePath: string, content: string): DocumentChunk;
}
