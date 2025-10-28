/**
 * @fileoverview File processing worker using hexagonal architecture
 * @module services/file-processing-worker
 * @author Cappy Team
 * @since 3.0.9
 * @deprecated Use FileProcessingService from domains/file-processing instead
 * 
 * This file now acts as a facade/adapter to maintain backwards compatibility
 * while the system uses the new hexagonal architecture internally.
 */

import { FileProcessingService, type ProcessingResult, type ProgressCallback } from '../../../domains/file-processing';
import { FileSystemLoader } from '../adapters/file-processing/FileSystemLoader';
import { FileParserAdapter } from '../adapters/file-processing/FileParserAdapter';
import { IndexingStorageAdapter } from '../adapters/file-processing/IndexingStorageAdapter';
import { ASTRelationshipExtractorAdapter } from '../adapters/file-processing/ASTRelationshipExtractorAdapter';
import type { IndexingService } from './indexing-service';
import type { GraphStorePort } from '../../../domains/graph/ports/indexing-port';

// Re-export types for backwards compatibility
export type { ProcessingResult, ProgressCallback } from '../../../domains/file-processing';

/**
 * Backwards-compatible wrapper around FileProcessingService
 * Uses hexagonal architecture internally
 */
export class FileProcessingWorker {
  private readonly processingService: FileProcessingService;

  constructor(
    _parserService: unknown, // Not used anymore, kept for compatibility
    _hashService: unknown,   // Not used anymore, kept for compatibility
    workspaceRoot: string,
    indexingService?: IndexingService,
    graphStore?: GraphStorePort
  ) {
    // Setup adapters
    const fileLoader = new FileSystemLoader(workspaceRoot);
    const fileParser = new FileParserAdapter();
    const chunkStorage = indexingService ? new IndexingStorageAdapter(indexingService) : undefined;
    const relationshipExtractor = graphStore ? new ASTRelationshipExtractorAdapter(workspaceRoot, graphStore) : undefined;

    // Create domain service
    this.processingService = new FileProcessingService(
      fileLoader,
      fileParser,
      chunkStorage,
      relationshipExtractor
    );
  }

  /**
   * Processes a file and returns processing metrics
   * @param filePath File path (relative or absolute)
   * @param onProgress Progress callback
   * @param base64Content Optional embedded base64 content
   * @returns Processing result
   */
  async processFile(
    filePath: string,
    onProgress?: ProgressCallback,
    base64Content?: string
  ): Promise<ProcessingResult> {
    return this.processingService.processFile(filePath, base64Content, onProgress);
  }
}
