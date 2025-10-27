/**
 * @fileoverview Domain: File Metadata Types
 * @module file-metadata/domain
 */

/**
 * File processing status
 */
export type FileProcessingStatus = 
  | 'pending'                  // Waiting to be processed
  | 'processing'               // Currently being processed
  | 'extracting_entities'      // Extracting entities from file
  | 'creating_relationships'   // Creating relationships in graph
  | 'entity_discovery'         // Running LLM entity discovery
  | 'processed'                // Successfully processed (replaces 'completed')
  | 'completed'                // Legacy status (backward compatibility)
  | 'error'                    // Processing error (replaces 'failed')
  | 'failed'                   // Legacy status (backward compatibility)
  | 'paused'                   // Paused manually by user
  | 'cancelled';               // Processing cancelled

/**
 * File metadata record
 */
export interface FileMetadata {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  fileContent?: string; // Base64 encoded content for uploaded files
  status: FileProcessingStatus;
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  chunksCount?: number;
  nodesCount?: number;
  relationshipsCount?: number;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  total: number;
  pending: number;
  processing: number;
  extractingEntities: number;
  creatingRelationships: number;
  entityDiscovery: number;
  processed: number;
  completed: number;      // Legacy
  error: number;
  failed: number;         // Legacy
  paused: number;
  cancelled: number;
}
