/**
 * @fileoverview Refactored workspace scanner - orchestrates file indexing modules
 * @module services/workspace-scanner
 * @author Cappy Team
 * @since 3.0.0
 */

import type { FileIndexEntry } from "../../../../../shared/types/chunk";
import type {
  WorkspaceScannerConfig,
  ScanProgress,
  ProgressCallback,
} from "../types";
import { FileDiscovery } from "../discovery/FileDiscovery";
import { CrossFileRelationships } from "../relationships/CrossFileRelationships";
import { FileSorter } from "../helpers/FileSorter";
import { FileMetadadoProcessor } from "../processing/FileMetadadoProcessor";

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
  private readonly fileMetadadoProcessor: FileMetadadoProcessor;
  private readonly crossFileRels: CrossFileRelationships;
  private readonly fileSorter: FileSorter;
  private readonly fileIndex: Map<string, FileIndexEntry> = new Map();
  private progressCallback?: ProgressCallback;
  private stats: ScanProgress = {
    totalFiles: 0,
    processedFiles: 0,
    currentFile: "",
    status: "scanning",
    errors: [],
  };

  constructor(config: WorkspaceScannerConfig) {
    // Initialize modules
    this.fileDiscovery = new FileDiscovery({
      workspaceRoot: config.workspaceRoot,
      repoId: config.repoId,
    });

    this.fileMetadadoProcessor = new FileMetadadoProcessor({
      workspaceRoot: config.workspaceRoot,
      repoId: config.repoId,
      config,
    });

    this.crossFileRels = new CrossFileRelationships({
      workspaceRoot: config.workspaceRoot,
      config,
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
    return this.fileMetadadoProcessor.getPendingFiles(this.fileIndex);
  }

  /**
   * Initializes the scanner
   */
  async initialize(): Promise<void> {
    // Load ignore patterns
    await this.fileDiscovery.initialize();
  }

  /**
   * Scans the entire workspace
   */
  async scanWorkspace(): Promise<void> {
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      currentFile: "",
      status: "scanning",
      errors: [],
    };
    const progress = this.stats;

    try {
      // 1. Discover all files
      const files = await this.fileDiscovery.discoverFiles(
        this.progressCallback
      );
      progress.totalFiles = files.length;

      this.notifyProgress(progress);

      // 2. Check for deleted files
      // await this.fileMetadadoProcessor.cleanupDeletedFiles(files, this.fileIndex);

      // 3. Filter files that need processing (new or modified)
      const filesToProcess = this.fileDiscovery.filterFilesToProcess(
        files,
        this.fileIndex
      );

      // 4. Sort files: process source code first, then documentation
      const sortedFiles = this.fileSorter.sortFilesByType(filesToProcess);

      // 5. Save file metadata to database (mark as pending for processing)
      progress.status = "processing";
      this.notifyProgress(progress);

      // Save source code files metadata
      for (const file of sortedFiles.sourceFiles) {
        try {
          progress.currentFile = file.relPath;
          this.notifyProgress(progress);

          await this.fileMetadadoProcessor.saveFileMetadata(file, this.fileIndex);

          progress.processedFiles++;
          this.notifyProgress(progress);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          progress.errors.push({ file: file.relPath, error: errorMsg });
          console.error(`❌ Error saving metadata for ${file.relPath}:`, error);
        }
      }

      // Then save documentation files metadata
      for (const file of sortedFiles.docFiles) {
        try {
          progress.currentFile = file.relPath;
          this.notifyProgress(progress);

          await this.fileMetadadoProcessor.saveFileMetadata(file, this.fileIndex);

          progress.processedFiles++;
          this.notifyProgress(progress);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          progress.errors.push({ file: file.relPath, error: errorMsg });
          console.error(`❌ Error saving metadata for ${file.relPath}:`, error);
        }
      }

      // 6. Build cross-file relationships (DISABLED by default)
      if (process.env.CAPPY_ENABLE_XFILE_REL === "1") {
        await this.crossFileRels.buildCrossFileRelationships(this.fileIndex);
      }

      progress.status = "completed";
      progress.currentFile = "";
      this.notifyProgress(progress);

    } catch (error) {
      progress.status = "error";
      console.error("❌ Workspace scan failed:", error);
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
