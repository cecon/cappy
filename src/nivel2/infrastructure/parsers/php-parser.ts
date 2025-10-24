/**
 * @fileoverview PHP parser for extracting PHPDoc via pattern matching
 * @module adapters/secondary/parsers/php-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from '../../../shared/types/chunk';
import * as fs from 'fs';

/**
 * Parsed symbol from PHP source
 */
interface ParsedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'trait' | 'constant' | 'property' | 'method';
  phpdoc?: string;
  lineStart: number;
  lineEnd: number;
  visibility?: 'public' | 'private' | 'protected';
}

/**
 * PHP parser using regex patterns for PHPDoc extraction
 */
export class PHPParser {
  /**
   * Parses a PHP file and extracts PHPDoc chunks
   */
  async parseFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const chunks: DocumentChunk[] = [];
      const lines = content.split('\n');

      // Extract symbols with PHPDoc
      const symbols = this.extractSymbols(lines);

      // Create chunks for each symbol with PHPDoc
      for (const symbol of symbols) {
        if (symbol.phpdoc) {
          const chunkId = this.generateChunkId(filePath, symbol.lineStart, symbol.lineEnd);
          
          chunks.push({
            id: chunkId,
            content: symbol.phpdoc,
            metadata: {
              filePath,
              lineStart: symbol.lineStart,
              lineEnd: symbol.lineEnd,
              chunkType: 'phpdoc',
              symbolName: symbol.name,
              symbolKind: symbol.kind,
              visibility: symbol.visibility
            }
          });
        }
      }

      console.log(`🐘 PHP: Parsed ${chunks.length} PHPDoc chunks from ${filePath}`);
      return chunks;
    } catch (error) {
      console.error(`❌ PHP parser error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extracts symbols from PHP source
   */
  private extractSymbols(lines: string[]): ParsedSymbol[] {
    const symbols: ParsedSymbol[] = [];
    let currentPHPDoc: string | null = null;
    let phpdocStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect inline PHPDoc on the same line as a symbol
      const inlineStart = trimmed.indexOf('/**');
      const inlineEnd = trimmed.indexOf('*/', inlineStart + 3);
      if (inlineStart !== -1 && inlineEnd !== -1 && inlineEnd > inlineStart) {
        const phpdoc = trimmed.slice(inlineStart, inlineEnd + 2);
        const afterDoc = trimmed.slice(inlineEnd + 2).trim();
        const inlineSymbol = this.parseSymbolFromLine(afterDoc, i);
        if (inlineSymbol) {
          inlineSymbol.phpdoc = phpdoc;
          inlineSymbol.lineStart = i + 1;
          symbols.push(inlineSymbol);
          continue;
        }
        // If no symbol on the same line, fall through to multi-line handling
      }

      // Detect PHPDoc start
      if (trimmed.startsWith('/**')) {
        currentPHPDoc = line;
        phpdocStartLine = i + 1;
        continue;
      }

      // Accumulate PHPDoc lines
      if (currentPHPDoc !== null && !trimmed.endsWith('*/')) {
        currentPHPDoc += '\n' + line;
        continue;
      }

      // Detect PHPDoc end
      if (currentPHPDoc !== null && trimmed.endsWith('*/')) {
        currentPHPDoc += '\n' + line;

        // Look for the next symbol declaration
        const symbol = this.findNextSymbol(lines, i + 1);
        if (symbol) {
          symbol.phpdoc = currentPHPDoc;
          symbol.lineStart = phpdocStartLine;
          symbols.push(symbol);
        }

        currentPHPDoc = null;
        continue;
      }
    }

    return symbols;
  }

  private parseSymbolFromLine(trimmed: string, lineIndex: number): ParsedSymbol | null {
    // Class declaration
    const classMatch = trimmed.match(/^(?:abstract\s+|final\s+)?class\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
    if (classMatch) {
      return { name: classMatch[1], kind: 'class', lineStart: lineIndex + 1, lineEnd: this.findBlockEnd([trimmed], 0) };
    }

    // Interface declaration
    const interfaceMatch = trimmed.match(/^interface\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
    if (interfaceMatch) {
      return { name: interfaceMatch[1], kind: 'interface', lineStart: lineIndex + 1, lineEnd: lineIndex + 1 };
    }

    // Trait declaration
    const traitMatch = trimmed.match(/^trait\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
    if (traitMatch) {
      return { name: traitMatch[1], kind: 'trait', lineStart: lineIndex + 1, lineEnd: lineIndex + 1 };
    }

    // Method declaration
    const methodMatch = trimmed.match(/^(public|private|protected)\s+(?:static\s+)?function\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
    if (methodMatch) {
      return {
        name: methodMatch[2],
        kind: 'method',
        visibility: methodMatch[1] as 'public' | 'private' | 'protected',
        lineStart: lineIndex + 1,
        lineEnd: lineIndex + 1
      };
    }

    // Property declaration (typed/readonly)
    const propertyMatch = trimmed.match(/^(public|private|protected)\s+(?:static\s+)?(?:readonly\s+)?(?:[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff\\|?\[\]<>:\s]*\s+)?\$([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
    if (propertyMatch) {
      return {
        name: propertyMatch[2],
        kind: 'property',
        visibility: propertyMatch[1] as 'public' | 'private' | 'protected',
        lineStart: lineIndex + 1,
        lineEnd: lineIndex + 1
      };
    }

    // Constant declaration
    const constMatch = trimmed.match(/^(?:public|private|protected)?\s*const\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
    if (constMatch) {
      return { name: constMatch[1], kind: 'constant', lineStart: lineIndex + 1, lineEnd: lineIndex + 1 };
    }

    // Function declaration (global)
    const functionMatch = trimmed.match(/^function\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
    if (functionMatch) {
      return { name: functionMatch[1], kind: 'function', lineStart: lineIndex + 1, lineEnd: lineIndex + 1 };
    }

    return null;
  }

  /**
   * Finds the next symbol declaration after PHPDoc
   */
  private findNextSymbol(lines: string[], startIndex: number): ParsedSymbol | null {
    for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and attributes
      if (!trimmed || trimmed.startsWith('#[') || trimmed.startsWith('@')) {
        continue;
      }

      // Class declaration
      const classMatch = trimmed.match(/^(?:abstract\s+|final\s+)?class\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
      if (classMatch) {
        return {
          name: classMatch[1],
          kind: 'class',
          lineStart: i + 1,
          lineEnd: this.findBlockEnd(lines, i)
        };
      }

      // Interface declaration
      const interfaceMatch = trimmed.match(/^interface\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
      if (interfaceMatch) {
        return {
          name: interfaceMatch[1],
          kind: 'interface',
          lineStart: i + 1,
          lineEnd: this.findBlockEnd(lines, i)
        };
      }

      // Trait declaration
      const traitMatch = trimmed.match(/^trait\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
      if (traitMatch) {
        return {
          name: traitMatch[1],
          kind: 'trait',
          lineStart: i + 1,
          lineEnd: this.findBlockEnd(lines, i)
        };
      }

      // Function declaration
      const functionMatch = trimmed.match(/^function\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
      if (functionMatch) {
        return {
          name: functionMatch[1],
          kind: 'function',
          lineStart: i + 1,
          lineEnd: this.findBlockEnd(lines, i)
        };
      }

      // Method declaration
      const methodMatch = trimmed.match(/^(public|private|protected)\s+(?:static\s+)?function\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
      if (methodMatch) {
        return {
          name: methodMatch[2],
          kind: 'method',
          visibility: methodMatch[1] as 'public' | 'private' | 'protected',
          lineStart: i + 1,
          lineEnd: this.findBlockEnd(lines, i)
        };
      }

      // Property declaration (supports typed and readonly properties)
      // Examples:
      //   public $id;
      //   public readonly int $id;
      //   protected static ?User $user;
      //   private array $items = [];
      const propertyMatch = trimmed.match(
        /^(public|private|protected)\s+(?:static\s+)?(?:readonly\s+)?(?:[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff\\|?\[\]<>:\s]*\s+)?\$([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/
      );
      if (propertyMatch) {
        return {
          name: propertyMatch[2],
          kind: 'property',
          visibility: propertyMatch[1] as 'public' | 'private' | 'protected',
          lineStart: i + 1,
          lineEnd: i + 1
        };
      }

      // Constant declaration (class constant or global)
      const constMatch = trimmed.match(/^(?:public|private|protected)?\s*const\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/);
      if (constMatch) {
        return {
          name: constMatch[1],
          kind: 'constant',
          lineStart: i + 1,
          lineEnd: i + 1
        };
      }

      // If we hit another PHPDoc or declaration without match, stop looking
      if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
        break;
      }
    }

    return null;
  }

  /**
   * Finds the end of a code block (matching braces)
   */
  private findBlockEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i + 1;
          }
        }
      }

      // For single-line declarations without braces
      if (!foundOpenBrace && line.trim().endsWith(';')) {
        return i + 1;
      }
    }

    return startIndex + 1;
  }

  /**
   * Generates a chunk ID
   */
  private generateChunkId(filePath: string, lineStart: number, lineEnd: number): string {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    return `chunk:${fileName}:${lineStart}-${lineEnd}`;
  }
}

/**
 * Factory function to create PHP parser
 */
export function createPHPParser(): PHPParser {
  return new PHPParser();
}
