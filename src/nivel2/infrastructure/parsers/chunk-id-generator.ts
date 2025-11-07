/**
 * @fileoverview Chunk ID generator utility
 * @module parsers/chunk-id-generator
 * @author Cappy Team
 * @since 3.0.9
 */

/**
 * Generates a unique chunk ID with path hash to avoid collisions
 * between files with the same name in different directories
 */
export function generateChunkId(
  filePath: string,
  lineStart: number,
  lineEnd: number,
  chunkNumber?: number
): string {
  // Backward-compatible ID format expected by tests: chunk:<fileName>:<lineStart>-<lineEnd>
  // Optional chunk number for multi-symbol files: chunk:<fileName>:<chunkNumber>:<lineStart>-<lineEnd>
  const fileName = filePath.split('/').pop() || filePath;
  
  if (chunkNumber !== undefined) {
    return `chunk:${fileName}:${chunkNumber}:${lineStart}-${lineEnd}`;
  }
  
  return `chunk:${fileName}:${lineStart}-${lineEnd}`;
}
