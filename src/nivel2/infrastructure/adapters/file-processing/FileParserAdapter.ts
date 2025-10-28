/**
 * @fileoverview Parser adapter for file parsing
 * @module nivel2/infrastructure/adapters/file-processing
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FileParserPort } from '../../../../domains/file-processing/ports/FileParserPort';
import type { DocumentChunk } from '../../../../shared/types/chunk';
import { ParserService } from '../../services/parser-service';

/**
 * Adapter for parsing files using ParserService
 */
export class FileParserAdapter implements FileParserPort {
  private readonly parserService: ParserService;

  constructor() {
    this.parserService = new ParserService();
  }

  async parseFile(filePath: string, content: string): Promise<DocumentChunk[]> {
    let tempFilePath: string | null = null;
    
    try {
      // Create temporary file for parser (some parsers need file path)
      const os = await import('os');
      const tempDir = os.tmpdir();
      const fileName = path.basename(filePath);
      tempFilePath = path.join(tempDir, `cappy-parse-${Date.now()}-${fileName}`);
      
      fs.writeFileSync(tempFilePath, content);
      
      const chunks = await this.parserService.parseFile(tempFilePath, false);
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
      
      return chunks;
      
    } catch (error) {
      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createFallbackChunk(filePath: string, content: string): DocumentChunk {
    const lineCount = Math.max(1, content.split('\n').length);
    const fileName = path.basename(filePath);
    const chunkId = `chunk:${fileName}:1-${lineCount}`;

    return {
      id: chunkId,
      content,
      metadata: {
        filePath,
        lineStart: 1,
        lineEnd: lineCount,
        chunkType: 'code',
        symbolName: fileName.replace(/\.[^.]+$/, ''),
        symbolKind: 'variable'
      }
    };
  }
}
