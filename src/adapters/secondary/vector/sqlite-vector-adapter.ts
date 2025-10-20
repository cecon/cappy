/**
 * @fileoverview SQLite-based vector store implementing VectorStorePort
 * @module adapters/secondary/vector/sqlite-vector-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from "../../../types/chunk";
import type { VectorStorePort } from "../../../domains/graph/ports/indexing-port";
import { SQLiteAdapter } from "../graph/sqlite-adapter";

/**
 * SQLite-based vector store implementing VectorStorePort
 * Uses the same SQLite database as the graph store
 */
export class SQLiteVectorStore implements VectorStorePort {
  private graphStore: SQLiteAdapter;
  private initialized: boolean = false;

  constructor(graphStore: SQLiteAdapter) {
    this.graphStore = graphStore;
  }

  /**
   * Initializes the vector store (no-op since graphStore is already initialized)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // Graph store is already initialized, we just use its connection
    this.initialized = true;
    console.log('✅ SQLiteVectorStore: Using shared SQLite connection');
  }

  /**
   * Inserts or updates document chunks with their embeddings
   */
  async upsertChunks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized');
    }

    const vectorData = chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      embedding: chunk.vector || [],
      metadata: {
        filePath: chunk.metadata.filePath,
        lineStart: chunk.metadata.lineStart,
        lineEnd: chunk.metadata.lineEnd,
        chunkType: chunk.metadata.chunkType,
        symbolName: chunk.metadata.symbolName,
        symbolKind: chunk.metadata.symbolKind,
      },
    }));

    await this.graphStore.storeEmbeddings(vectorData);
    console.log(`✅ Vector store: Upserted ${chunks.length} chunks`);
  }

  /**
   * Performs vector similarity search
   * Note: query is expected to be a string that needs embedding generation
   */
  async search(_query: string, _limit?: number): Promise<DocumentChunk[]> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized');
    }

    // Mark _query and _limit as intentionally unused for now
    void _query;
    void _limit;

    // TODO: Implement embedding generation for query string
    // For now, return empty array as this requires EmbeddingService integration
    console.warn('⚠️ search() not fully implemented - requires embedding generation');
    return [];
  }

  /**
   * Gets chunks by their IDs
   */
  async getChunksByIds(ids: string[]): Promise<DocumentChunk[]> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized');
    }

    if (ids.length === 0) {
      return [];
    }

    // TODO: Implement getChunksByIds in SQLiteAdapter if not exists
    // For now, return empty array
    console.warn('⚠️ getChunksByIds() requires implementation in SQLiteAdapter');
    return [];
  }

  /**
   * Deletes all chunks belonging to a file
   */
  async deleteChunksByFile(filePath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector store not initialized');
    }

    // Delete file nodes, CASCADE will handle vectors table
    await this.graphStore.deleteFileNodes(filePath);
    console.log(`✅ Vector store: Deleted chunks for ${filePath}`);
  }

  /**
   * Closes the vector store (delegates to graph store)
   */
  async close(): Promise<void> {
    // No-op: graph store manages the connection
    this.initialized = false;
    console.log(`ℹ️ Vector store: Close delegated to graph store`);
  }
}

/**
 * Factory function to create vector store from graph adapter
 */
export function createVectorStore(graphStore: SQLiteAdapter): VectorStorePort {
  return new SQLiteVectorStore(graphStore);
}
