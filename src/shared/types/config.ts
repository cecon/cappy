/**
 * CAPPY Configuration Types
 */

export interface CappyConfig {
  version: string;
  created: string;
  workspace: string;
  features: CappyFeatures;
  indexing: IndexingConfig;
  ai: AIConfig;
}

export interface CappyFeatures {
  telemetry: boolean;
  autoIndex: boolean;
  semanticSearch: boolean;
  graphDatabase: boolean;
}

export interface IndexingConfig {
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
