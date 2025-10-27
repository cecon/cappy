/**
 * @fileoverview File processing module for workspace scanner
 * @module workspace-scanner/processing
 */

import * as path from 'path';
import { FileHashService } from '../../file-hash-service';
import { FileMetadataExtractor } from '../../file-metadata-extractor';
import { ASTEntityExtractor } from '../../entity-extraction/core/ASTEntityExtractor';
import { ASTEntityAdapter } from '../../entity-conversion/ASTEntityAdapter';
import type { FileIndexEntry } from '../../../../../shared/types/chunk';
import type { WorkspaceScannerConfig } from '../types';

/**
 * File processor configuration
 */
export interface FileProcessorConfig {
  workspaceRoot: string;
  repoId: string;
  config: WorkspaceScannerConfig;
}

/**
 * Handles file processing and metadata extraction
 */
export class FileProcessor {
  private readonly workspaceRoot: string;
  private readonly config: WorkspaceScannerConfig;
  private readonly hashService: FileHashService;
  private readonly metadataExtractor: FileMetadataExtractor;
  private readonly entityExtractor: ASTEntityExtractor;

  constructor(config: FileProcessorConfig) {
    this.workspaceRoot = config.workspaceRoot;
    this.config = config.config;
    this.hashService = new FileHashService();
    this.metadataExtractor = new FileMetadataExtractor();
    this.entityExtractor = new ASTEntityExtractor(config.workspaceRoot);
  }

  /**
   * Gets list of pending files from file index
   */
  getPendingFiles(fileIndex: Map<string, FileIndexEntry>): FileIndexEntry[] {
    const pending: FileIndexEntry[] = [];
    
    for (const file of fileIndex.values()) {
      if (file.pendingGraph) {
        pending.push(file);
      }
    }
    
    console.log(`📋 Found ${pending.length} pending files for processing`);
    return pending;
  }

  /**
   * Processes pending files in batches
   */
  async processPendingFiles(
    fileIndex: Map<string, FileIndexEntry>,
    limit: number = 10,
    concurrency: number = 3
  ): Promise<{ processed: number; errors: number }> {
    console.log(`🤖 [CRONJOB] Starting to process pending files (limit: ${limit}, concurrency: ${concurrency})`);
    
    const pending = this.getPendingFiles(fileIndex);
    const toProcess = pending.slice(0, limit);
    
    if (toProcess.length === 0) {
      console.log('✅ No pending files to process');
      return { processed: 0, errors: 0 };
    }

    let processed = 0;
    let errors = 0;

    // Process files in batches with concurrency control
    for (let i = 0; i < toProcess.length; i += concurrency) {
      const batch = toProcess.slice(i, i + concurrency);
      
      const promises = batch.map(async (file) => {
        try {
          console.log(`   🔄 Processing: ${file.relPath}`);
          await this.processFile(file, fileIndex);
          processed++;
          console.log(`   ✅ Processed: ${file.relPath}`);
        } catch (error) {
          errors++;
          console.error(`   ❌ Error processing ${file.relPath}:`, error);
        }
      });

      await Promise.all(promises);
    }

    console.log(`✅ [CRONJOB] Batch complete: ${processed} processed, ${errors} errors`);
    return { processed, errors };
  }

  /**
   * Saves file metadata to database (marks file as pending for processing)
   */
  async saveFileMetadata(file: FileIndexEntry, fileIndex: Map<string, FileIndexEntry>): Promise<void> {
    console.log(`💾 Saving metadata: ${file.relPath}`);

    // 1. Save to SQLite metadata database (if available)
    if (this.config.metadataDatabase) {
      const fileId = `file:${this.hashService.hashStringSync(file.relPath)}`;
      
      // Check if file already exists in database
      const existing = this.config.metadataDatabase.getFile(fileId);
      
      if (existing) {
        // Update existing record
        this.config.metadataDatabase.updateFile(fileId, {
          status: 'pending',
          progress: 0,
          currentStep: 'Queued for processing',
          fileHash: file.contentHash,
          fileSize: file.sizeBytes,
          errorMessage: undefined,
          processingStartedAt: undefined,
          processingCompletedAt: undefined
        });
        console.log(`   ✅ Updated metadata in database: ${file.relPath}`);
      } else {
        // Insert new record
        this.config.metadataDatabase.insertFile({
          id: fileId,
          filePath: file.relPath,
          fileName: path.basename(file.relPath),
          fileSize: file.sizeBytes,
          fileHash: file.contentHash,
          status: 'pending',
          progress: 0,
          currentStep: 'Queued for processing',
          retryCount: 0,
          maxRetries: 3,
          chunksCount: undefined,
          nodesCount: undefined,
          relationshipsCount: undefined,
          processingStartedAt: undefined,
          processingCompletedAt: undefined
        });
        console.log(`   ✅ Inserted metadata into database: ${file.relPath}`);
      }
    } else {
      console.warn(`⚠️ No metadata database configured; metadata-only scan will not persist ${file.relPath}.`);
    }

    // 2. Update file index in memory
    file.pendingGraph = true;
    file.lastIndexedAtEpochMs = Date.now();
    fileIndex.set(file.relPath, file);

    console.log(`   ✅ Metadata saved for ${file.relPath} (pending=true)`);
  }

  /**
   * Processes a single file
   */
  async processFile(file: FileIndexEntry, fileIndex: Map<string, FileIndexEntry>): Promise<void> {
    console.log(`📄 Processing: ${file.relPath}`);

    const fullPath = path.join(this.workspaceRoot, file.relPath);
    const language = file.language || 'unknown';

    // 1. Extract metadata
    const metadata = await this.metadataExtractor.extract(fullPath, language);

    // 2. Update file node in graph
    await this.config.graphStore.createFileNode(
      file.relPath,
      language,
      metadata.linesOfCode
    );

    // 3. Parse file and extract chunks (if supported)
    if (this.config.parserService.isSupported(fullPath)) {
      const chunks = await this.config.parserService.parseFile(fullPath);
      
      console.log(`   📦 Extracted ${chunks.length} chunks from ${file.relPath}`);
      
      if (chunks.length > 0) {
        // 4. Index with embeddings
        await this.config.indexingService.indexFile(file.relPath, language, chunks);
        
        // 5. Extract AST entities and relationships
        console.log(`   🕸️ Extracting AST entities for ${file.relPath}...`);
        const astEntities = await this.entityExtractor.extractFromFile(fullPath);
        const rawEntities = ASTEntityAdapter.toRawEntities(astEntities);
        console.log(`   📊 Extracted ${rawEntities.length} entities`);
      }
    } else if (this.isConfigFile(file.relPath)) {
      // Index config files differently (no chunking, just metadata)
      await this.indexConfigFile(file);
    }

    // 7. Update file index (mark as processed)
    file.pendingGraph = false;
    file.lastIndexedAtEpochMs = Date.now();
    fileIndex.set(file.relPath, file);
  }

  /**
   * Indexes a configuration file
   */
  private async indexConfigFile(file: FileIndexEntry): Promise<void> {
    console.log(`⚙️  Indexing config file: ${file.relPath}`);
    
    // Just create the file node - no chunks
    await this.config.graphStore.createFileNode(
      file.relPath,
      'config',
      0
    );
  }

  /**
   * Checks if file is a configuration file
   */
  private isConfigFile(relPath: string): boolean {
    const configPatterns = [
      /package\.json$/,
      /tsconfig.*\.json$/,
      /\.eslintrc/,
      /\.prettierrc/,
      /vite\.config\./,
      /webpack\.config\./,
      /rollup\.config\./,
      /\.env/,
      /\.gitignore$/,
      /\.cappyignore$/
    ];

    return configPatterns.some(pattern => pattern.test(relPath));
  }

  /**
   * Cleans up deleted files from database
   */
  async cleanupDeletedFiles(
    currentFiles: FileIndexEntry[],
    fileIndex: Map<string, FileIndexEntry>
  ): Promise<void> {
    const currentPaths = new Set(currentFiles.map(f => f.relPath));
    const deletedFiles: string[] = [];

    // Find files in index that no longer exist
    for (const [relPath] of fileIndex) {
      if (!currentPaths.has(relPath)) {
        deletedFiles.push(relPath);
      }
    }

    if (deletedFiles.length === 0) {
      return;
    }

    console.log(`🗑️  Cleaning up ${deletedFiles.length} deleted files...`);

    for (const relPath of deletedFiles) {
      try {
        await this.deleteFileFromDatabase(relPath);
        fileIndex.delete(relPath);
      } catch (error) {
        console.error(`❌ Error deleting ${relPath}:`, error);
      }
    }
  }

  /**
   * Deletes a file and its data from the database
   */
  private async deleteFileFromDatabase(relPath: string): Promise<void> {
    console.log(`🗑️  Deleting: ${relPath}`);
    
    try {
      // Delete from graph store (removes File node and all related Chunks)
      await this.config.graphStore.deleteFile(relPath);
      console.log(`✅ Deleted ${relPath} from graph store`);
    } catch (error) {
      console.error(`⚠️ Error deleting ${relPath} from stores:`, error);
      throw error;
    }
  }
}
