/**
 * @fileoverview File sorter helper
 * @module workspace-scanner/helpers
 */

import * as path from 'path';
import type { FileIndexEntry } from '../../../../../shared/types/chunk';
import type { SortedFiles } from '../types';

/**
 * Sorts files by type and priority
 */
export class FileSorter {
  /**
   * Sorts files by type: source code first, then documentation
   */
  sortFilesByType(files: FileIndexEntry[]): SortedFiles {
    const sourceFiles: FileIndexEntry[] = [];
    const docFiles: FileIndexEntry[] = [];

    // Extensions that use AST parsing (no LLM required)
    const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.php', '.html']);
    
    // Documentation extensions that may use LLM
    const docExtensions = new Set(['.md', '.mdx', '.pdf', '.doc', '.docx']);
    
    const viteConfigRegex = /^vite\.config\.(js|ts|mjs|cjs)$/;

    for (const file of files) {
      const ext = path.extname(file.relPath);
      const fileName = path.basename(file.relPath);
      
      // Check for Blade templates (treated as source)
      if (file.relPath.endsWith('.blade.php')) {
        sourceFiles.push(file);
        continue;
      }
      
      // Check for Vite config (treated as source)
      if (viteConfigRegex.exec(fileName)) {
        sourceFiles.push(file);
        continue;
      }
      
      if (sourceExtensions.has(ext)) {
        sourceFiles.push(file);
      } else if (docExtensions.has(ext)) {
        docFiles.push(file);
      } else {
        // Other files go to source category
        sourceFiles.push(file);
      }
    }

    return { sourceFiles, docFiles };
  }
}
