/**
 * @fileoverview Port for extracting code relationships
 * @module domains/file-processing/ports
 */

/**
 * Result of relationship extraction
 */
export interface RelationshipExtractionResult {
  nodesCount: number;
  relationshipsCount: number;
}

/**
 * Port for extracting relationships from code
 */
export interface RelationshipExtractorPort {
  /**
   * Extracts relationships from file
   * @param filePath File path (absolute)
   * @param content File content
   * @returns Extraction result with counts
   */
  extractRelationships(filePath: string, content: string): Promise<RelationshipExtractionResult>;
}
