/**
 * @fileoverview Entity extraction types for document processing
 * @module types/entity
 * @author Cappy Team
 * @since 3.1.0
 */

/**
 * Extracted entity from document
 */
export interface ExtractedEntity {
  /** Entity name/identifier */
  name: string;
  
  /** Entity type (class, function, API, concept, technology, pattern, etc.) */
  type: EntityType;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Context where the entity was mentioned */
  context?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Entity types
 */
export type EntityType =
  | 'class'
  | 'function'
  | 'interface'
  | 'type'
  | 'api'
  | 'library'
  | 'framework'
  | 'concept'
  | 'pattern'
  | 'technology'
  | 'service'
  | 'component'
  | 'module'
  | 'package'
  | 'tool'
  | 'other';

/**
 * Relationship between entities
 */
export interface EntityRelationship {
  /** Source entity */
  from: string;
  
  /** Target entity */
  to: string;
  
  /** Relationship type */
  type: RelationshipType;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Context of the relationship */
  context?: string;
}

/**
 * Relationship types
 */
export type RelationshipType =
  | 'uses'
  | 'implements'
  | 'extends'
  | 'references'
  | 'depends_on'
  | 'mentions'
  | 'describes'
  | 'contains'
  | 'part_of'
  | 'related_to'
  | 'configures'
  | 'calls'
  | 'instantiates';

/**
 * Result of entity extraction
 */
export interface EntityExtractionResult {
  /** Extracted entities */
  entities: ExtractedEntity[];
  
  /** Extracted relationships */
  relationships: EntityRelationship[];
  
  /** Source chunk ID */
  chunkId: string;
  
  /** Processing metadata */
  metadata: {
    /** Processing timestamp */
    timestamp: string;
    
    /** LLM model used */
    model: string;
    
    /** Processing time in ms */
    processingTime: number;
    
    /** Token count (if available) */
    tokenCount?: number;
  };
}

/**
 * Document entity metadata for chunks
 */
export interface DocumentEntityMetadata {
  /** Extracted entities */
  entities: string[];
  
  /** Entity types */
  entityTypes: Record<string, EntityType>;
  
  /** Relationships from this chunk */
  relationships: EntityRelationship[];
  
  /** Extraction timestamp */
  extractedAt: string;
  
  /** Extraction model */
  extractionModel: string;
}
