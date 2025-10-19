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
 * Indexing service coordinating vector embeddings and graph storage
 */
export class IndexingService {
  private readonly vectorStore: VectorStorePort | null;
  private readonly graphStore: GraphStorePort;
  private readonly embeddingService: EmbeddingService;

  constructor(
    vectorStore: VectorStorePort | null, 
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
    if (this.vectorStore) {
      await this.vectorStore.initialize();
    }
    await this.graphStore.initialize();
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

      // 2. Insert chunks into vector store if available
      if (this.vectorStore) {
        await this.vectorStore.upsertChunks(chunks);
      } else {
        console.warn('⚠️ Vector store is disabled; skipping upsertChunks');
      }

      // 3. Create file node in graph
      const linesOfCode = Math.max(...chunks.map(c => c.metadata.lineEnd));
      await this.graphStore.createFileNode(filePath, language, linesOfCode);

      // 4. Create chunk nodes in graph (without content)
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

      // 7. Create cross-file REFERENCES using imports -> exported symbols from other files (best-effort)
      try {
        const { ASTRelationshipExtractor } = await import('./ast-relationship-extractor.js');
        const extractor = new ASTRelationshipExtractor();
        const analysis = await extractor.analyze(filePath);
        if (analysis.imports.length > 0) {
          // Build a list of candidate files (all file nodes in DB)
          const files = await this.graphStore.listAllFiles();
          const rels: Array<{ from: string; to: string; type: string; properties?: Record<string, string|number|boolean> }> = [];
          const currentFileChunkIds = new Set(chunks.map(c => c.id));

          for (const im of analysis.imports) {
            // Resolve relative path imports to absolute file nodes when possible
            let targetPath: string | null = null;
            if (im.source.startsWith('.')) {
              // Resolve relative to current file
              const pathMod = await import('path');
              const resolved = pathMod.resolve((await import('path')).dirname(filePath), im.source);
              // Try adding common extensions
              const candidates = [resolved, resolved + '.ts', resolved + '.tsx', resolved + '.js', resolved + '.jsx', resolved + '/index.ts', resolved + '/index.tsx'];
              for (const c of candidates) {
                const match = files.find(f => f.path === c);
                if (match) { targetPath = match.path; break; }
              }
            } else {
              // Bare module specifier: skip (external deps)
            }

            if (!targetPath) continue;

            // Reference from every chunk in current file to the target file node
            for (const chunk of chunks) {
              if (!currentFileChunkIds.has(chunk.id)) continue;
              rels.push({
                from: chunk.id,
                to: targetPath,
                type: 'REFERENCES',
                properties: { referenceType: 'import', source: im.source }
              });
            }
          }

          if (rels.length > 0) {
            await this.graphStore.createRelationships(rels);
            console.log(`✅ Created ${rels.length} cross-file REFERENCES (imports)`);
          }
        }
      } catch (e) {
        console.warn('Cross-file relationship build failed:', e);
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

      // 1. Vector search in vector store
  const directMatches = this.vectorStore ? await this.vectorStore.search(query, 10) : [];
      console.log(`   📊 Found ${directMatches.length} direct matches`);

      // 2. Graph traversal to find related chunks
      const chunkIds = directMatches.map(c => c.id);
      const relatedIds = chunkIds.length > 0 
        ? await this.graphStore.getRelatedChunks(chunkIds, depth)
        : [];
      console.log(`   🕸️ Found ${relatedIds.length} related chunks via graph`);

      // 3. Fetch related chunks from vector store
      const relatedChunks = (relatedIds.length > 0 && this.vectorStore)
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
      if (this.vectorStore) {
        await this.vectorStore.deleteChunksByFile(filePath);
      }
      await this.graphStore.deleteFileNodes(filePath);
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
    if (this.vectorStore) {
      await this.vectorStore.close();
    }
    await this.graphStore.close();
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
