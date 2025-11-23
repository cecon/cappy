/**
 * @fileoverview TypeScript parser for extracting JSDoc via AST
 * @module adapters/secondary/parsers/typescript-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import { parse } from '@typescript-eslint/parser';
import type { DocumentChunk } from '../../../shared/types/chunk';
import * as fs from 'fs';
import { generateChunkId } from './chunk-id-generator';

/**
 * Parsed symbol from TypeScript AST
 */
interface ParsedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable';
  jsdoc?: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * TypeScript parser using @typescript-eslint/parser
 */
export class TypeScriptParser {
  /**
   * Parses a TypeScript file and extracts JSDoc chunks
   */
  async parseFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const chunks: DocumentChunk[] = [];

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

      // Extract symbols with JSDoc
      const symbols = this.extractSymbols(ast, content);

      // Create chunks for each symbol with JSDoc
      for (const symbol of symbols) {
        if (symbol.jsdoc) {
          const chunkId = generateChunkId(filePath, symbol.lineStart, symbol.lineEnd);
          
          chunks.push({
            id: chunkId,
            content: symbol.jsdoc,
            metadata: {
              filePath,
              lineStart: symbol.lineStart,
              lineEnd: symbol.lineEnd,
              chunkType: 'jsdoc',
              symbolName: symbol.name,
              symbolKind: symbol.kind
            }
          });
        }
      }

      console.log(`📝 TypeScript: Parsed ${chunks.length} JSDoc chunks from ${filePath}`);
      return chunks;
    } catch {
      // Silent error handling for graceful degradation
      return [];
    }
  }

  /**
   * Extracts symbols from AST
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractSymbols(ast: any, content: string): ParsedSymbol[] {
    const symbols: ParsedSymbol[] = [];
    const lines = content.split('\n');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visit = (node: any) => {
      if (!node) return;

      // Check for different node types
      let symbol: ParsedSymbol | null = null;

      switch (node.type) {
        case 'FunctionDeclaration':
          if (node.id && node.loc) {
            symbol = {
              name: node.id.name,
              kind: 'function',
              lineStart: node.loc.start.line,
              lineEnd: node.loc.end.line
            };
          }
          break;

        case 'ClassDeclaration':
          if (node.id && node.loc) {
            symbol = {
              name: node.id.name,
              kind: 'class',
              lineStart: node.loc.start.line,
              lineEnd: node.loc.end.line
            };
          }
          break;

        case 'TSInterfaceDeclaration':
          if (node.id && node.loc) {
            symbol = {
              name: node.id.name,
              kind: 'interface',
              lineStart: node.loc.start.line,
              lineEnd: node.loc.end.line
            };
          }
          break;

        case 'TSTypeAliasDeclaration':
          if (node.id && node.loc) {
            symbol = {
              name: node.id.name,
              kind: 'type',
              lineStart: node.loc.start.line,
              lineEnd: node.loc.end.line
            };
          }
          break;

        case 'VariableDeclaration':
          if (node.declarations && node.declarations[0] && node.loc) {
            const firstDeclarator = node.declarations[0];
            if (firstDeclarator.id && firstDeclarator.id.name) {
              symbol = {
                name: firstDeclarator.id.name,
                kind: 'variable',
                lineStart: node.loc.start.line,
                lineEnd: node.loc.end.line
              };
            }
          }
          break;
      }

      // If symbol found, extract JSDoc
      if (symbol) {
        let jsdoc = this.extractJSDoc(lines, symbol.lineStart);
        // Fallback: support inline JSDoc on the same line as the symbol
        if (!jsdoc) {
          const line = lines[symbol.lineStart - 1] ?? '';
          const startIdx = line.indexOf('/**');
          const endIdx = line.indexOf('*/', startIdx + 3);
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            jsdoc = line.slice(startIdx, endIdx + 2);
          }
        }
        if (jsdoc) {
          symbol.jsdoc = jsdoc;
          // Adjust lineStart to include JSDoc (best-effort for multi-line only)
          const jsdocLines = jsdoc.split('\n').length;
          if (jsdocLines > 1) {
            symbol.lineStart = Math.max(1, symbol.lineStart - jsdocLines);
          }
        }
        symbols.push(symbol);
      }

      // Recurse into children
      for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(visit);
        } else if (child && typeof child === 'object') {
          visit(child);
        }
      }
    };

    visit(ast);
    return symbols;
  }

  /**
   * Extracts JSDoc comment before a line
   */
  private extractJSDoc(lines: string[], lineNumber: number): string | undefined {
    const jsdocLines: string[] = [];
    let foundJSDocEnd = false;
    
    // Look backwards from the line
    for (let i = lineNumber - 2; i >= 0; i--) {
      const line = lines[i].trim();
      
      if (!foundJSDocEnd) {
        // Skip empty lines before symbol
        if (line === '') continue;
        
        // Look for JSDoc end
        if (line.endsWith('*/')) {
          foundJSDocEnd = true;
          jsdocLines.unshift(lines[i]);
          continue;
        } else {
          // No JSDoc found
          break;
        }
      } else {
        // Collect JSDoc lines
        jsdocLines.unshift(lines[i]);
        
        // Check for JSDoc start
        if (line.startsWith('/**')) {
          break;
        }
      }
    }
    
    if (jsdocLines.length > 0 && jsdocLines[0].trim().startsWith('/**')) {
      return jsdocLines.join('\n').trim();
    }
    
    return undefined;
  }

}

/**
 * Factory function to create TypeScript parser
 */
export function createTypeScriptParser(): TypeScriptParser {
  return new TypeScriptParser();
}
