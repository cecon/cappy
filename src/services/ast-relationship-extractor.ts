/**
 * @fileoverview AST-based relationship extraction service
 * @module services/ast-relationship-extractor
 * @author Cappy Team
 * @since 3.0.0
 */

import { parse } from '@typescript-eslint/parser';
import type { DocumentChunk, GraphRelationship } from '../types/chunk';
import * as fs from 'fs';

/**
 * Service for extracting relationships from AST
 */
export class ASTRelationshipExtractor {
  /**
   * Extracts relationships from a file's AST
   */
  async extract(
    filePath: string,
      chunks: DocumentChunk[]
  ): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
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

      // Extract imports/exports
      const imports = this.extractImports(ast);
      const exports = this.extractExports(ast);
      
      // Extract function calls
      const calls = this.extractFunctionCalls(ast);
      
      // Extract type references
      const typeRefs = this.extractTypeReferences(ast);

        // Map to actual chunk IDs and create relationships
        console.log(`📊 Found ${imports.length} imports, ${exports.length} exports, ${calls.length} calls, ${typeRefs.length} type refs`);
      
        // Create a map of symbol names to chunk IDs for quick lookup
        const symbolToChunkId = new Map<string, string>();
        for (const chunk of chunks) {
          if (chunk.metadata.symbolName) {
            symbolToChunkId.set(chunk.metadata.symbolName, chunk.id);
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

        // Store import/export info for cross-file relationships (Phase 2)
        // For now, just log them
        if (imports.length > 0) {
          console.log(`  📥 Imports: ${imports.map(i => i.source).join(', ')}`);
        }
        if (exports.length > 0) {
          console.log(`  📤 Exports: ${exports.join(', ')}`);
        }

        console.log(`  🔗 Created ${relationships.length} intra-file relationships`);

    } catch (error) {
      console.error(`❌ AST extraction error for ${filePath}:`, error);
    }

    return relationships;
  }

  /**
   * Extracts import statements
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractImports(ast: any): Array<{ source: string; specifiers: string[] }> {
    const imports: Array<{ source: string; specifiers: string[] }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visit = (node: any) => {
      if (!node) return;

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
          imports.push({ source, specifiers });
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
