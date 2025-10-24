/**
 * @fileoverview File metadata extraction service
 * @module services/file-metadata-extractor
 * @author Cappy Team
 * @since 3.0.0
 */

import * as fs from 'fs';

/**
 * File metadata
 */
export interface FileMetadata {
  linesOfCode: number;
  sizeBytes: number;
  encoding: string;
  hasShebang: boolean;
  shebang?: string;
}

/**
 * Service for extracting file metadata
 */
export class FileMetadataExtractor {
  /**
   * Extracts metadata from a file
   */
  async extract(filePath: string, language: string): Promise<FileMetadata> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check for shebang
    let hasShebang = false;
    let shebang: string | undefined;
    if (lines.length > 0 && lines[0].startsWith('#!')) {
      hasShebang = true;
      shebang = lines[0];
    }

    // Count lines of code (excluding empty lines and comments for code files)
    const linesOfCode = this.countLinesOfCode(lines, language);

    return {
      linesOfCode,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
      encoding: 'utf-8',
      hasShebang,
      shebang
    };
  }

  /**
   * Counts lines of code (excluding empty lines and comments)
   */
  private countLinesOfCode(lines: string[], language: string): number {
    let count = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed.length === 0) {
        continue;
      }

      // Handle block comments for code files
      if (language === 'typescript' || language === 'javascript') {
        if (trimmed.startsWith('/*')) {
          inBlockComment = true;
        }
        if (inBlockComment) {
          if (trimmed.endsWith('*/')) {
            inBlockComment = false;
          }
          continue;
        }
        // Skip single-line comments
        if (trimmed.startsWith('//')) {
          continue;
        }
      }

      count++;
    }

    return count;
  }
}
