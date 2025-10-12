/**
 * @fileoverview Indexing service that coordinates vector and graph stores
 * @module services/indexing-service
 * @author Cappy Team
 * @since 3.0.0
 */

import type { VectorStorePort, GraphStorePort } from '../domains/graph/ports/indexing-port';
import type { DocumentChunk } from '../types/chunk';
import type { EmbeddingService } from './embedding-service';

/**
 * Indexing service coordinating LanceDB and Kuzu
 */
export class IndexingService {
  private readonly vectorStore: VectorStorePort;
  private readonly graphStore: GraphStorePort;
  private readonly embeddingService: EmbeddingService;

  constructor(
    vectorStore: VectorStorePort, 
    graphStore: GraphStorePort,
    embeddingService: EmbeddingService
  ) {
    this.vectorStore = vectorStore;
    this.graphStore = graphStore;
    this.embeddingService = embeddingService;
  }

  /**
   * Initializes both stores
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing indexing service...');
    await Promise.all([
      this.vectorStore.initialize(),
      this.graphStore.initialize()
    ]);
    console.log('✅ Indexing service initialized');
  }

  /**
   * Indexes a file with its chunks
   */
  async indexFile(
    filePath: string,
    language: string,
    chunks: DocumentChunk[]
  ): Promise<void> {
    try {
      console.log(`📑 Indexing ${filePath} with ${chunks.length} chunks...`);

      // 1. Generate embeddings for all chunks
      console.log(`🤖 Generating embeddings for ${chunks.length} chunks...`);
      const embeddings = await this.embeddingService.embedBatch(
        chunks.map(c => c.content),
        32
      );

      // Attach embeddings to chunks
      chunks.forEach((chunk, i) => {
        chunk.vector = embeddings[i];
      });

      // 2. Insert chunks into LanceDB (with content and vectors)
      await this.vectorStore.upsertChunks(chunks);

      // 3. Create file node in Kuzu
      const linesOfCode = Math.max(...chunks.map(c => c.metadata.lineEnd));
      await this.graphStore.createFileNode(filePath, language, linesOfCode);

      // 4. Create chunk nodes in Kuzu (without content)
      await this.graphStore.createChunkNodes(chunks);

      // 5. Create CONTAINS relationships (File -> Chunks)
      const containsRels = chunks.map((chunk, index) => ({
        from: filePath,
        to: chunk.id,
        type: 'CONTAINS',
        properties: { order: index }
      }));
      await this.graphStore.createRelationships(containsRels);

      // 6. Create DOCUMENTS relationships (JSDoc -> Code)
      const documentsRels = chunks
        .filter(c => c.metadata.chunkType === 'jsdoc' && c.metadata.symbolName)
        .map(jsdoc => {
          // Find corresponding code chunk
          const codeChunk = chunks.find(c => 
            c.metadata.chunkType === 'code' && 
            c.metadata.symbolName === jsdoc.metadata.symbolName
          );
          return codeChunk ? {
            from: jsdoc.id,
            to: codeChunk.id,
            type: 'DOCUMENTS',
            properties: {}
          } : null;
        })
        .filter((rel): rel is NonNullable<typeof rel> => rel !== null);
      
      if (documentsRels.length > 0) {
        await this.graphStore.createRelationships(documentsRels);
      }

      console.log(`✅ Indexed ${filePath} successfully`);
    } catch (error) {
      console.error(`❌ Error indexing ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Performs hybrid search (vector + graph traversal)
   */
  async hybridSearch(query: string, depth = 2): Promise<{
    directMatches: DocumentChunk[];
    relatedChunks: DocumentChunk[];
  }> {
    try {
      console.log(`🔍 Hybrid search: "${query}" (depth: ${depth})`);

      // 1. Vector search in LanceDB
      const directMatches = await this.vectorStore.search(query, 10);
      console.log(`   📊 Found ${directMatches.length} direct matches`);

      // 2. Graph traversal in Kuzu to find related chunks
      const chunkIds = directMatches.map(c => c.id);
      const relatedIds = chunkIds.length > 0 
        ? await this.graphStore.getRelatedChunks(chunkIds, depth)
        : [];
      console.log(`   🕸️ Found ${relatedIds.length} related chunks via graph`);

      // 3. Fetch related chunks from LanceDB
      const relatedChunks = relatedIds.length > 0
        ? await this.vectorStore.getChunksByIds(relatedIds)
        : [];

      return {
        directMatches,
        relatedChunks
      };
    } catch (error) {
      console.error('❌ Hybrid search error:', error);
      throw error;
    }
  }

  /**
   * Removes a file from both stores
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting ${filePath}...`);
      await Promise.all([
        this.vectorStore.deleteChunksByFile(filePath),
        this.graphStore.deleteFileNodes(filePath)
      ]);
      console.log(`✅ Deleted ${filePath}`);
    } catch (error) {
      console.error(`❌ Error deleting ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Closes both stores
   */
  async close(): Promise<void> {
    await Promise.all([
      this.vectorStore.close(),
      this.graphStore.close()
    ]);
    console.log('✅ Indexing service closed');
  }
}

/**
 * Factory function to create indexing service
 */
export function createIndexingService(
  vectorStore: VectorStorePort,
  graphStore: GraphStorePort,
  embeddingService: EmbeddingService
): IndexingService {
  return new IndexingService(vectorStore, graphStore, embeddingService);
}
