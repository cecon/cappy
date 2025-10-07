import * as vscode from "vscode";
import { getCappyRAGLanceDatabase, CappyRAGChunk } from "../store/cappyragLanceDb";
import { pipeline } from "@xenova/transformers";

/**
 * MCP Tool for querying CappyRAG knowledge base
 * Supports both semantic (vector) and text-based search
 */
export class QueryTool {
  private context: vscode.ExtensionContext;
  private embeddingModel: any = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initialize embedding model for semantic search
   */
  private async initializeEmbedding(): Promise<void> {
    if (!this.embeddingModel) {
      try {
        this.embeddingModel = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2'
        );
      } catch (error) {
        console.error('Failed to initialize embedding model:', error);
        throw new Error('Embedding model initialization failed');
      }
    }
  }

  /**
   * Generate embedding vector for query
   */
  private async generateQueryVector(query: string): Promise<number[]> {
    await this.initializeEmbedding();
    
    const output = await this.embeddingModel(query, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data);
  }

  /**
   * Query the CappyRAG knowledge base
   * @param query - Search query string
   * @param maxResults - Maximum number of results to return (default: 5)
   * @param searchType - Type of search: 'semantic' | 'text' | 'hybrid' (default: 'hybrid')
   * @returns Query results with chunks, documents, and entities
   */
  async query(
    query: string,
    maxResults: number = 5,
    searchType: 'semantic' | 'text' | 'hybrid' = 'hybrid'
  ): Promise<QueryResult> {
    try {
      const startTime = Date.now();

      // Get workspace path
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const db = getCappyRAGLanceDatabase(workspaceFolder.uri.fsPath);

      let chunks: CappyRAGChunk[] = [];

      // Perform search based on type
      if (searchType === 'semantic' || searchType === 'hybrid') {
        // Generate query vector for semantic search
        const queryVector = await this.generateQueryVector(query);
        chunks = await db.searchChunks(queryVector, maxResults);
      }

      if (searchType === 'text' || (searchType === 'hybrid' && chunks.length === 0)) {
        // Text-based search as fallback
        const allChunks = await db.getChunks();
        const lowerQuery = query.toLowerCase();
        chunks = allChunks
          .filter(chunk => chunk.content.toLowerCase().includes(lowerQuery))
          .slice(0, maxResults);
      }

      // Get related documents
      const documentIds = [...new Set(chunks.map(c => c.documentId))];
      const allDocuments = await db.getDocuments();
      const documents = allDocuments.filter(doc => documentIds.includes(doc.id));

      // Get related entities
      const entityIds = [...new Set(chunks.flatMap(c => c.entities || []))];
      const allEntities = await db.getEntities();
      const entities = allEntities.filter(entity => entityIds.includes(entity.id));

      const endTime = Date.now();

      return {
        success: true,
        query,
        searchType,
        results: {
          chunks: chunks.map(chunk => ({
            id: chunk.id,
            content: chunk.content,
            documentId: chunk.documentId,
            chunkIndex: chunk.chunkIndex,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            relevance: this.calculateRelevance(query, chunk.content),
          })),
          documents: documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            filePath: doc.filePath,
            tags: doc.tags,
          })),
          entities: entities.map(entity => ({
            id: entity.id,
            name: entity.name,
            type: entity.type,
            description: entity.description,
          })),
        },
        metadata: {
          totalResults: chunks.length,
          documentsFound: documents.length,
          entitiesFound: entities.length,
          searchTimeMs: endTime - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        query,
        searchType,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        results: {
          chunks: [],
          documents: [],
          entities: [],
        },
        metadata: {
          totalResults: 0,
          documentsFound: 0,
          entitiesFound: 0,
          searchTimeMs: 0,
        },
      };
    }
  }

  /**
   * Calculate simple text relevance score
   */
  private calculateRelevance(query: string, content: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerContent = content.toLowerCase();
    
    // Simple word overlap scoring
    const queryWords = lowerQuery.split(/\s+/);
    const matchedWords = queryWords.filter(word => lowerContent.includes(word));
    
    return matchedWords.length / queryWords.length;
  }
}

/**
 * Query result interface
 */
export interface QueryResult {
  success: boolean;
  query: string;
  searchType: 'semantic' | 'text' | 'hybrid';
  results: {
    chunks: Array<{
      id: string;
      content: string;
      documentId: string;
      chunkIndex: number;
      startLine?: number;
      endLine?: number;
      relevance: number;
    }>;
    documents: Array<{
      id: string;
      title: string;
      description: string;
      filePath: string;
      tags: string[];
    }>;
    entities: Array<{
      id: string;
      name: string;
      type: string;
      description: string;
    }>;
  };
  metadata: {
    totalResults: number;
    documentsFound: number;
    entitiesFound: number;
    searchTimeMs: number;
  };
  error?: string;
}
