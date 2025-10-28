/**
 * @fileoverview Port for loading file content
 * @module domains/file-processing/ports
 */

import type { FileContent } from '../entities/FileContent';

/**
 * Port for loading file content from different sources
 */
export interface FileLoaderPort {
  /**
   * Loads file content from filesystem or embedded source
   * @param filePath Relative or absolute file path
   * @param base64Content Optional embedded base64 content
   * @returns File content with metadata
   */
  loadFile(filePath: string, base64Content?: string): Promise<FileContent>;
}
