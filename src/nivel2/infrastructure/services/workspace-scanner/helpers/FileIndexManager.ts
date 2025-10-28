/**
 * @fileoverview File index manager helper
 * @module workspace-scanner/helpers
 */

import { FileHashService } from '../../file-hash-service';
import type { FileIndexEntry } from '../../../../../shared/types/chunk';
import type { GraphStorePort } from '../../../../../domains/graph/ports/indexing-port';

/**
 * File index manager configuration
 */
export interface FileIndexManagerConfig {
  repoId: string;
  graphStore: GraphStorePort;
}

/**
 * Manages file index operations
 */
export class FileIndexManager {
  private readonly config: FileIndexManagerConfig;
  private readonly hashService: FileHashService;

  constructor(config: FileIndexManagerConfig) {
    this.config = config;
    this.hashService = new FileHashService();
  }

  /**
   * Loads file index from graph store
   */
  async loadFileIndex(): Promise<Map<string, FileIndexEntry>> {
    const fileIndex = new Map<string, FileIndexEntry>();
    
    try {
      console.log('📚 Loading file index from graph database...');
      
      const files = await this.config.graphStore.listAllFiles();
      
      for (const file of files) {
        const fileId = this.generateFileId(file.path);
        
        // Create a minimal FileIndexEntry from what we have
        fileIndex.set(file.path, {
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
      fileIndex.clear();
    }
    
    return fileIndex;
  }

  /**
   * Generates a unique file ID
   */
  generateFileId(relPath: string): string {
    return `file:${this.hashService.hashStringSync(relPath)}`;
  }
}
