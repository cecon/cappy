/**
 * @fileoverview File processing domain exports
 * @module domains/file-processing
 */

// Entities
export type { ProcessingResult, ProgressCallback } from './entities/ProcessingResult';
export type { FileContent } from './entities/FileContent';

// Ports
export type { FileLoaderPort } from './ports/FileLoaderPort';
export type { FileParserPort } from './ports/FileParserPort';
export type { ChunkStoragePort } from './ports/ChunkStoragePort';
export type { RelationshipExtractorPort, RelationshipExtractionResult } from './ports/RelationshipExtractorPort';

// Services
export { FileProcessingService } from './services/FileProcessingService';
export type { FileProcessingConfig } from './services/FileProcessingService';
