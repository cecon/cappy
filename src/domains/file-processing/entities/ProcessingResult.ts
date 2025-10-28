/**
 * @fileoverview Processing result entity
 * @module domains/file-processing/entities
 */

/**
 * Result of file processing operation
 */
export interface ProcessingResult {
  chunksCount: number;
  nodesCount: number;
  relationshipsCount: number;
  duration: number; // milliseconds
}

/**
 * Progress callback for tracking processing status
 */
export type ProgressCallback = (step: string, progress: number) => void;
