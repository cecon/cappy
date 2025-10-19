/**
 * @fileoverview Simplified worker for processing files using only SQLite
 * @module services/file-processing-worker
 * @author Cappy Team
 * @since 3.0.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { ParserService } from './parser-service';
import { FileHashService } from './file-hash-service';
import type { DocumentChunk } from '../types/chunk';
import type { IndexingService } from './indexing-service';
import type { GraphStorePort } from '../domains/graph/ports/indexing-port';

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
  private indexingService?: IndexingService;
  private graphStore?: GraphStorePort;
  private workspaceRoot: string;

  constructor(
    parserService: ParserService,
    hashService: FileHashService,
    workspaceRoot: string,
    indexingService?: IndexingService,
    graphStore?: GraphStorePort
  ) {
    this.parserService = parserService;
    this.hashService = hashService;
    this.workspaceRoot = workspaceRoot;
    this.indexingService = indexingService;
    this.graphStore = graphStore;
  }

  /**
   * Processes a file and returns processing metrics
   * Can process from file path or from embedded base64 content
   */
  async processFile(
    filePath: string,
    onProgress?: ProgressCallback,
    base64Content?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      let fileContent: string;
      
      // Step 1: Get file content
      onProgress?.('Loading file...', 5);
      
      if (base64Content) {
        // Uploaded file with embedded content
        console.log(`📄 Processing uploaded file: ${filePath}`);
        fileContent = Buffer.from(base64Content, 'base64').toString('utf-8');
        console.log(`✓ Loaded from database (${fileContent.length} bytes)`);
      } else {
        // Physical file on disk
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          throw new Error(`File is empty: ${filePath}`);
        }

        fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`✓ Loaded from disk (${fileContent.length} bytes)`);
      }

      // Step 2: Calculate file hash
      onProgress?.('Calculating hash...', 10);
      let fileHash: string;
      if (base64Content) {
        const crypto = await import('crypto');
        fileHash = crypto.createHash('sha256').update(Buffer.from(base64Content, 'base64')).digest('hex');
      } else {
        fileHash = await this.hashService.hashFile(filePath);
      }
      console.log(`File hash: ${fileHash}`);

      // Step 3: Parse file and extract chunks
      onProgress?.('Parsing file...', 30);
      // Language detection for future use
      this.detectLanguage(filePath);
      
      let chunks: DocumentChunk[];
      let tempFilePath: string | null = null;
      
      try {
        // If we have embedded content, create a temp file for the parser
        if (base64Content) {
          const os = await import('os');
          const tempDir = os.tmpdir();
          const fileName = path.basename(filePath).replace(/^uploaded:/, '');
          tempFilePath = path.join(tempDir, `cappy-upload-${Date.now()}-${fileName}`);
          
          console.log(`📝 Creating temporary file for parsing: ${tempFilePath}`);
          fs.writeFileSync(tempFilePath, fileContent);
          
          chunks = await this.parserService.parseFile(tempFilePath, false);
          
          // Clean up temp file immediately after parsing
          fs.unlinkSync(tempFilePath);
          console.log(`🗑️  Temporary file cleaned up`);
          tempFilePath = null;
        } else {
          chunks = await this.parserService.parseFile(filePath, false);
        }
      } catch (parseError) {
        // Clean up temp file if it exists
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw new Error(`Failed to parse file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      if (chunks.length === 0) {
        // Fallback: create a single file-level code chunk
        onProgress?.('No JSDoc found, creating fallback chunk...', 40);
        // Use the already-loaded fileContent instead of reading from disk
        const lineCount = Math.max(1, fileContent.split('\n').length);
        const fileName = path.basename(filePath);
        const chunkId = `chunk:${fileName}:1-${lineCount}`;

        const fallbackChunk: DocumentChunk = {
          id: chunkId,
          content: fileContent,
          metadata: {
            filePath,
            lineStart: 1,
            lineEnd: lineCount,
            chunkType: 'code',
            symbolName: fileName.replace(/\.[^.]+$/, ''),
            symbolKind: 'variable'
          }
        };

        chunks = [fallbackChunk];
        console.log(`⚠️ No JSDoc chunks; created 1 fallback code chunk for ${filePath}`);
      }

      onProgress?.('Chunks generated', 50);
      console.log(`✓ Generated ${chunks.length} chunks from ${filePath}`);

      // Step 4: Save to database (if indexing service is available)
      if (this.indexingService) {
        onProgress?.('Saving to database...', 60);
        const language = this.detectLanguage(filePath);
        await this.indexingService.indexFile(filePath, language, chunks);
        console.log(`✓ Saved ${chunks.length} chunks to database`);
      }

      // Step 5: Extract AST relationships (imports, exports, calls, references)
      onProgress?.('Extracting relationships...', 65);
      let astRelationshipsCount = 0;
      
      if (this.graphStore) {
        try {
          // Import ASTRelationshipExtractor dynamically
          const { ASTRelationshipExtractor } = await import('./ast-relationship-extractor.js');
          const extractor = new ASTRelationshipExtractor(this.workspaceRoot);
          
          console.log(`🕸️ Extracting AST relationships for ${filePath}...`);
          
          let extractionPath = filePath;
          let tempExtractPath: string | null = null;
          
          // If we have embedded content, create temp file for AST extraction
          if (base64Content) {
            const os = await import('os');
            const tempDir = os.tmpdir();
            const fileName = path.basename(filePath).replace(/^uploaded:/, '');
            tempExtractPath = path.join(tempDir, `cappy-ast-${Date.now()}-${fileName}`);
            
            fs.writeFileSync(tempExtractPath, fileContent);
            extractionPath = tempExtractPath;
          }
          
          try {
            const relationships = await extractor.extract(extractionPath, chunks);
            console.log(`🔗 Extracted ${relationships.length} relationships`);
            
            if (relationships.length > 0) {
              console.log(`💾 Saving ${relationships.length} relationships to graph...`);
              await this.graphStore.createRelationships(relationships);
              astRelationshipsCount = relationships.length;
            } else {
              console.log(`⚠️ No relationships extracted for ${filePath}`);
            }
          } finally {
            // Clean up temp file
            if (tempExtractPath && fs.existsSync(tempExtractPath)) {
              fs.unlinkSync(tempExtractPath);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to extract AST relationships:`, error);
          // Don't fail the entire processing, just log the error
        }
      }

      // Step 6: Analyze chunk types
      onProgress?.('Analyzing chunks...', 75);
      const chunkTypes = chunks.reduce((acc, chunk) => {
        const type = chunk.metadata.chunkType || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('Chunk types:', chunkTypes);

      // Step 7: Count relationships (JSDoc -> Code)
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
      const totalRelationships = chunks.length + documentsRels.length + astRelationshipsCount; // CONTAINS + DOCUMENTS + AST
      
      const result: ProcessingResult = {
        chunksCount: chunks.length,
        nodesCount: chunks.length + 1, // chunks + file node
        relationshipsCount: totalRelationships,
        duration
      };

      console.log(`✅ File processed in ${duration}ms`);
      console.log(`   - Chunks: ${chunks.length}`);
      console.log(`   - DOCUMENTS relationships: ${documentsRels.length}`);
      console.log(`   - AST relationships: ${astRelationshipsCount}`);
      console.log(`   - Total relationships: ${totalRelationships}`);
      
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
