/**
 * @fileoverview Configuration service for loading and managing Cappy settings
 * @module services/config-service
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { CappyConfig, TypeScriptChunkingConfig, MarkdownChunkingConfig } from '../types/config';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CappyConfig = {
  indexing: {
    enabledFileTypes: ['.ts', '.tsx', '.js', '.jsx', '.md'],
    chunking: {
      typescript: {
        strategy: 'ast',
        extractJSDoc: true,
        extractCode: false
      },
      markdown: {
        strategy: 'hybrid',
        maxTokens: 512,
        overlapTokens: 100,
        respectHeaders: true
      }
    },
    llm: {
      provider: 'copilot',
      model: 'gpt-4o-mini',
      enabledFor: {
        typescript: false,
        javascript: false,
        markdown: true
      },
      batchSize: 5,
      maxTokensPerRequest: 2000
    }
  },
  embeddings: {
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    batchSize: 32
  },
  databases: {
    lancedb: {
      path: '.cappy/data/lancedb',
      autoCompact: true
    },
    kuzu: {
      path: '.cappy/data/kuzu',
      bufferPoolSize: '256MB'
    }
  }
};

/**
 * Configuration service
 */
export class ConfigService {
  private config: CappyConfig;
  private configPath: string;

  constructor(workspaceRoot: string) {
    this.configPath = path.join(workspaceRoot, '.cappy', 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * Loads configuration from file or returns default
   */
  private loadConfig(): CappyConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content) as Partial<CappyConfig>;
        // Merge with defaults to ensure all fields exist
        return { ...DEFAULT_CONFIG, ...loaded };
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    return DEFAULT_CONFIG;
  }

  /**
   * Gets the current configuration
   */
  getConfig(): CappyConfig {
    return this.config;
  }

  /**
   * Gets the absolute path for LanceDB
   */
  getLanceDBPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, this.config.databases.lancedb.path);
  }

  /**
   * Gets the absolute path for Kuzu
   */
  getKuzuPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, this.config.databases.kuzu.path);
  }

  /**
   * Checks if a file type should be indexed
   */
  shouldIndexFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return this.config.indexing.enabledFileTypes.includes(ext);
  }

  /**
   * Gets chunking config for a file type
   */
  getChunkingConfig(filePath: string): TypeScriptChunkingConfig | MarkdownChunkingConfig | null {
    const ext = path.extname(filePath);
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      return this.config.indexing.chunking.typescript;
    }
    if (ext === '.md') {
      return this.config.indexing.chunking.markdown;
    }
    return null;
  }

  /**
   * Checks if LLM should be used for a file type
   */
  shouldUseLLM(filePath: string): boolean {
    const ext = path.extname(filePath);
    if (['.ts', '.tsx'].includes(ext)) {
      return this.config.indexing.llm.enabledFor.typescript;
    }
    if (['.js', '.jsx'].includes(ext)) {
      return this.config.indexing.llm.enabledFor.javascript;
    }
    if (ext === '.md') {
      return this.config.indexing.llm.enabledFor.markdown;
    }
    return false;
  }
}

/**
 * Creates a new ConfigService instance
 */
export function createConfigService(_context: vscode.ExtensionContext): ConfigService {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    throw new Error('No workspace folder found');
  }
  return new ConfigService(workspaceRoot);
}
