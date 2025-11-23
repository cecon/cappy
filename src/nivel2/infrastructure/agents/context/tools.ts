/**
 * @fileoverview Context Tools - Tools for gathering and managing context
 * @module agents/context/tools
 */

/**
 * Tool for searching code in workspace
 */
export interface CodeSearchTool {
  name: 'code_search';
  description: 'Search for code patterns in workspace';
  execute: (query: string) => Promise<string[]>;
}

/**
 * Tool for reading documentation
 */
export interface DocumentationTool {
  name: 'read_docs';
  description: 'Read and extract information from documentation';
  execute: (path: string) => Promise<string>;
}

/**
 * Tool for analyzing file structure
 */
export interface StructureAnalysisTool {
  name: 'analyze_structure';
  description: 'Analyze project structure and dependencies';
  execute: () => Promise<{
    files: string[];
    directories: string[];
    dependencies: Record<string, string[]>;
  }>;
}

/**
 * All available context tools
 */
export type ContextTool = CodeSearchTool | DocumentationTool | StructureAnalysisTool;
