/**
 * @fileoverview Indexing service that coordinates vector and graph stores
 * @module services/indexing-service
 * @author Cappy Team
 * @since 3.0.0
 */

import type { VectorStorePort, GraphStorePort } from '../../../domains/dashboard/ports/indexing-port';
import type { DocumentChunk } from '../../../shared/types/chunk';
import type { EmbeddingService } from './embedding-service';
import type { LLMProvider } from './entity-discovery/providers/LLMProvider';
import { EntityDiscoveryService } from './entity-discovery/core/EntityDiscoveryService';
import { EntityResolutionService } from './entity-discovery/core/entity-resolution-service';

/**
 * Indexing service coordinating vector embeddings and graph storage
 */
export class IndexingService {
  private readonly vectorStore: VectorStorePort | null;
  private readonly graphStore: GraphStorePort;
  private readonly embeddingService: EmbeddingService;
  private readonly workspaceRoot: string;
  private readonly entityDiscovery: EntityDiscoveryService;
  private readonly entityResolver: EntityResolutionService;

  constructor(
    vectorStore: VectorStorePort | null, 
    graphStore: GraphStorePort,
    embeddingService: EmbeddingService,
    workspaceRoot: string,
    llmProvider?: LLMProvider
  ) {
    this.vectorStore = vectorStore;
    this.graphStore = graphStore;
    this.embeddingService = embeddingService;
    this.workspaceRoot = workspaceRoot;
    this.entityDiscovery = new EntityDiscoveryService(llmProvider);
    this.entityResolver = new EntityResolutionService(graphStore);
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

      // 1. Generate embeddings for all chunks (if available)
      try {
        console.log(`🤖 Generating embeddings for ${chunks.length} chunks...`);
        const embeddings = await this.embeddingService.embedBatch(
          chunks.map(c => c.content),
          32
        );

        // Attach embeddings to chunks
        chunks.forEach((chunk, i) => {
          chunk.vector = embeddings[i];
        });
      } catch (error) {
        console.warn(`⚠️ Failed to generate embeddings for ${filePath}, continuing without vector search:`, error);
        // Continue without embeddings - chunks won't have vectors but graph will still work
      }

      // 2. Create file node in graph FIRST (before chunks, before vector store)
      // This ensures the file exists in the graph immediately, allowing other files
      // being processed to find it and create relationships incrementally
      const linesOfCode = Math.max(...chunks.map(c => c.metadata.lineEnd));
      await this.graphStore.createFileNode(filePath, language, linesOfCode);

      // 3. Create chunk nodes in graph (without content)
      await this.graphStore.createChunkNodes(chunks);

      // 4. Discover and resolve entities for relevant chunks
      await this.discoverAndResolveEntities(language, chunks);

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

      // 7. Build cross-file relationships incrementally with existing files in graph
      await this.buildFileRelationshipsIncremental(filePath, chunks);

      // 8. Insert chunks into vector store (after all graph operations)
      if (this.vectorStore) {
        await this.vectorStore.upsertChunks(chunks);
      } else {
        console.warn('⚠️ Vector store is disabled; skipping upsertChunks');
      }

      console.log(`✅ Indexed ${filePath} successfully`);
    } catch (error) {
      console.error(`❌ Error indexing ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Builds cross-file relationships incrementally with files already in the graph
   * This is called during indexFile() to create relationships as files are processed,
   * not in a separate batch phase
   */
  private async buildFileRelationshipsIncremental(
    filePath: string, 
    chunks: DocumentChunk[]
  ): Promise<void> {
    try {
      const { ASTRelationshipExtractor } = await import('./ast-relationship-extractor.js');
      const extractor = new ASTRelationshipExtractor(this.workspaceRoot);
      // Analyze using absolute path to avoid relying on extension host CWD
      const pathMod = await import('path');
      const absPath = pathMod.isAbsolute(filePath)
        ? filePath
        : pathMod.join(this.workspaceRoot, filePath);
      const analysis = await extractor.analyze(absPath);
      
      if (analysis.imports.length === 0) {
        return; // No imports to process
      }

      // Get all files already indexed in the graph
      const existingFiles = await this.graphStore.listAllFiles();
      const existingFilePaths = new Set(existingFiles.map(f => f.path));

      const rels: Array<{
        from: string;
        to: string;
        type: string;
        properties?: Record<string, string | number | boolean | string[]>;
      }> = [];

      console.log(`🔗 [INCREMENTAL] Processing ${analysis.imports.length} imports for ${filePath}`);
      console.log(`🔗 [INCREMENTAL] Found ${existingFilePaths.size} existing files in graph`);

      for (const im of analysis.imports) {
        // Skip external dependencies
        if (im.isExternal || !im.source.startsWith('.')) {
          continue;
        }

        // Resolve import path to absolute file path
        const targetPath = await this.resolveImportPath(im.source, filePath);
        
        if (!targetPath) {
          continue;
        }

        // Check if target file EXISTS in graph (already indexed)
        if (existingFilePaths.has(targetPath)) {
          console.log(`   ✅ Found existing file in graph: ${targetPath}`);
          
          // Create File -> File IMPORTS relationship
          rels.push({
            from: filePath,
            to: targetPath,
            type: 'IMPORTS',
            properties: {
              source: im.source,
              specifiers: im.specifiers
            }
          });

          // Create Chunk -> File REFERENCES relationships
          for (const chunk of chunks) {
            rels.push({
              from: chunk.id,
              to: targetPath,
              type: 'REFERENCES',
              properties: {
                referenceType: 'import',
                source: im.source
              }
            });
          }
        } else {
          console.log(`   ⏭️  Target not yet indexed: ${targetPath} (will connect when processed)`);
        }
      }

      if (rels.length > 0) {
        await this.graphStore.createRelationships(rels);
        console.log(`✅ [INCREMENTAL] Created ${rels.length} cross-file relationships for ${filePath}`);
      } else {
        console.log(`   ℹ️  No cross-file relationships created (targets not yet indexed)`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to build incremental relationships for ${filePath}:`, error);
      // Don't throw - this is best-effort
    }
  }

  /**
   * Resolves an import path to an absolute file path
   */
  private async resolveImportPath(importSource: string, fromFile: string): Promise<string | null> {
    try {
      const pathMod = await import('path');
      const dirname = pathMod.dirname(fromFile);
      // Keep paths relative to workspace to match graph store paths
      const resolved = pathMod.normalize(pathMod.join(dirname, importSource));
      
      // Try common extensions
      const candidates = [
        resolved,
        resolved + '.ts',
        resolved + '.tsx',
        resolved + '.js',
        resolved + '.jsx',
        resolved + '/index.ts',
        resolved + '/index.tsx',
        resolved + '/index.js',
        resolved + '/index.jsx'
      ];
      
      // Check which candidate exists in the graph
      const existingFiles = await this.graphStore.listAllFiles();
      const existingPaths = new Set(existingFiles.map(f => f.path));
      
      for (const candidate of candidates) {
        if (existingPaths.has(candidate)) {
          return candidate;
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to resolve import path "${importSource}":`, error);
      return null;
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

  /**
   * Discovers and resolves entities from chunks incrementally
   */
  private async discoverAndResolveEntities(
    language: string,
    chunks: DocumentChunk[]
  ): Promise<void> {
    for (const chunk of chunks) {
      if (!this.shouldDiscoverEntities(language, chunk)) {
        continue;
      }

      try {
        console.log(`🔍 Discovering entities in chunk: ${chunk.id}`);
        
        const discovery = await this.entityDiscovery.discoverEntities(chunk.content, {
          allowNewTypes: true,
          confidenceThreshold: 0.7,
          maxEntities: 20,
          includeRelationships: true
        });

        if (discovery.entities.length === 0) {
          continue;
        }

        console.log(`   📊 Discovered ${discovery.entities.length} entities, ${discovery.relationships.length} relationships`);

        for (const entity of discovery.entities) {
          const entityId = await this.entityResolver.resolveOrCreateEntity(entity);
          await this.graphStore.linkChunkToEntity(chunk.id, entityId);
        }

        for (const rel of discovery.relationships) {
          await this.entityResolver.createRelationshipIfValid(rel);
        }

        console.log(`   ✅ Resolved and linked entities for chunk ${chunk.id}`);
      } catch (error) {
        console.warn(`   ⚠️ Entity discovery failed for chunk ${chunk.id}:`, error);
      }
    }
  }

  /**
   * Determines if a chunk should have entities discovered
   */
  private shouldDiscoverEntities(language: string, chunk: DocumentChunk): boolean {
    return (
      chunk.metadata.chunkType === 'jsdoc' ||
      chunk.metadata.chunkType === 'markdown_section' ||
      chunk.metadata.chunkType === 'document_section' ||
      language === 'markdown' ||
      language === 'mdx'
    );
  }
}

/**
 * Factory function to create indexing service
 */
export function createIndexingService(
  vectorStore: VectorStorePort,
  graphStore: GraphStorePort,
  embeddingService: EmbeddingService,
  workspaceRoot: string,
  llmProvider?: LLMProvider
): IndexingService {
  return new IndexingService(vectorStore, graphStore, embeddingService, workspaceRoot, llmProvider);
}
