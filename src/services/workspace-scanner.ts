/**
 * @fileoverview Workspace scanner for indexing all project files
 * @module services/workspace-scanner
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceScanQueue } from './workspace-scan-queue';
import { FileHashService } from './file-hash-service';
import { IgnorePatternMatcher } from './ignore-pattern-matcher';
import { FileMetadataExtractor } from './file-metadata-extractor';
import { ASTRelationshipExtractor } from './ast-relationship-extractor';
import { ParserService } from './parser-service';
import { IndexingService } from './indexing-service';
import type { FileIndexEntry } from '../types/chunk';
import type { GraphStorePort } from '../domains/graph/ports/indexing-port';

/**
 * Workspace scanner configuration
 */
export interface WorkspaceScannerConfig {
  workspaceRoot: string;
  repoId: string;
  parserService: ParserService;
  indexingService: IndexingService;
  graphStore: GraphStorePort;
  batchSize?: number;
  concurrency?: number;
}

/**
 * Scan progress information
 */
export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  status: 'scanning' | 'processing' | 'completed' | 'error';
  errors: Array<{ file: string; error: string }>;
}

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
  private readonly config: WorkspaceScannerConfig;
  private readonly queue: WorkspaceScanQueue;
  private readonly hashService: FileHashService;
  private readonly ignorePatterns: IgnorePatternMatcher;
  private readonly metadataExtractor: FileMetadataExtractor;
  private readonly relationshipExtractor: ASTRelationshipExtractor;
  private readonly fileIndex: Map<string, FileIndexEntry> = new Map();
  private progressCallback?: (progress: ScanProgress) => void;

  constructor(config: WorkspaceScannerConfig) {
    this.config = config;
    this.queue = new WorkspaceScanQueue({
      concurrency: config.concurrency || 3,
      batchSize: config.batchSize || 10
    });
    this.hashService = new FileHashService();
    this.ignorePatterns = new IgnorePatternMatcher(config.workspaceRoot);
    this.metadataExtractor = new FileMetadataExtractor();
    this.relationshipExtractor = new ASTRelationshipExtractor(config.workspaceRoot);
  }

  /**
   * Sets progress callback
   */
  onProgress(callback: (progress: ScanProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Initializes the scanner
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing workspace scanner...');
    
    // Load ignore patterns
    await this.ignorePatterns.load();
    
    // Load existing file index from graph store
    await this.loadFileIndex();
    
    console.log('✅ Workspace scanner initialized');
  }

  /**
   * Scans the entire workspace
   */
  async scanWorkspace(): Promise<void> {
    console.log('🚀 Starting workspace scan...');
    
    const startTime = Date.now();
    const progress: ScanProgress = {
      totalFiles: 0,
      processedFiles: 0,
      currentFile: '',
      status: 'scanning',
      errors: []
    };

    try {
      // 1. Discover all files
      const files = await this.discoverFiles();
      progress.totalFiles = files.length;
      console.log(`📁 Found ${files.length} files to process`);
      
      this.notifyProgress(progress);

      // 2. Check for deleted files
      await this.cleanupDeletedFiles(files);

      // 3. Filter files that need processing (new or modified)
      const filesToProcess = await this.filterFilesToProcess(files);
      console.log(`📝 ${filesToProcess.length} files need processing`);

      // 4. Queue all files for processing
      progress.status = 'processing';
      this.notifyProgress(progress);

      for (const file of filesToProcess) {
        this.queue.enqueue(async () => {
          try {
            progress.currentFile = file.relPath;
            this.notifyProgress(progress);
            
            await this.processFile(file);
            
            progress.processedFiles++;
            this.notifyProgress(progress);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            progress.errors.push({ file: file.relPath, error: errorMsg });
            console.error(`❌ Error processing ${file.relPath}:`, error);
          }
        });
      }

      // 5. Wait for queue to complete
      await this.queue.drain();

      // 6. Build cross-file relationships
      await this.buildCrossFileRelationships();

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
   * Discovers all files in workspace
   */
  private async discoverFiles(): Promise<FileIndexEntry[]> {
    const files: FileIndexEntry[] = [];
    // Use VS Code file search
    const uris = await vscode.workspace.findFiles(
      '**/*',
      '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.cappy/**}'
    );

    for (const uri of uris) {
      const relPath = path.relative(this.config.workspaceRoot, uri.fsPath);
      
      // Apply ignore patterns
      if (this.ignorePatterns.shouldIgnore(relPath)) {
        continue;
      }

      try {
        const stat = await vscode.workspace.fs.stat(uri);
        
        // Skip directories
        if (stat.type === vscode.FileType.Directory) {
          continue;
        }

        const fileId = this.generateFileId(relPath);
        const hash = await this.hashService.hashFile(uri.fsPath);

        files.push({
          repoId: this.config.repoId,
          fileId,
          relPath,
          isAvailable: true,
          isDeleted: false,
          sizeBytes: stat.size,
          mtimeEpochMs: stat.mtime,
          hashAlgo: 'blake3',
          contentHash: hash,
          hashStatus: 'OK',
          hashVerifiedAtEpochMs: Date.now(),
          language: this.detectLanguage(relPath),
          lastIndexedAtEpochMs: 0,
          pendingGraph: true
        });
      } catch (error) {
        console.warn(`⚠️ Could not stat file ${relPath}:`, error);
      }
    }

    return files;
  }

  /**
   * Cleans up deleted files from the database
   */
  private async cleanupDeletedFiles(currentFiles: FileIndexEntry[]): Promise<void> {
    const currentPaths = new Set(currentFiles.map(f => f.relPath));
    const deletedFiles: string[] = [];

    // Find files in index that no longer exist
    for (const [relPath] of this.fileIndex) {
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
        this.fileIndex.delete(relPath);
      } catch (error) {
        console.error(`❌ Error deleting ${relPath}:`, error);
      }
    }
  }

  /**
   * Filters files that need processing (new or modified)
   */
  private async filterFilesToProcess(files: FileIndexEntry[]): Promise<FileIndexEntry[]> {
    const filesToProcess: FileIndexEntry[] = [];

    for (const file of files) {
      const existing = this.fileIndex.get(file.relPath);

      // New file
      if (!existing) {
        filesToProcess.push(file);
        continue;
      }

      // Modified file (hash changed)
      if (existing.contentHash !== file.contentHash) {
        console.log(`📝 File modified: ${file.relPath}`);
        filesToProcess.push(file);
        continue;
      }

      // File unchanged - skip
    }

    return filesToProcess;
  }

  /**
   * Processes a single file
   */
  private async processFile(file: FileIndexEntry): Promise<void> {
    console.log(`📄 Processing: ${file.relPath}`);

    const fullPath = path.join(this.config.workspaceRoot, file.relPath);
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
      
      if (chunks.length > 0) {
        // 4. Index with embeddings
        await this.config.indexingService.indexFile(file.relPath, language, chunks);
        
        // 5. Extract AST relationships
        const relationships = await this.relationshipExtractor.extract(fullPath, chunks);
        
        // 6. Create relationships in graph
        if (relationships.length > 0) {
          await this.config.graphStore.createRelationships(relationships);
        }
      }
    } else if (this.isConfigFile(file.relPath)) {
      // Index config files differently (no chunking, just metadata)
      await this.indexConfigFile(file);
    }

    // 7. Update file index
    this.fileIndex.set(file.relPath, file);
  }

  /**
   * Builds cross-file relationships (imports, references, etc.)
   */
  private async buildCrossFileRelationships(): Promise<void> {
    console.log('🔗 Building cross-file relationships...');
    
    // This will be implemented in phase 2
    // Will use AST analysis to detect:
    // - import/require statements
    // - type references
    // - function calls
    // - etc.
  }

  /**
   * Deletes a file and its data from the database
   */
  private async deleteFileFromDatabase(relPath: string): Promise<void> {
    console.log(`🗑️  Deleting: ${relPath}`);
    
      // Delete from graph store (removes File node and all related Chunks)
      await this.config.graphStore.deleteFile(relPath);
    
      // Delete from vector store
      try {
        // IndexingService doesn't expose vectorStore directly, so we log for now
        console.log(`✅ Deleted ${relPath} from graph store`);
      } catch (error) {
        console.error(`⚠️ Error deleting ${relPath} from stores:`, error);
        throw error;
      }
  }

  /**
   * Indexes a configuration file
   */
  private async indexConfigFile(file: FileIndexEntry): Promise<void> {
    // Config files get special treatment - stored as-is without chunking
    console.log(`⚙️  Indexing config file: ${file.relPath}`);
    
    // Just create the file node - no chunks
    await this.config.graphStore.createFileNode(
      file.relPath,
      'config',
      0
    );
  }

  /**
   * Loads file index from graph store
   */
  private async loadFileIndex(): Promise<void> {
      try {
        console.log('📚 Loading file index from graph database...');
      
        const files = await this.config.graphStore.listAllFiles();
      
        this.fileIndex.clear();
      
        for (const file of files) {
          const fileId = this.generateFileId(file.path);
        
          // Create a minimal FileIndexEntry from what we have
          // We don't have hash/mtime yet, will be updated on next scan
          this.fileIndex.set(file.path, {
            repoId: this.config.repoId,
            fileId,
            relPath: file.path,
            isAvailable: true,
            isDeleted: false,
            sizeBytes: 0, // Unknown, will be updated
            mtimeEpochMs: 0, // Unknown, will be updated
            hashAlgo: 'blake3',
            contentHash: '', // Empty means needs recalculation
            hashStatus: 'UNKNOWN',
            language: file.language,
            lastIndexedAtEpochMs: Date.now(),
            pendingGraph: false
          });
        }
      
        console.log(`✅ Loaded ${files.length} files from index`);
      } catch (error) {
        console.error('⚠️ Error loading file index:', error);
        // Continue with empty index
        this.fileIndex.clear();
      }
  }

  /**
   * Generates a unique file ID
   */
  private generateFileId(relPath: string): string {
    return `file:${this.hashService.hashString(relPath)}`;
  }

  /**
   * Detects file language
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby'
    };

    return languageMap[ext] || 'unknown';
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
   * Notifies progress callback
   */
  private notifyProgress(progress: ScanProgress): void {
    if (this.progressCallback) {
      this.progressCallback({ ...progress });
    }
  }
}
