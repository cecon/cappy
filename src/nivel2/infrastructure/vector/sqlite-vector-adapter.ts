/**
 * @fileoverview SQLite-based vector store implementing VectorStorePort
 * @module adapters/secondary/vector/sqlite-vector-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from "../../../shared/types/chunk";
import type { VectorStorePort } from "../../../domains/dashboard/ports/indexing-port";
import type { EmbeddingService } from "../services/embedding-service";
import { SQLiteAdapter } from "../database/sqlite-adapter";

/**
 * SQLite-based vector store implementing VectorStorePort
 * Uses the same SQLite database as the graph store
 */
export class SQLiteVectorStore implements VectorStorePort {
  private graphStore: SQLiteAdapter;
  private initialized: boolean = false;
  private embeddingService?: EmbeddingService;

  constructor(graphStore: SQLiteAdapter, embeddingService?: EmbeddingService) {
    this.graphStore = graphStore;
    this.embeddingService = embeddingService;
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

    const limit = _limit ?? 10;

    // Try to generate an embedding if service is available; fall back gracefully
    let queryEmbedding: number[] = [];
    if (this.embeddingService) {
      try {
        queryEmbedding = await this.embeddingService.embed(_query);
      } catch (err) {
        console.warn('⚠️ Failed to generate query embedding, falling back to metadata-only search:', err);
      }
    } else {
      console.warn('ℹ️ EmbeddingService not provided to SQLiteVectorStore; using simplified search');
    }

    // Delegate to SQLite adapter (currently returns top-N without true similarity if embedding not used)
    const results = await this.graphStore.searchSimilar(queryEmbedding, limit);

    // Map to DocumentChunk using stored metadata from vectors table
    const chunks: DocumentChunk[] = results.map((r) => {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      return {
        id: r.id,
        content: r.content,
        metadata: {
          filePath: (meta.filePath as string) || '',
          lineStart: (meta.lineStart as number) ?? 0,
          lineEnd: (meta.lineEnd as number) ?? 0,
          // Default to plain_text if missing
          chunkType: (meta.chunkType as DocumentChunk['metadata']['chunkType']) || 'plain_text',
          symbolName: meta.symbolName as string | undefined,
          symbolKind: meta.symbolKind as DocumentChunk['metadata']['symbolKind'] | undefined,
        },
      };
    });

    return chunks;
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

    // Query the underlying SQLite adapter for vector rows by IDs
    try {
      const rows = await this.graphStore.getChunksByIds(ids);
      return rows;
    } catch (err) {
      console.warn('⚠️ getChunksByIds() failed:', err);
      return [];
    }
  }


  /**
   * Deletes chunks by file path
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
export function createVectorStore(
  graphStore: SQLiteAdapter, 
  embeddingService?: EmbeddingService
): VectorStorePort {
  return new SQLiteVectorStore(graphStore, embeddingService);
}
