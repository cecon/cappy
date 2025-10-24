/**
 * CAPPY Configuration Types
 * Merged from types/config.ts and shared/types/config.ts
 */

// ============= UI/General Config Types =============

export interface CappyConfig {
  version: string;
  created: string;
  workspace: string;
  features: CappyFeatures;
  indexing: UserIndexingConfig;
  ai: AIConfig;
}

export interface CappyFeatures {
  telemetry: boolean;
  autoIndex: boolean;
  semanticSearch: boolean;
  graphDatabase: boolean;
}

export interface UserIndexingConfig {
  includePaths: string[];
  excludePaths: string[];
  maxFileSize?: number;
  autoIndexOnSave?: boolean;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  model: string;
  embeddingModel: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface PreventionRule {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  pattern: string;
  solution: string;
  enabled: boolean;
}

// ============= Backend/System Config Types =============

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
 * System-level indexing configuration
 */
export interface SystemIndexingConfig {
  enabledFileTypes: string[];
  chunking: ChunkingConfig;
  llm: LLMConfig;
}

/**
 * Complete system configuration
 */
export interface SystemCappyConfig {
  indexing: SystemIndexingConfig;
  embeddings: EmbeddingsConfig;
  databases: DatabaseConfig;
}
