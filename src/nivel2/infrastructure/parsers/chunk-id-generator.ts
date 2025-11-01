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
  // Create a simple hash from the full path to avoid collisions
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    hash = ((hash << 5) - hash) + filePath.codePointAt(i)!;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const pathHash = Math.abs(hash).toString(36).slice(0, 6);
  const fileName = filePath.split('/').pop() || filePath;
  
  if (chunkNumber !== undefined) {
    return `chunk:${fileName}:${pathHash}:${chunkNumber}:${lineStart}-${lineEnd}`;
  }
  
  return `chunk:${fileName}:${pathHash}:${lineStart}-${lineEnd}`;
}
