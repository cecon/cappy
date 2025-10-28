/**
 * @fileoverview File content entity
 * @module domains/file-processing/entities
 */

/**
 * Represents file content with metadata
 */
export interface FileContent {
  /** Relative file path */
  filePath: string;
  
  /** Absolute file path */
  absolutePath: string;
  
  /** File content as string */
  content: string;
  
  /** File hash (SHA-256 or BLAKE3) */
  hash: string;
  
  /** File size in bytes */
  size: number;
  
  /** Detected language */
  language: string;
  
  /** Whether content is from embedded base64 */
  isEmbedded: boolean;
}
