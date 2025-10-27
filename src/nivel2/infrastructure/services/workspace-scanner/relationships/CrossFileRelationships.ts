/**
 * @fileoverview Cross-file relationships module for workspace scanner
 * @module workspace-scanner/relationships
 */

import * as path from 'path';
import { ASTEntityExtractor } from '../../entity-extraction/core/ASTEntityExtractor';
import type { FileIndexEntry } from '../../../../../shared/types/chunk';
import type { CrossFileRelationship, WorkspaceScannerConfig } from '../types';

/**
 * Cross-file relationships configuration
 */
export interface CrossFileRelationshipsConfig {
  workspaceRoot: string;
  config: WorkspaceScannerConfig;
}

/**
 * Handles cross-file relationship building
 */
export class CrossFileRelationships {
  private readonly workspaceRoot: string;
  private readonly config: WorkspaceScannerConfig;
  private readonly entityExtractor: ASTEntityExtractor;

  constructor(config: CrossFileRelationshipsConfig) {
    this.workspaceRoot = config.workspaceRoot;
    this.config = config.config;
    this.entityExtractor = new ASTEntityExtractor(config.workspaceRoot);
  }

  /**
   * Builds cross-file relationships (imports, references, etc.)
   */
  async buildCrossFileRelationships(fileIndex: Map<string, FileIndexEntry>): Promise<void> {
    console.log('🔗 Building cross-file relationships...');
    
    const crossFileRels: CrossFileRelationship[] = [];

    // Get all indexed files
    const allFiles = Array.from(fileIndex.values());
    console.log(`📂 Analyzing ${allFiles.length} files for cross-file relationships...`);

    // Build a map of exported symbols to files
    const exportedSymbols = new Map<string, string[]>(); // symbol -> [file paths]

    let analyzedFiles = 0;
    let filesWithImports = 0;
    let filesWithExports = 0;

    for (const file of allFiles) {
      const fullPath = path.join(this.workspaceRoot, file.relPath);
      
      // Only analyze supported files
      if (!this.config.parserService.isSupported(fullPath)) {
        continue;
      }

      try {
        analyzedFiles++;
        
        // Analyze the file for imports/exports using entity extractor
        const astEntities = await this.entityExtractor.extractFromFile(fullPath);
        
        // Count exports
        const exports = astEntities.filter(e => e.isExported);
        if (exports.length > 0) {
          filesWithExports++;
          for (const entity of exports) {
            if (!exportedSymbols.has(entity.name)) {
              exportedSymbols.set(entity.name, []);
            }
            exportedSymbols.get(entity.name)!.push(file.relPath);
          }
        }

        // Count imports
        const imports = astEntities.filter(e => e.kind === 'import');
        if (imports.length > 0) {
          filesWithImports++;
          console.log(`  📥 ${file.relPath}: ${imports.length} imports, ${exports.length} exports`);
          
          for (const imp of imports) {
            const impSource = imp.originalModule || imp.source;
            const isExternal = imp.category === 'external' || imp.category === 'builtin';
            
            if (!isExternal && impSource) {
              // Internal import - try to resolve to a file
              const resolvedPath = await this.resolveImportPath(impSource, file.relPath, fileIndex);
              
              if (resolvedPath) {
                console.log(`    ✅ Resolved import "${impSource}" -> ${resolvedPath}`);
                
                // Create File -> File relationship for import
                crossFileRels.push({
                  from: file.relPath,
                  to: resolvedPath,
                  type: 'IMPORTS',
                  properties: {
                    source: impSource,
                    specifiers: [imp.name]
                  }
                });

                // Create Chunk -> Chunk relationships for imported symbols
                const sourceChunks = await this.config.graphStore.getFileChunks(file.relPath);
                const targetChunks = await this.config.graphStore.getFileChunks(resolvedPath);

                console.log(`    🔍 Source chunks: ${sourceChunks.length}, Target chunks: ${targetChunks.length}`);

                // Find target chunk that exports this symbol
                const targetChunk = targetChunks.find(c => 
                  c.label.includes(imp.name) || c.id.includes(imp.name)
                );

                if (targetChunk) {
                  console.log(`      ✅ Found target chunk for symbol "${imp.name}": ${targetChunk.id}`);
                  
                  // Connect all source chunks to this target chunk
                  for (const sourceChunk of sourceChunks) {
                    crossFileRels.push({
                      from: sourceChunk.id,
                      to: targetChunk.id,
                      type: 'IMPORTS_SYMBOL',
                      properties: {
                        symbol: imp.name,
                        sourceFile: file.relPath,
                        targetFile: resolvedPath
                      }
                    });
                  }
                } else {
                  console.log(`      ⚠️ No chunk found for symbol "${imp.name}" in ${resolvedPath}`);
                }
              } else {
                console.log(`    ❌ Could not resolve import "${impSource}" from ${file.relPath}`);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to analyze ${file.relPath} for cross-file relationships:`, error);
      }
    }

    console.log(`📊 Analysis summary:`);
    console.log(`   - Files analyzed: ${analyzedFiles}`);
    console.log(`   - Files with imports: ${filesWithImports}`);
    console.log(`   - Files with exports: ${filesWithExports}`);
    console.log(`   - Exported symbols: ${exportedSymbols.size}`);

    // Save all cross-file relationships
    if (crossFileRels.length > 0) {
      console.log(`💾 Saving ${crossFileRels.length} cross-file relationships...`);
      await this.config.graphStore.createRelationships(crossFileRels);
      console.log(`✅ Cross-file relationships created`);
    } else {
      console.log(`⚠️ No cross-file relationships found`);
    }
  }

  /**
   * Resolves an import path to an actual file path
   */
  async resolveImportPath(
    importSource: string,
    fromFile: string,
    fileIndex: Map<string, FileIndexEntry>
  ): Promise<string | null> {
    // Handle relative imports
    if (importSource.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.normalize(path.join(fromDir, importSource));
      
      // Try common extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
      for (const ext of extensions) {
        const candidate = resolved + ext;
        if (fileIndex.has(candidate)) {
          return candidate;
        }
      }
    }
    
    // Handle absolute imports from workspace root
    if (importSource.startsWith('@/') || importSource.startsWith('~/')) {
      const resolved = importSource.replace(/^[@~]\//, '');
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
      for (const ext of extensions) {
        const candidate = resolved + ext;
        if (fileIndex.has(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }
}
