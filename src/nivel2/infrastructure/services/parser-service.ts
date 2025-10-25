/**
 * @fileoverview Parser service that coordinates different file parsers
 * @module services/parser-service
 * @author Cappy Team
 * @since 3.0.0
 */

import { createTypeScriptParser } from '../parsers/typescript-parser';
import { createMarkdownParser } from '../parsers/markdown-parser';
import { createDocumentEnhancedParser } from '../parsers/document-enhanced-parser';
import { createPHPParser } from '../parsers/php-parser';
import { createBladeParser } from '../parsers/blade-parser';
import { createHTMLParser } from '../parsers/html-parser';
import { createViteParser } from '../parsers/vite-parser';
import type { DocumentChunk } from '../../../shared/types/chunk';
import * as path from 'node:path';

/**
 * Parser service coordinating different file type parsers
 */
export class ParserService {
  private readonly tsParser = createTypeScriptParser();
  private readonly mdParser = createMarkdownParser();
  private readonly enhancedDocParser;
  private readonly phpParser = createPHPParser();
  private readonly bladeParser = createBladeParser();
  private readonly htmlParser = createHTMLParser();
  private readonly viteParser = createViteParser();
  private enhancedParsingEnabled = false; // Disabled by default; can be enabled for AST entity extraction
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.enhancedDocParser = createDocumentEnhancedParser(workspaceRoot);
  }

  /**
   * Enables enhanced parsing with AST entity extraction
   */
  enableEnhancedParsing(enabled = true): void {
    this.enhancedParsingEnabled = enabled;
    console.log(`📚 Enhanced document parsing (AST-based) ${enabled ? 'enabled' : 'disabled'}`);
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

        case '.php':
          // Check if it's a Blade template
          if (filePath.endsWith('.blade.php')) {
            console.log(`�️ Parsing Blade template: ${filePath}`);
            return await this.bladeParser.parseFile(filePath);
          }
          console.log(`�🐘 Parsing PHP: ${filePath}`);
          return await this.phpParser.parseFile(filePath);

        case '.html':
          console.log(`🌐 Parsing HTML: ${filePath}`);
          return await this.htmlParser.parseFile(filePath);

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

        default: {
          // Check if it's a Vite config file
          const fileName = path.basename(filePath);
          if (fileName.match(/^vite\.config\.(js|ts|mjs|cjs)$/)) {
            console.log(`⚡ Parsing Vite config: ${filePath}`);
            return await this.viteParser.parseFile(filePath);
          }
          
          console.warn(`⚠️ Unsupported file type: ${ext}`);
          return [];
        }
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
    const fileName = path.basename(filePath);
    
    // Check for Blade templates
    if (filePath.endsWith('.blade.php')) {
      return 'blade';
    }
    
    // Check for Vite config
    if (fileName.match(/^vite\.config\.(js|ts|mjs|cjs)$/)) {
      return 'vite';
    }
    
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.php':
        return 'php';
      case '.html':
        return 'html';
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
    const fileName = path.basename(filePath);
    const basicSupported = ['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx', '.php', '.html'];
    const enhancedSupported = ['.pdf', '.doc', '.docx'];
    
    // Check for Blade templates
    if (filePath.endsWith('.blade.php')) {
      return true;
    }
    
    // Check for Vite config
    if (fileName.match(/^vite\.config\.(js|ts|mjs|cjs)$/)) {
      return true;
    }
    
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
export function createParserService(workspaceRoot: string): ParserService {
  return new ParserService(workspaceRoot);
}
