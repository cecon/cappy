/**
 * @fileoverview Parser service that coordinates different file parsers
 * @module services/parser-service
 * @author Cappy Team
 * @since 3.0.0
 */

import { createTypeScriptParser } from '../adapters/secondary/parsers/typescript-parser';
import { createMarkdownParser } from '../adapters/secondary/parsers/markdown-parser';
import { createDocumentEnhancedParser } from '../adapters/secondary/parsers/document-enhanced-parser';
import type { DocumentChunk } from '../types/chunk';
import * as path from 'path';

/**
 * Parser service coordinating different file type parsers
 */
export class ParserService {
  private readonly tsParser = createTypeScriptParser();
  private readonly mdParser = createMarkdownParser();
  private readonly enhancedDocParser = createDocumentEnhancedParser();
  private enhancedParsingEnabled = false;

  /**
   * Enables enhanced parsing with entity extraction
   */
  enableEnhancedParsing(enabled = true): void {
    this.enhancedParsingEnabled = enabled;
    console.log(`📚 Enhanced document parsing ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Parses a file based on its extension
   */
  async parseFile(filePath: string, useOverlap = false): Promise<DocumentChunk[]> {
    const ext = path.extname(filePath);
    
    try {
      switch (ext) {
        case '.ts':
        case '.tsx':
        case '.js':
        case '.jsx':
          console.log(`🔍 Parsing TypeScript/JavaScript: ${filePath}`);
          return await this.tsParser.parseFile(filePath);

        case '.md':
        case '.mdx':
          // Use enhanced parser if enabled
          if (this.enhancedParsingEnabled) {
            console.log(`🧠 Parsing Markdown with entity extraction: ${filePath}`);
            return await this.enhancedDocParser.parseFile(filePath, true);
          }
          
          // Fallback to standard parser
          console.log(`🔍 Parsing Markdown: ${filePath}`);
          if (useOverlap) {
            return await this.mdParser.parseFileWithOverlap(filePath, 512, 100);
          } else {
            return await this.mdParser.parseFile(filePath);
          }

        case '.pdf':
        case '.doc':
        case '.docx':
          // Enhanced parser for documents
          if (this.enhancedParsingEnabled) {
            console.log(`🧠 Parsing document with entity extraction: ${filePath}`);
            return await this.enhancedDocParser.parseFile(filePath, true);
          }
          console.warn(`⚠️ Enhanced parsing disabled - cannot parse: ${ext}`);
          return [];

        default:
          console.warn(`⚠️ Unsupported file type: ${ext}`);
          return [];
      }
    } catch (error) {
      console.error(`❌ Parser service error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Gets the language for a file
   */
  getLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.md':
      case '.mdx':
        return 'markdown';
      default:
        return 'unknown';
    }
  }

  /**
   * Checks if a file is supported
   */
  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath);
    const basicSupported = ['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx'];
    const enhancedSupported = ['.pdf', '.doc', '.docx'];
    
    if (basicSupported.includes(ext)) {
      return true;
    }
    
    if (enhancedSupported.includes(ext) && this.enhancedParsingEnabled) {
      return true;
    }
    
    return false;
  }

  /**
   * Checks if enhanced parsing is enabled
   */
  isEnhancedParsingEnabled(): boolean {
    return this.enhancedParsingEnabled;
  }
}

/**
 * Factory function to create parser service
 */
export function createParserService(): ParserService {
  return new ParserService();
}
