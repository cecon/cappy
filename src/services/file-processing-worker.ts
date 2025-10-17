/**
 * @fileoverview Simplified worker for processing files using only SQLite
 * @module services/file-processing-worker
 * @author Cappy Team
 * @since 3.0.5
 */

import * as fs from 'fs';
import { ParserService } from './parser-service';
import { FileHashService } from './file-hash-service';
import type { DocumentChunk } from '../types/chunk';

/**
 * Progress callback
 */
export type ProgressCallback = (step: string, progress: number) => void;

/**
 * Processing result
 */
export interface ProcessingResult {
  chunksCount: number;
  nodesCount: number;
  relationshipsCount: number;
  duration: number; // milliseconds
}

/**
 * Simplified worker for processing files (SQLite-only version)
 * In the future, this can be extended to support vector and graph stores
 */
export class FileProcessingWorker {
  private parserService: ParserService;
  private hashService: FileHashService;

  constructor(
    parserService: ParserService,
    hashService: FileHashService
  ) {
    this.parserService = parserService;
    this.hashService = hashService;
  }

  /**
   * Processes a file and returns processing metrics
   */
  async processFile(
    filePath: string,
    onProgress?: ProgressCallback
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Step 1: Validate file exists
      onProgress?.('Validating file...', 5);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error(`File is empty: ${filePath}`);
      }

      // Step 2: Calculate file hash
      onProgress?.('Calculating hash...', 10);
      const fileHash = await this.hashService.hashFile(filePath);
      console.log(`File hash: ${fileHash}`);

      // Step 3: Parse file and extract chunks
      onProgress?.('Parsing file...', 30);
      // Language detection for future use
      this.detectLanguage(filePath);
      
      let chunks: DocumentChunk[];
      try {
        chunks = await this.parserService.parseFile(filePath, false);
      } catch (parseError) {
        throw new Error(`Failed to parse file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      if (chunks.length === 0) {
        throw new Error('No chunks generated from file');
      }

      onProgress?.('Chunks generated', 50);
      console.log(`✓ Generated ${chunks.length} chunks from ${filePath}`);

      // Step 4: Analyze chunk types
      onProgress?.('Analyzing chunks...', 70);
      const chunkTypes = chunks.reduce((acc, chunk) => {
        const type = chunk.metadata.chunkType || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('Chunk types:', chunkTypes);

      // Step 5: Count relationships (JSDoc -> Code)
      onProgress?.('Counting relationships...', 85);
      const documentsRels = chunks
        .filter(c => c.metadata.chunkType === 'jsdoc' && c.metadata.symbolName)
        .map(jsdoc => {
          const codeChunk = chunks.find(c => 
            c.metadata.chunkType === 'code' && 
            c.metadata.symbolName === jsdoc.metadata.symbolName
          );
          return codeChunk ? { from: jsdoc.id, to: codeChunk.id, type: 'DOCUMENTS' } : null;
        })
        .filter((rel): rel is NonNullable<typeof rel> => rel !== null);

      console.log(`✓ Found ${documentsRels.length} DOCUMENTS relationships`);

      // Step 6: Complete
      onProgress?.('Completed', 100);

      const duration = Date.now() - startTime;
      const result: ProcessingResult = {
        chunksCount: chunks.length,
        nodesCount: chunks.length + 1, // chunks + file node
        relationshipsCount: chunks.length + documentsRels.length, // CONTAINS + DOCUMENTS
        duration
      };

      console.log(`✅ File processed in ${duration}ms`);
      return result;

    } catch (error) {
      console.error('❌ Error processing file:', error);
      throw error;
    }
  }

  /**
   * Detects language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'cs': 'csharp',
      'md': 'markdown',
      'txt': 'text'
    };

    return languageMap[ext] || 'text';
  }
}
