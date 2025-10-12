/**
 * @fileoverview LanceDB adapter for vector storage
 * @module adapters/secondary/vector/lancedb-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import { connect, Connection, Table } from '@lancedb/lancedb';
import type { VectorStorePort } from '../../../domains/graph/ports/indexing-port';
import type { DocumentChunk } from '../../../types/chunk';
import type { ChunkType } from '../../../types/chunk';
import type { EmbeddingService } from '../../../services/embedding-service';

/**
 * LanceDB adapter implementing VectorStorePort
 */
export class LanceDBAdapter implements VectorStorePort {
  private connection?: Connection;
  private table?: Table;
  private readonly dbPath: string;
  private readonly tableName = 'document_chunks';
  private embeddingService?: EmbeddingService;

  constructor(dbPath: string, embeddingService?: EmbeddingService) {
    this.dbPath = dbPath;
    this.embeddingService = embeddingService;
  }

  /**
   * Initializes the LanceDB connection and creates table if needed
   */
  async initialize(): Promise<void> {
    try {
      // Connect to LanceDB
      this.connection = await connect(this.dbPath);
      
      // Try to open existing table or create new one
      try {
        this.table = await this.connection.openTable(this.tableName);
        console.log('✅ LanceDB: Opened existing table');
      } catch {
        // Table doesn't exist, create it with schema
        const sampleData = [{
          id: 'sample',
          content: 'Sample content',
          vector: new Array(384).fill(0),
          filePath: 'sample.ts',
          lineStart: 1,
          lineEnd: 1,
          chunkType: 'code',
          symbolName: 'sampleSymbol',
          symbolKind: 'function',
          heading: 'Sample Heading',
          headingLevel: 1
        }];
        
        this.table = await this.connection.createTable(this.tableName, sampleData);
        
        // Delete sample row
        await this.table.delete('id = "sample"');
        console.log('✅ LanceDB: Created new table');
      }
    } catch (error) {
      console.error('❌ LanceDB initialization error:', error);
      throw new Error(`Failed to initialize LanceDB: ${error}`);
    }
  }

  /**
   * Inserts or updates document chunks
   */
  async upsertChunks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.table) {
      throw new Error('LanceDB not initialized');
    }

    try {
      // Transform chunks to LanceDB format
      const records = chunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        vector: chunk.vector || new Array(384).fill(0),
        filePath: chunk.metadata.filePath,
        lineStart: chunk.metadata.lineStart,
        lineEnd: chunk.metadata.lineEnd,
        chunkType: chunk.metadata.chunkType,
        symbolName: chunk.metadata.symbolName || null,
        symbolKind: chunk.metadata.symbolKind || null,
        heading: chunk.metadata.heading || null,
        headingLevel: chunk.metadata.headingLevel || null
      }));

      // Add records to table (LanceDB handles upsert automatically)
      await this.table.add(records);
      console.log(`✅ LanceDB: Upserted ${chunks.length} chunks`);
    } catch (error) {
      console.error('❌ LanceDB upsert error:', error);
      throw new Error(`Failed to upsert chunks: ${error}`);
    }
  }

  /**
   * Performs vector similarity search
   */
  async search(query: string, limit = 10): Promise<DocumentChunk[]> {
    if (!this.table) {
      throw new Error('LanceDB not initialized');
    }

    if (!this.embeddingService) {
      console.warn('⚠️ LanceDB search requires embedding service');
      return [];
    }

    try {
      // Generate query embedding
      const queryVector = await this.embeddingService.embed(query);
      
      // Perform vector search
      const results = await this.table
        .vectorSearch(queryVector)
        .limit(limit)
        .toArray();

      return results.map((record: Record<string, unknown>) => ({
        id: record.id as string,
        content: record.content as string,
        vector: record.vector as number[],
        metadata: {
          filePath: record.filePath as string,
          lineStart: record.lineStart as number,
          lineEnd: record.lineEnd as number,
          chunkType: record.chunkType as ChunkType,
          symbolName: record.symbolName as string | undefined,
          symbolKind: record.symbolKind as 'function' | 'class' | 'interface' | 'type' | 'variable' | undefined,
          heading: record.heading as string | undefined,
          headingLevel: record.headingLevel as number | undefined
        }
      }));
    } catch (error) {
      console.error('❌ LanceDB search error:', error);
      throw new Error(`Failed to search: ${error}`);
    }
  }

  /**
   * Gets chunks by IDs
   */
  async getChunksByIds(ids: string[]): Promise<DocumentChunk[]> {
    if (!this.table) {
      throw new Error('LanceDB not initialized');
    }

    try {
      // Query all records and filter in memory (LanceDB API limitation)
      const allRecords = await this.table.query().limit(10000).toArray();
      const idSet = new Set(ids);
      const results = allRecords.filter((record: Record<string, unknown>) => 
        idSet.has(record.id as string)
      );

      return results.map((record: Record<string, unknown>) => ({
        id: record.id as string,
        content: record.content as string,
        vector: record.vector as number[],
        metadata: {
          filePath: record.filePath as string,
          lineStart: record.lineStart as number,
          lineEnd: record.lineEnd as number,
          chunkType: record.chunkType as ChunkType,
          symbolName: record.symbolName as string | undefined,
          symbolKind: record.symbolKind as 'function' | 'class' | 'interface' | 'type' | 'variable' | undefined,
          heading: record.heading as string | undefined,
          headingLevel: record.headingLevel as number | undefined
        }
      }));
    } catch (error) {
      console.error('❌ LanceDB getChunksByIds error:', error);
      throw new Error(`Failed to get chunks by IDs: ${error}`);
    }
  }

  /**
   * Deletes chunks by file path
   */
  async deleteChunksByFile(filePath: string): Promise<void> {
    if (!this.table) {
      throw new Error('LanceDB not initialized');
    }

    try {
      await this.table.delete(`filePath = "${filePath}"`);
      console.log(`✅ LanceDB: Deleted chunks for ${filePath}`);
    } catch (error) {
      console.error('❌ LanceDB delete error:', error);
      throw new Error(`Failed to delete chunks: ${error}`);
    }
  }

  /**
   * Closes the connection
   */
  async close(): Promise<void> {
    // LanceDB connections are automatically managed
    this.connection = undefined;
    this.table = undefined;
    console.log('✅ LanceDB: Connection closed');
  }
}

/**
 * Factory function to create LanceDB adapter
 */
export function createLanceDBAdapter(dbPath: string, embeddingService?: EmbeddingService): VectorStorePort {
  return new LanceDBAdapter(dbPath, embeddingService);
}
