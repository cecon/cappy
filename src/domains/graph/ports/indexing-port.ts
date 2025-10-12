/**
 * @fileoverview Port for document indexing operations
 * @module ports/indexing-port
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk, FileIndexEntry } from '../../../types/chunk';

/**
 * Vector store port (LanceDB)
 */
export interface VectorStorePort {
  /**
   * Initializes the vector store connection
   */
  initialize(): Promise<void>;

  /**
   * Inserts or updates document chunks
   */
  upsertChunks(chunks: DocumentChunk[]): Promise<void>;

  /**
   * Performs vector similarity search
   */
  search(query: string, limit?: number): Promise<DocumentChunk[]>;

  /**
   * Gets chunks by IDs
   */
  getChunksByIds(ids: string[]): Promise<DocumentChunk[]>;

  /**
   * Deletes chunks by file path
   */
  deleteChunksByFile(filePath: string): Promise<void>;

  /**
   * Closes the connection
   */
  close(): Promise<void>;
}

/**
 * Graph store port (Kuzu)
 */
export interface GraphStorePort {
  /**
   * Initializes the graph store connection
   */
  initialize(): Promise<void>;

  /**
   * Creates a file node
   */
  createFileNode(path: string, language: string, linesOfCode: number): Promise<void>;

  /**
   * Creates chunk nodes
   */
  createChunkNodes(chunks: DocumentChunk[]): Promise<void>;

  /**
   * Creates relationships between nodes
   */
  createRelationships(relationships: Array<{ from: string; to: string; type: string; properties?: Record<string, string | number | boolean> }>): Promise<void>;

  /**
   * Queries related chunks via graph traversal
   */
  getRelatedChunks(chunkIds: string[], depth?: number): Promise<string[]>;

  /**
   * Deletes all nodes and relationships for a file
   */
  deleteFileNodes(filePath: string): Promise<void>;

  /**
   * Closes the connection
   */
  close(): Promise<void>;
}

/**
 * File index port for tracking updates
 */
export interface FileIndexPort {
  /**
   * Gets file index entry
   */
  getFileEntry(repoId: string, fileId: string): Promise<FileIndexEntry | null>;

  /**
   * Updates or inserts file index entry
   */
  upsertFileEntry(entry: FileIndexEntry): Promise<void>;

  /**
   * Lists all indexed files
   */
  listFiles(repoId: string): Promise<FileIndexEntry[]>;

  /**
   * Marks file as deleted
   */
  markFileAsDeleted(repoId: string, fileId: string): Promise<void>;
}
