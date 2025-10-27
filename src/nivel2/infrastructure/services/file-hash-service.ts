/**
 * @fileoverview File hashing service using BLAKE3
 * @module services/file-hash-service
 * @author Cappy Team
 * @since 3.0.0
 */

import * as fs from 'fs';
import { blake3 } from 'hash-wasm';

/**
 * Service for hashing files and strings
 */
export class FileHashService {
  /**
   * Hashes a file using BLAKE3
   */
  async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data: string | Buffer) => {
          chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        });
        stream.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          const hash = await blake3(buffer);
          resolve(hash);
        });
        stream.on('error', (error) => reject(error instanceof Error ? error : new Error(String(error))));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Hashes a string using BLAKE3
   */
  async hashString(str: string): Promise<string> {
    return blake3(str);
  }

  /**
   * Compares two hashes
   */
  compareHashes(hash1: string, hash2: string): boolean {
    return hash1 === hash2;
  }

  /**
   * Hashes a string synchronously (for compatibility)
   * Note: Returns a temporary hash, prefer async hashString() when possible
   */
  hashStringSync(str: string): string {
    // Fallback to a simple hash for sync operations (used in generateFileId)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.codePointAt(i) ?? 0;
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
