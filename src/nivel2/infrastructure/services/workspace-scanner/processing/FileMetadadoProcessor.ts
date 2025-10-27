/**
 * @fileoverview File processing module for workspace scanner
 * @module workspace-scanner/processing
 */

import * as path from "path";
import { FileHashService } from "../../file-hash-service";
import type { FileIndexEntry } from "../../../../../shared/types/chunk";
import type { WorkspaceScannerConfig } from "../types";
import type { FileProcessorConfig } from "../types/file-processor-config";


/**
 * Handles file processing and metadata extraction
 */
export class FileMetadadoProcessor {
  private readonly config: WorkspaceScannerConfig;
  private readonly hashService: FileHashService;

  constructor(config: FileProcessorConfig) {
    this.config = config.config;
    this.hashService = new FileHashService();
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
   * Saves file metadata to database (marks file as pending for processing)
   */
  async saveFileMetadata(
    file: FileIndexEntry,
    fileIndex: Map<string, FileIndexEntry>
  ): Promise<void> {
    console.log(`💾 Saving metadata: ${file.relPath}`);

    // 1. Save to SQLite metadata database (if available)
    if (this.config.metadataDatabase) {
      const fileId = `file:${this.hashService.hashStringSync(file.relPath)}`;

      // Check if file already exists in database
      const existing = await this.config.metadataDatabase.getFile(fileId);

      if (existing) {
        // Update existing record
        await this.config.metadataDatabase.updateFile(fileId, {
          status: "pending",
          progress: 0,
          currentStep: "Queued for processing",
          fileHash: file.contentHash,
          fileSize: file.sizeBytes,
          errorMessage: undefined,
          processingStartedAt: undefined,
          processingCompletedAt: undefined,
        });
        console.log(`   ✅ Updated metadata in database: ${file.relPath}`);
      } else {
        // Insert new record
        await this.config.metadataDatabase.insertFile({
          id: fileId,
          filePath: file.relPath,
          fileName: path.basename(file.relPath),
          fileSize: file.sizeBytes,
          fileHash: file.contentHash,
          status: "pending",
          progress: 0,
          currentStep: "Queued for processing",
          retryCount: 0,
          maxRetries: 3,
          chunksCount: undefined,
          nodesCount: undefined,
          relationshipsCount: undefined,
          processingStartedAt: undefined,
          processingCompletedAt: undefined,
        });
        console.log(`   ✅ Inserted metadata into database: ${file.relPath}`);
      }
    } else {
      console.error(
        `⚠️ No metadata database configured; metadata-only scan will not persist ${file.relPath}.`
      );
    }

    // 2. Update file index in memory
    file.pendingGraph = true;
    file.lastIndexedAtEpochMs = Date.now();
    fileIndex.set(file.relPath, file);

    console.log(`   ✅ Metadata saved for ${file.relPath} (pending=true)`);
  }
}
