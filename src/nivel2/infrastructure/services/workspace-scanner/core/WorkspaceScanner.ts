/**
 * @fileoverview Refactored workspace scanner - orchestrates file indexing modules
 * @module services/workspace-scanner
 * @author Cappy Team
 * @since 3.0.0
 */

import type { FileIndexEntry } from '../../../../../shared/types/chunk';
import type { WorkspaceScannerConfig, ScanProgress, ProgressCallback } from '../types';
import { FileDiscovery } from '../discovery/FileDiscovery';
import { FileProcessor } from '../processing/FileProcessor';
import { CrossFileRelationships } from '../relationships/CrossFileRelationships';
import { FileIndexManager } from '../helpers/FileIndexManager';
import { FileSorter } from '../helpers/FileSorter';

/**
 * Main workspace scanner that orchestrates file indexing
 * 
 * Features:
 * - AST parsing for code relationships
 * - File metadata extraction
 * - Hash-based change detection
 * - Respect .gitignore and .cappyignore
 * - Queue-based processing
 * - Automatic cleanup of deleted files
 */
export class WorkspaceScanner {
  private readonly fileDiscovery: FileDiscovery;
  private readonly fileProcessor: FileProcessor;
  private readonly crossFileRels: CrossFileRelationships;
  private readonly fileIndexManager: FileIndexManager;
  private readonly fileSorter: FileSorter;
  private readonly fileIndex: Map<string, FileIndexEntry> = new Map();
  private progressCallback?: ProgressCallback;
  private stats: ScanProgress = {
    totalFiles: 0,
    processedFiles: 0,
    currentFile: '',
    status: 'scanning',
    errors: []
  };

  constructor(config: WorkspaceScannerConfig) {
    
    // Initialize modules
    this.fileDiscovery = new FileDiscovery({
      workspaceRoot: config.workspaceRoot,
      repoId: config.repoId
    });
    
    this.fileProcessor = new FileProcessor({
      workspaceRoot: config.workspaceRoot,
      repoId: config.repoId,
      config
    });
    
    this.crossFileRels = new CrossFileRelationships({
      workspaceRoot: config.workspaceRoot,
      config
    });
    
    this.fileIndexManager = new FileIndexManager({
      repoId: config.repoId,
      graphStore: config.graphStore
    });
    
    this.fileSorter = new FileSorter();
  }

  /**
   * Sets progress callback
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Gets current scan statistics
   */
  getStats(): ScanProgress {
    return { ...this.stats };
  }

  /**
   * Gets list of pending files (files marked with pendingGraph=true)
   */
  async getPendingFiles(): Promise<FileIndexEntry[]> {
    return this.fileProcessor.getPendingFiles(this.fileIndex);
  }

  /**
   * Processes pending files (called by cronjob)
   */
  async processPendingFiles(
    limit: number = 10,
    concurrency: number = 3
  ): Promise<{ processed: number; errors: number }> {
    return this.fileProcessor.processPendingFiles(this.fileIndex, limit, concurrency);
  }

  /**
   * Initializes the scanner
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing workspace scanner...');
    
    // Load ignore patterns
    await this.fileDiscovery.initialize();
    
    // Load existing file index from graph store
    const loadedIndex = await this.fileIndexManager.loadFileIndex();
    this.fileIndex.clear();
    for (const [key, value] of loadedIndex) {
      this.fileIndex.set(key, value);
    }
    
    console.log('✅ Workspace scanner initialized');
  }

  /**
   * Scans the entire workspace
   */
  async scanWorkspace(): Promise<void> {
    console.log('🚀 [WorkspaceScanner] Starting workspace scan...');
    console.log('🔍 [WorkspaceScanner] FileDiscovery:', !!this.fileDiscovery);
    console.log('🔍 [WorkspaceScanner] FileProcessor:', !!this.fileProcessor);
    console.log('🔍 [WorkspaceScanner] ProgressCallback:', !!this.progressCallback);
    
    const startTime = Date.now();
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      currentFile: '',
      status: 'scanning',
      errors: []
    };
    const progress = this.stats;

    try {
      console.log('🔍 [WorkspaceScanner] Step 1: Calling discoverFiles...');
      // 1. Discover all files
      const files = await this.fileDiscovery.discoverFiles(this.progressCallback);
      console.log(`📁 [WorkspaceScanner] Discovery complete: ${files.length} files found`);
      progress.totalFiles = files.length;
      console.log(`📁 Found ${files.length} files to process`);
      
      this.notifyProgress(progress);

      // 2. Check for deleted files
      await this.fileProcessor.cleanupDeletedFiles(files, this.fileIndex);

      // 3. Filter files that need processing (new or modified)
      const filesToProcess = this.fileDiscovery.filterFilesToProcess(files, this.fileIndex);
      console.log(`📝 ${filesToProcess.length} files need processing`);

      // 4. Sort files: process source code first, then documentation
      const sortedFiles = this.fileSorter.sortFilesByType(filesToProcess);
      console.log(`🔀 Sorted files: ${sortedFiles.sourceFiles.length} source code, ${sortedFiles.docFiles.length} documentation`);

      // 5. Save file metadata to database (mark as pending for processing)
      progress.status = 'processing';
      this.notifyProgress(progress);

      console.log('💾 Saving file metadata to database (marking as pending)...');
      
      // Save source code files metadata
      for (const file of sortedFiles.sourceFiles) {
        try {
          progress.currentFile = file.relPath;
          this.notifyProgress(progress);
          
          await this.fileProcessor.saveFileMetadata(file, this.fileIndex);
          
          progress.processedFiles++;
          this.notifyProgress(progress);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          progress.errors.push({ file: file.relPath, error: errorMsg });
          console.error(`❌ Error saving metadata for ${file.relPath}:`, error);
        }
      }

      // Then save documentation files metadata
      for (const file of sortedFiles.docFiles) {
        try {
          progress.currentFile = file.relPath;
          this.notifyProgress(progress);
          
          await this.fileProcessor.saveFileMetadata(file, this.fileIndex);
          
          progress.processedFiles++;
          this.notifyProgress(progress);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          progress.errors.push({ file: file.relPath, error: errorMsg });
          console.error(`❌ Error saving metadata for ${file.relPath}:`, error);
        }
      }

      console.log('✅ File metadata saved. Files marked as pending for cronjob processing.');

      // 6. Build cross-file relationships (DISABLED by default)
      if (process.env.CAPPY_ENABLE_XFILE_REL === '1') {
        console.log('🔗 Starting cross-file relationship building phase...');
        await this.crossFileRels.buildCrossFileRelationships(this.fileIndex);
        console.log('✅ Cross-file relationship building completed');
      }

      progress.status = 'completed';
      progress.currentFile = '';
      this.notifyProgress(progress);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Workspace scan completed in ${duration}s`);
      console.log(`   Processed: ${progress.processedFiles}/${progress.totalFiles} files`);
      console.log(`   Errors: ${progress.errors.length}`);
      
    } catch (error) {
      progress.status = 'error';
      console.error('❌ Workspace scan failed:', error);
      throw error;
    }
  }

  /**
   * Notifies progress callback
   */
  private notifyProgress(progress: ScanProgress): void {
    if (this.progressCallback) {
      this.progressCallback({ ...progress });
    }
  }
}
