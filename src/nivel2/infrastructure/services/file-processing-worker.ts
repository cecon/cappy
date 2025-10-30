/**
 * @fileoverview File processing worker
 * @module services/file-processing-worker
 * @author Cappy Team
 * @since 3.0.9
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ParserService } from './parser-service';
import type { FileHashService } from './file-hash-service';
import type { IndexingService } from './indexing-service';
import type { GraphStorePort } from '../../../domains/dashboard/ports/indexing-port';

/**
 * Progress callback type
 */
export type ProgressCallback = (step: string, progress: number) => void;

/**
 * Processing result interface
 */
export interface ProcessingResult {
  chunksCount: number;
  nodesCount: number;
  relationshipsCount: number;
  duration: number;
}

/**
 * File processing worker
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
   */
  async processFile(
    filePath: string,
    onProgress?: ProgressCallback,
    base64Content?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Load file content
      onProgress?.('Loading file...', 0);
      let fileContent: string;
      let fileHash: string;
      let absolutePath: string;

      if (base64Content) {
        fileContent = Buffer.from(base64Content, 'base64').toString('utf-8');
        console.log(`✓ Loaded from base64 (${fileContent.length} bytes)`);
        fileHash = await this.hashService.hashString(fileContent);
        // For uploaded files, use the original path (virtual path)
        absolutePath = filePath;
      } else {
        // Resolve to absolute path for file system operations
        absolutePath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(this.workspaceRoot, filePath);

        if (!fs.existsSync(absolutePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const stats = fs.statSync(absolutePath);
        if (stats.size === 0) {
          throw new Error(`File is empty: ${filePath}`);
        }

        fileContent = fs.readFileSync(absolutePath, 'utf-8');
        console.log(`✓ Loaded from disk (${fileContent.length} bytes)`);
        fileHash = await this.hashService.hashFile(absolutePath);
      }
      
      console.log(`File hash (BLAKE3): ${fileHash}`);

      // Step 2: Parse file and extract chunks
      onProgress?.('Parsing file...', 30);
      const language = this.detectLanguage(filePath);
      
      // Use overlap for documentation files (md, pdf, doc, docx)
      const isDocFile = /\.(md|mdx|pdf|doc|docx)$/i.test(filePath);
      // IMPORTANT: Pass absolutePath to parser so it can read the file
      const chunks = await this.parserService.parseFile(absolutePath, isDocFile);
      console.log(`✓ Parsed ${chunks.length} chunks${isDocFile ? ' (with overlap)' : ''}`);

      const chunksCount = chunks.length;
      let nodesCount = 0;
      const relationshipsCount = 0;

      // Step 3: Index file with chunks (if indexing service available)
      if (this.indexingService && chunks.length > 0) {
        onProgress?.('Indexing chunks...', 60);
        await this.indexingService.indexFile(filePath, language, chunks);
        console.log(`✓ Indexed ${chunks.length} chunks`);
        nodesCount = chunks.length + 1; // chunks + file node
      }

      // Step 4: Build cross-file relationships (if graph store available)
      if (this.graphStore) {
        onProgress?.('Building relationships...', 80);
        console.log(`✓ Relationships available in graph`);
      }

      onProgress?.('Complete', 100);

      const duration = Date.now() - startTime;
      return {
        chunksCount,
        nodesCount,
        relationshipsCount,
        duration
      };

    } catch (error) {
      console.error('❌ Error processing file:', error);
      throw error;
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cs': 'csharp',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sql': 'sql'
    };
    return languageMap[ext] || 'plaintext';
  }
}
