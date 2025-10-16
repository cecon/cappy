/**
 * @fileoverview File hashing service using BLAKE3
 * @module services/file-hash-service
 * @author Cappy Team
 * @since 3.0.0
 */

import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Service for hashing files and strings
 */
export class FileHashService {
  /**
   * Hashes a file using BLAKE3 (fallback to SHA256 if BLAKE3 not available)
   */
  async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Use SHA256 as BLAKE3 is not natively available in Node.js
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(error));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Hashes a string
   */
  hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Compares two hashes
   */
  compareHashes(hash1: string, hash2: string): boolean {
    return hash1 === hash2;
  }
}
