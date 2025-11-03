/**
 * Import information with support for dynamic imports
 */
export interface ImportInfo {
  source: string;
  isExternal: boolean;
  isDynamic?: boolean;
  method?: 'import' | 'require';
}

/**
 * Context for entity extraction shared across extractors
 */
export interface ExtractionContext {
  /** Absolute file path */
  filePath: string;

  /** Relative file path from workspace root */
  relFilePath: string;

  /** Set of exported entity names */
  exportedNames: Set<string>;

  /** Map of imported symbols to their source module */
  importedSymbols: Map<string, ImportInfo>;

  /** File content */
  content: string;

  /** Current scope (for nested analysis) */
  currentScope?: string;
}
