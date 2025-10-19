/**
 * @fileoverview Types for document chunks and indexing
 * @module types/chunk
 * @author Cappy Team
 * @since 3.0.0
 */

/**
 * Chunk types based on content origin
 */
export type ChunkType = 'jsdoc' | 'markdown_section' | 'code' | 'plain_text';

/**
 * Document chunk metadata
 */
export interface ChunkMetadata {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  chunkType: ChunkType;
  symbolName?: string;
  symbolKind?: 'function' | 'class' | 'interface' | 'type' | 'variable';
  heading?: string;
  headingLevel?: number;
}

/**
 * Document chunk for vector store (with content)
 */
export interface DocumentChunk {
  id: string;
  content: string;
  vector?: number[];
  metadata: ChunkMetadata;
}

/**
 * Chunk node for graph database (without content)
 */
export interface ChunkNode {
  id: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  chunkType: ChunkType;
  symbolName?: string;
  symbolKind?: string;
}

/**
 * File node for graph database
 */
export interface FileNode {
  path: string;
  language: string;
  linesOfCode: number;
}

/**
 * Entity node for graph database
 */
export interface EntityNode {
  id: string;
  name: string;
  category: string;
  description: string;
  importance: number;
}

/**
 * Relationship types
 */
export type RelationType = 'CONTAINS' | 'DOCUMENTS' | 'REFERENCES' | 'DEFINES' | 'RELATES_TO' | 'IMPORTS_PKG';

/**
 * Graph relationship
 */
export interface GraphRelationship {
  from: string;
  to: string;
  type: RelationType;
  properties?: Record<string, string | number | boolean | string[] | null>;
}

/**
 * File index entry for tracking updates
 */
export interface FileIndexEntry {
  repoId: string;
  fileId: string;
  relPath: string;
  isAvailable: boolean;
  isDeleted: boolean;
  sizeBytes: number;
  mtimeEpochMs: number;
  hashAlgo: 'blake3' | 'sha256' | 'md5';
  contentHash: string;
  hashStatus: 'OK' | 'MISMATCH' | 'UNKNOWN';
  hashVerifiedAtEpochMs?: number;
  language?: string;
  lastIndexedAtEpochMs: number;
  pendingGraph: boolean;
}
