/**
 * @fileoverview AST-based relationship extraction service
 * @module services/ast-relationship-extractor
 * @author Cappy Team
 * @since 3.0.0
 */

import { parse } from '@typescript-eslint/parser';
import type { DocumentChunk, GraphRelationship } from '../types/chunk';
import { ExternalPackageResolver, type PackageResolution } from './external-package-resolver';
import * as fs from 'fs';
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
 */
export class ASTRelationshipExtractor {
  private packageResolver: ExternalPackageResolver;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.packageResolver = new ExternalPackageResolver(workspaceRoot);
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Analyzes a file and returns import/export/call/type reference info
   * Now includes external package resolution
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
    const content = fs.readFileSync(absFilePath, 'utf-8');
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: true,
      tokens: false,
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    });

    const imports = await this.extractImportsWithResolution(ast, absFilePath);
    const exports = this.extractExports(ast);
    const calls = this.extractFunctionCalls(ast);
    const typeRefs = this.extractTypeReferences(ast);
    return { imports, exports, calls, typeRefs };
  }
  /**
   * Extracts relationships from a file's AST
   * Now includes external package dependencies
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
      const content = fs.readFileSync(absFilePath, 'utf-8');
      
      // Parse the file
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
        tokens: false,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      });

      // Extract imports with resolution
  const imports = await this.extractImportsWithResolution(ast, absFilePath);
      const exports = this.extractExports(ast);
      
      // Extract function calls
      const calls = this.extractFunctionCalls(ast);
      
      // Extract type references
      const typeRefs = this.extractTypeReferences(ast);

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

  /**
   * Extracts import statements with external package resolution
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async extractImportsWithResolution(ast: any, filePath: string): Promise<ImportInfo[]> {
    const imports: ImportInfo[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visit = async (node: any) => {
      if (!node) return;

      // Handle standard imports
      if (node.type === 'ImportDeclaration') {
        const source = node.source?.value;
        const specifiers: string[] = [];

        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.imported?.name) {
              specifiers.push(spec.imported.name);
            } else if (spec.local?.name) {
              specifiers.push(spec.local.name);
            }
          }
        }

        if (source) {
          const isExternal = this.packageResolver.isExternalImport(source);
          const importInfo: ImportInfo = {
            source,
            specifiers,
            isExternal
          };
          if (isExternal) {
            try {
              importInfo.packageResolution = await this.packageResolver.resolveExternalImport(source, filePath);
            } catch (error) {
              console.warn(`⚠️ Failed to resolve external package: ${source}`, error);
            }
          }
          imports.push(importInfo);
        }
      }

      // Handle export * from ... and export { ... } from ...
      if ((node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration') && node.source) {
        const source = node.source.value;
        const specifiers: string[] = [];

        // For ExportNamedDeclaration, collect exported specifiers
        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.exported?.name) {
              specifiers.push(spec.exported.name);
            }
          }
        }

        if (source) {
          const isExternal = this.packageResolver.isExternalImport(source);
          const importInfo: ImportInfo = {
            source,
            specifiers,
            isExternal
          };
          if (isExternal) {
            try {
              importInfo.packageResolution = await this.packageResolver.resolveExternalImport(source, filePath);
            } catch (error) {
              console.warn(`⚠️ Failed to resolve external package: ${source}`, error);
            }
          }
          imports.push(importInfo);
        }
      }

      // Recursively visit children
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            for (const child of node[key]) {
              await visit(child);
            }
          } else {
            await visit(node[key]);
          }
        }
      }
    };

    await visit(ast);
    return imports;
  }

  /**
   * Extracts export statements
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractExports(ast: any): string[] {
    const exports: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visit = (node: any) => {
      if (!node) return;

      if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
        if (node.declaration) {
          // Export declaration
          if (node.declaration.id?.name) {
            exports.push(node.declaration.id.name);
          }
        } else if (node.specifiers) {
          // Export specifiers
          for (const spec of node.specifiers) {
            if (spec.exported?.name) {
              exports.push(spec.exported.name);
            }
          }
        }
      }

      // Recursively visit children
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(visit);
          } else {
            visit(node[key]);
          }
        }
      }
    };

    visit(ast);
    return exports;
  }

  /**
   * Extracts function calls
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractFunctionCalls(ast: any): string[] {
    const calls: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visit = (node: any) => {
      if (!node) return;

      if (node.type === 'CallExpression') {
        if (node.callee?.name) {
          calls.push(node.callee.name);
        } else if (node.callee?.property?.name) {
          calls.push(node.callee.property.name);
        }
      }

      // Recursively visit children
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(visit);
          } else {
            visit(node[key]);
          }
        }
      }
    };

    visit(ast);
    return calls;
  }

  /**
   * Extracts type references
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTypeReferences(ast: any): string[] {
    const typeRefs: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visit = (node: any) => {
      if (!node) return;

      if (node.type === 'TSTypeReference') {
        if (node.typeName?.name) {
          typeRefs.push(node.typeName.name);
        }
      }

      // Recursively visit children
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(visit);
          } else {
            visit(node[key]);
          }
        }
      }
    };

    visit(ast);
    return typeRefs;
  }
}
