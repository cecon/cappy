/**
 * @fileoverview AST-based relationship extraction service
 * @module services/ast-relationship-extractor
 * @author Cappy Team
 * @since 3.0.0
 * 
 * This service extracts relationships between code entities using AST analysis.
 * It now uses ASTEntityExtractor + EntityFilterPipeline for comprehensive code analysis.
 * 
 * @see ASTEntityExtractor - For entity extraction
 * @see EntityFilterPipeline - For entity filtering
 * @see ASTEntityAdapter - For type conversion
 * @see ExternalPackageResolver - For package dependency resolution
 */

import type { DocumentChunk, GraphRelationship } from '../../../shared/types/chunk';
import { ExternalPackageResolver, type PackageResolution } from './external-package-resolver';
import { ASTEntityExtractor } from './entity-extraction/core/ASTEntityExtractor';
import { ASTEntityAdapter } from './entity-conversion/ASTEntityAdapter';
import * as path from 'path';

/**
 * Extended import info with external package resolution
 */
export interface ImportInfo {
  source: string;
  specifiers: string[];
  isExternal: boolean;
  packageResolution?: PackageResolution;
}

/**
 * Service for extracting relationships from AST
 * Now delegates entity extraction to ASTEntityExtractor
 */
export class ASTRelationshipExtractor {
  private readonly packageResolver: ExternalPackageResolver;
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.packageResolver = new ExternalPackageResolver(workspaceRoot);
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Analyzes a file and returns import/export/call/type reference info
   * Now uses ASTEntityExtractor + ASTEntityAdapter for extraction
   */
  async analyze(filePath: string): Promise<{
    imports: ImportInfo[];
    exports: string[];
    calls: string[];
    typeRefs: string[];
  }> {
    const absFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);
    
    // Use ASTEntityExtractor for entity extraction
    const extractor = new ASTEntityExtractor(this.workspaceRoot);
    const astEntities = await extractor.extractFromFile(absFilePath);
    
    // Convert to analysis format
    const analysis = ASTEntityAdapter.toAnalysisFormat(astEntities);
    
    // Resolve package info for external imports
    const importsWithResolution: ImportInfo[] = [];
    for (const imp of analysis.imports) {
      const importInfo: ImportInfo = { ...imp };
      if (imp.isExternal) {
        try {
          importInfo.packageResolution = await this.packageResolver.resolveExternalImport(imp.source, absFilePath);
        } catch (error) {
          console.warn(`⚠️ Failed to resolve package ${imp.source}:`, error);
        }
      }
      importsWithResolution.push(importInfo);
    }
    
    return {
      imports: importsWithResolution,
      exports: analysis.exports,
      calls: analysis.calls,
      typeRefs: analysis.typeRefs
    };
  }
  /**
   * Extracts relationships from a file's AST
   * Now uses analyze() which leverages ASTEntityExtractor
   */
  async extract(
    filePath: string,
    chunks: DocumentChunk[]
  ): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    try {
      const absFilePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.workspaceRoot, filePath);

      // Use analyze() which now uses ASTEntityExtractor
      const { imports, exports, calls, typeRefs } = await this.analyze(absFilePath);

      // Log summary
      const externalCount = imports.filter(i => i.isExternal).length;
      const internalCount = imports.length - externalCount;
      console.log(`📊 Found ${imports.length} imports (${externalCount} external, ${internalCount} internal), ${exports.length} exports, ${calls.length} calls, ${typeRefs.length} type refs`);
      
      // Create a map of symbol names to chunk IDs for quick lookup
      const symbolToChunkId = new Map<string, string>();
      for (const chunk of chunks) {
        if (chunk.metadata.symbolName) {
          symbolToChunkId.set(chunk.metadata.symbolName, chunk.id);
        }
      }

      // Create IMPORTS_PKG relationships for external packages
      for (const imp of imports) {
        if (imp.isExternal && imp.packageResolution) {
          const res = imp.packageResolution;
          const pkgId = `pkg:${res.name}@${res.resolved ?? res.range ?? 'unknown'}`;
          
          relationships.push({
            from: filePath, // Use file path as source
            to: pkgId, // Package node ID
            type: 'IMPORTS_PKG',
            properties: {
              specifier: imp.source,
              subpath: res.subpath,
              range: res.range,
              resolved: res.resolved,
              manager: res.manager,
              lockfile: res.lockfile,
              integrity: res.integrity,
              workspace: res.workspace,
              commit: res.commit,
              url: res.url,
              source: res.source,
              confidence: res.confidence,
              specifiers: imp.specifiers
            }
          });
        }
      }

      // Create REFERENCES relationships for function calls
      // Map calls to chunks that define those functions
      for (const call of calls) {
        const targetChunkId = symbolToChunkId.get(call);
        if (targetChunkId) {
          // Find chunks that might contain this call
          for (const chunk of chunks) {
            if (chunk.metadata.chunkType === 'code' || chunk.metadata.chunkType === 'jsdoc') {
              relationships.push({
                from: chunk.id,
                to: targetChunkId,
                type: 'REFERENCES',
                properties: {
                  referenceType: 'function_call',
                  symbolName: call
                }
              });
            }
          }
        }
      }

      // Create REFERENCES relationships for type references
      for (const typeRef of typeRefs) {
        const targetChunkId = symbolToChunkId.get(typeRef);
        if (targetChunkId) {
          for (const chunk of chunks) {
            if (chunk.metadata.chunkType === 'code' || chunk.metadata.chunkType === 'jsdoc') {
              relationships.push({
                from: chunk.id,
                to: targetChunkId,
                type: 'REFERENCES',
                properties: {
                  referenceType: 'type_reference',
                  symbolName: typeRef
                }
              });
            }
          }
        }
      }

      // Log internal imports for cross-file relationships (Phase 2)
      const internalImports = imports.filter(i => !i.isExternal);
      if (internalImports.length > 0) {
        console.log(`  📥 Internal imports: ${internalImports.map(i => i.source).join(', ')}`);
      }
      if (exports.length > 0) {
        console.log(`  📤 Exports: ${exports.join(', ')}`);
      }

      const pkgRelCount = relationships.filter(r => r.type === 'IMPORTS_PKG').length;
      const otherRelCount = relationships.length - pkgRelCount;
      console.log(`  🔗 Created ${relationships.length} relationships (${pkgRelCount} package imports, ${otherRelCount} code references)`);

    } catch (error) {
      console.error(`❌ AST extraction error for ${filePath}:`, error);
    }

    return relationships;
  }
}
