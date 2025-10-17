/**
 * @fileoverview Unified vector store using SQLite + sqlite-vss
 * @module adapters/secondary/vector/sqlite-vector-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from "../../../types/chunk";
import { SQLiteAdapter } from "../graph/sqlite-adapter";

/**
 * Vector store interface matching LanceDB API for easy migration
 */
export interface VectorStorePort {
  addChunks(chunks: DocumentChunk[], embeddings: number[][]): Promise<void>;
  search(
    queryEmbedding: number[],
    limit?: number
  ): Promise<
    Array<{
      chunk: DocumentChunk;
      score: number;
    }>
  >;
  deleteByFilePath(filePath: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * SQLite-based vector store using sqlite-vss
 * Replaces LanceDB with single SQLite database
 */
export class SQLiteVectorStore implements VectorStorePort {
  private graphStore: SQLiteAdapter;

  constructor(graphStore: SQLiteAdapter) {
    this.graphStore = graphStore;
  }

  /**
   * Adds chunks with their embeddings to the vector store
   */
  async addChunks(chunks: DocumentChunk[], embeddings: number[][]): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error(
        `Chunk count (${chunks.length}) does not match embedding count (${embeddings.length})`
      );
    }

    const vectorData = chunks.map((chunk, i) => ({
      id: chunk.id,
      content: chunk.content,
      embedding: embeddings[i],
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
    console.log(`✅ Vector store: Added ${chunks.length} chunks`);
  }

  /**
   * Searches for similar chunks using vector similarity
   */
  async search(
    queryEmbedding: number[],
    limit = 10
  ): Promise<
    Array<{
      chunk: DocumentChunk;
      score: number;
    }>
  > {
    const results = await this.graphStore.searchSimilar(queryEmbedding, limit);

    return results.map((result) => {
      const metadata = result.metadata as {
        filePath: string;
        lineStart: number;
        lineEnd: number;
        chunkType: string;
        symbolName?: string;
        symbolKind?: string;
      };

      const chunk: DocumentChunk = {
        id: result.id,
        content: result.content,
        metadata: {
          filePath: metadata.filePath,
          lineStart: metadata.lineStart,
          lineEnd: metadata.lineEnd,
          chunkType: metadata.chunkType as DocumentChunk["metadata"]["chunkType"],
          symbolName: metadata.symbolName,
          symbolKind: metadata.symbolKind as DocumentChunk["metadata"]["symbolKind"],
        },
      };

      return {
        chunk,
        score: result.score,
      };
    });
  }

  /**
   * Deletes all chunks belonging to a file
   */
  async deleteByFilePath(filePath: string): Promise<void> {
    // When we delete file nodes, CASCADE will handle vectors table
    await this.graphStore.deleteFileNodes(filePath);
    console.log(`✅ Vector store: Deleted chunks for ${filePath}`);
  }

  /**
   * Closes the vector store (delegates to graph store)
   */
  async close(): Promise<void> {
    // No-op: graph store manages the connection
    console.log(`ℹ️ Vector store: Close delegated to graph store`);
  }
}

/**
 * Factory function to create vector store from graph adapter
 */
export function createVectorStore(graphStore: SQLiteAdapter): VectorStorePort {
  return new SQLiteVectorStore(graphStore);
}
