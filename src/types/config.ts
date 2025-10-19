/**
 * @fileoverview Configuration types for Cappy indexing system
 * @module types/config
 * @author Cappy Team
 * @since 3.0.0
 */

/**
 * Chunking strategies
 */
export type ChunkingStrategy = 'ast' | 'hybrid' | 'sliding_window';

/**
 * TypeScript/JavaScript chunking configuration
 */
export interface TypeScriptChunkingConfig {
  strategy: 'ast';
  extractJSDoc: boolean;
  extractCode: boolean;
}

/**
 * Markdown chunking configuration
 */
export interface MarkdownChunkingConfig {
  strategy: 'hybrid';
  maxTokens: number;
  overlapTokens: number;
  respectHeaders: boolean;
}

/**
 * Chunking configuration for all file types
 */
export interface ChunkingConfig {
  typescript: TypeScriptChunkingConfig;
  markdown: MarkdownChunkingConfig;
}

/**
 * LLM provider types
 */
export type LLMProvider = 'copilot' | 'openai' | 'anthropic';

/**
 * LLM configuration
 */
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  enabledFor: {
    typescript: boolean;
    javascript: boolean;
    markdown: boolean;
  };
  batchSize: number;
  maxTokensPerRequest: number;
}

/**
 * Embeddings configuration
 */
export interface EmbeddingsConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

/**
 * Graph database configuration (SQLite)
 */
export interface GraphDatabaseConfig {
  path: string;
  bufferPoolSize: string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  graph: GraphDatabaseConfig;  // SQLite graph store
}

/**
 * Indexing configuration
 */
export interface IndexingConfig {
  enabledFileTypes: string[];
  chunking: ChunkingConfig;
  llm: LLMConfig;
}

/**
 * Complete Cappy configuration
 */
export interface CappyConfig {
  indexing: IndexingConfig;
  embeddings: EmbeddingsConfig;
  databases: DatabaseConfig;
}
