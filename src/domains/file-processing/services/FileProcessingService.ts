/**
 * @fileoverview File processing domain service (use case)
 * @module domains/file-processing/services
 */

import type { FileLoaderPort } from '../ports/FileLoaderPort';
import type { FileParserPort } from '../ports/FileParserPort';
import type { ChunkStoragePort } from '../ports/ChunkStoragePort';
import type { RelationshipExtractorPort } from '../ports/RelationshipExtractorPort';
import type { ProcessingResult, ProgressCallback } from '../entities/ProcessingResult';

/**
 * Configuration for file processing service
 */
export interface FileProcessingConfig {
  /** Enable chunk storage */
  enableStorage?: boolean;
  
  /** Enable relationship extraction */
  enableRelationships?: boolean;
}

/**
 * Domain service for processing files
 * Orchestrates the file processing workflow using ports
 */
export class FileProcessingService {
  private readonly fileLoader: FileLoaderPort;
  private readonly fileParser: FileParserPort;
  private readonly chunkStorage?: ChunkStoragePort;
  private readonly relationshipExtractor?: RelationshipExtractorPort;

  constructor(
    fileLoader: FileLoaderPort,
    fileParser: FileParserPort,
    chunkStorage?: ChunkStoragePort,
    relationshipExtractor?: RelationshipExtractorPort
  ) {
    this.fileLoader = fileLoader;
    this.fileParser = fileParser;
    this.chunkStorage = chunkStorage;
    this.relationshipExtractor = relationshipExtractor;
  }

  /**
   * Processes a file through the complete pipeline
   * @param filePath File path (relative or absolute)
   * @param base64Content Optional embedded content
   * @param onProgress Progress callback
   * @param config Processing configuration
   * @returns Processing result with metrics
   */
  async processFile(
    filePath: string,
    base64Content?: string,
    onProgress?: ProgressCallback,
    config: FileProcessingConfig = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const { enableStorage = true, enableRelationships = true } = config;

    try {
      // Step 1: Load file content
      onProgress?.('Loading file...', 5);
      const fileContent = await this.fileLoader.loadFile(filePath, base64Content);
      console.log(`✓ Loaded ${fileContent.isEmbedded ? 'embedded' : 'disk'} file: ${fileContent.filePath} (${fileContent.size} bytes)`);

      // Step 2: Parse file into chunks
      onProgress?.('Parsing file...', 30);
      let chunks = await this.fileParser.parseFile(fileContent.absolutePath, fileContent.content);
      
      // Fallback if no chunks found
      if (chunks.length === 0) {
        onProgress?.('Creating fallback chunk...', 40);
        chunks = [this.fileParser.createFallbackChunk(fileContent.filePath, fileContent.content)];
        console.log(`⚠️ No chunks parsed; created 1 fallback chunk for ${fileContent.filePath}`);
      }
      
      onProgress?.('Chunks generated', 50);
      console.log(`✓ Generated ${chunks.length} chunks from ${fileContent.filePath}`);

      // Step 3: Store chunks (if enabled and storage available)
      if (enableStorage && this.chunkStorage) {
        onProgress?.('Saving chunks...', 60);
        await this.chunkStorage.storeChunks(
          fileContent.filePath,
          fileContent.language,
          chunks
        );
        console.log(`✓ Stored ${chunks.length} chunks to database`);
      }

      // Step 4: Extract relationships (if enabled and extractor available)
      let nodesCount = 0;
      let relationshipsCount = 0;
      
      if (enableRelationships && this.relationshipExtractor) {
        onProgress?.('Extracting relationships...', 70);
        const result = await this.relationshipExtractor.extractRelationships(
          fileContent.absolutePath,
          fileContent.content
        );
        nodesCount = result.nodesCount;
        relationshipsCount = result.relationshipsCount;
        console.log(`✓ Extracted ${nodesCount} nodes and ${relationshipsCount} relationships`);
      }

      // Step 5: Complete
      onProgress?.('Processing complete', 100);
      const duration = Date.now() - startTime;

      return {
        chunksCount: chunks.length,
        nodesCount,
        relationshipsCount,
        duration
      };

    } catch (error) {
      console.error(`❌ Error processing file ${filePath}:`, error);
      throw error;
    }
  }
}
