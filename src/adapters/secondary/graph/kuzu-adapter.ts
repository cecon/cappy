/**
 * @fileoverview Kuzu adapter for graph storage
 * @module adapters/secondary/graph/kuzu-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphStorePort } from '../../../domains/graph/ports/indexing-port';
import type { DocumentChunk } from '../../../types/chunk';
import type { ChunkNode } from '../../../types/chunk';

/**
 * Kuzu adapter implementing GraphStorePort
 * 
 * Note: This is a simplified in-memory implementation as kuzu-wasm is deprecated.
 * In production, replace with actual Kuzu database connection.
 */
export class KuzuAdapter implements GraphStorePort {
  private fileNodes: Map<string, { path: string; language: string; linesOfCode: number }>;
  private chunkNodes: Map<string, ChunkNode>;
  private relationships: Array<{ from: string; to: string; type: string; properties?: Record<string, string | number | boolean> }>;
  private readonly dbPath: string;
  private initialized = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.fileNodes = new Map();
    this.chunkNodes = new Map();
    this.relationships = [];
  }

  /**
   * Initializes the Kuzu connection
   */
  async initialize(): Promise<void> {
    try {
      // TODO: Replace with actual Kuzu initialization when available
      console.warn('⚠️ Using in-memory graph store (Kuzu integration pending)');
      console.log(`📊 Graph store path: ${this.dbPath}`);
      this.initialized = true;
      console.log('✅ Kuzu: Initialized (in-memory mode)');
    } catch (error) {
      console.error('❌ Kuzu initialization error:', error);
      throw new Error(`Failed to initialize Kuzu: ${error}`);
    }
  }

  /**
   * Creates a file node
   */
  async createFileNode(path: string, language: string, linesOfCode: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Kuzu not initialized');
    }

    try {
      this.fileNodes.set(path, { path, language, linesOfCode });
      console.log(`✅ Kuzu: Created file node for ${path}`);
    } catch (error) {
      console.error('❌ Kuzu createFileNode error:', error);
      throw new Error(`Failed to create file node: ${error}`);
    }
  }

  /**
   * Creates chunk nodes
   */
  async createChunkNodes(chunks: DocumentChunk[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Kuzu not initialized');
    }

    try {
      for (const chunk of chunks) {
        this.chunkNodes.set(chunk.id, {
          id: chunk.id,
          filePath: chunk.metadata.filePath,
          lineStart: chunk.metadata.lineStart,
          lineEnd: chunk.metadata.lineEnd,
          chunkType: chunk.metadata.chunkType,
          symbolName: chunk.metadata.symbolName,
          symbolKind: chunk.metadata.symbolKind
        });
      }
      console.log(`✅ Kuzu: Created ${chunks.length} chunk nodes`);
    } catch (error) {
      console.error('❌ Kuzu createChunkNodes error:', error);
      throw new Error(`Failed to create chunk nodes: ${error}`);
    }
  }

  /**
   * Creates relationships between nodes
   */
  async createRelationships(
    relationships: Array<{ from: string; to: string; type: string; properties?: Record<string, string | number | boolean> }>
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Kuzu not initialized');
    }

    try {
      this.relationships.push(...relationships);
      console.log(`✅ Kuzu: Created ${relationships.length} relationships`);
    } catch (error) {
      console.error('❌ Kuzu createRelationships error:', error);
      throw new Error(`Failed to create relationships: ${error}`);
    }
  }

  /**
   * Queries related chunks via graph traversal
   */
  async getRelatedChunks(chunkIds: string[], depth = 2): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('Kuzu not initialized');
    }

    try {
      // Simple BFS traversal in memory
      const visited = new Set<string>(chunkIds);
      const queue = [...chunkIds];
      let currentDepth = 0;

      while (queue.length > 0 && currentDepth < depth) {
        const levelSize = queue.length;
        
        for (let i = 0; i < levelSize; i++) {
          const current = queue.shift();
          if (!current) continue;

          // Find related chunks through relationships
          for (const rel of this.relationships) {
            if (rel.from === current && !visited.has(rel.to)) {
              visited.add(rel.to);
              queue.push(rel.to);
            }
            if (rel.to === current && !visited.has(rel.from)) {
              visited.add(rel.from);
              queue.push(rel.from);
            }
          }
        }
        
        currentDepth++;
      }

      // Remove original chunk IDs from results
      const related = Array.from(visited).filter(id => !chunkIds.includes(id));
      console.log(`✅ Kuzu: Found ${related.length} related chunks`);
      return related;
    } catch (error) {
      console.error('❌ Kuzu getRelatedChunks error:', error);
      throw new Error(`Failed to get related chunks: ${error}`);
    }
  }

  /**
   * Deletes all nodes and relationships for a file
   */
  async deleteFileNodes(filePath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Kuzu not initialized');
    }

    try {
      // Delete file node
      this.fileNodes.delete(filePath);

      // Delete chunk nodes for this file
      const chunksToDelete: string[] = [];
      for (const [id, chunk] of this.chunkNodes.entries()) {
        if (chunk.filePath === filePath) {
          chunksToDelete.push(id);
        }
      }
      
      for (const id of chunksToDelete) {
        this.chunkNodes.delete(id);
      }

      // Delete relationships involving these chunks
      this.relationships = this.relationships.filter(rel => 
        !chunksToDelete.includes(rel.from) && !chunksToDelete.includes(rel.to)
      );

      console.log(`✅ Kuzu: Deleted nodes for ${filePath}`);
    } catch (error) {
      console.error('❌ Kuzu deleteFileNodes error:', error);
      throw new Error(`Failed to delete file nodes: ${error}`);
    }
  }

  /**
   * Closes the connection
   */
  async close(): Promise<void> {
    this.fileNodes.clear();
    this.chunkNodes.clear();
    this.relationships = [];
    this.initialized = false;
    console.log('✅ Kuzu: Connection closed');
  }

  /**
   * Gets statistics for debugging
   */
  getStats() {
    return {
      fileNodes: this.fileNodes.size,
      chunkNodes: this.chunkNodes.size,
      relationships: this.relationships.length
    };
  }
}

/**
 * Factory function to create Kuzu adapter
 */
export function createKuzuAdapter(dbPath: string): GraphStorePort {
  return new KuzuAdapter(dbPath);
}
