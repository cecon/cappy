/**
 * @fileoverview Parser service that coordinates different file parsers
 * @module services/parser-service
 * @author Cappy Team
 * @since 3.0.0
 */

import { createTypeScriptParser } from "../parsers/typescript-parser";
import { createMarkdownParser } from "../parsers/markdown-parser";
import { createDocumentParser } from "../parsers/document-parser";
import { createPHPParser } from "../parsers/php-parser";
import { createBladeParser } from "../parsers/blade-parser";
import { createHTMLParser } from "../parsers/html-parser";
import { createViteParser } from "../parsers/vite-parser";
import type { DocumentChunk } from "../../../shared/types/chunk";
import * as path from "node:path";

/**
 * Parser service coordinating different file type parsers
 */
export class ParserService {
  private readonly tsParser = createTypeScriptParser();
  private readonly mdParser = createMarkdownParser();
  private readonly documentParser = createDocumentParser();
  private readonly phpParser = createPHPParser();
  private readonly bladeParser = createBladeParser();
  private readonly htmlParser = createHTMLParser();
  private readonly viteParser = createViteParser();

  /**
   * Parses a file based on its extension
   */
  async parseFile(
    filePath: string,
    useOverlap = false
  ): Promise<DocumentChunk[]> {
    const ext = path.extname(filePath);

    try {
      switch (ext) {
        case ".ts":
        case ".tsx":
        case ".js":
        case ".jsx":
          console.log(`🔍 Parsing TypeScript/JavaScript: ${filePath}`);
          return await this.tsParser.parseFile(filePath);

        case ".php":
          // Check if it's a Blade template
          if (filePath.endsWith(".blade.php")) {
            console.log(`�️ Parsing Blade template: ${filePath}`);
            return await this.bladeParser.parseFile(filePath);
          }
          console.log(`�🐘 Parsing PHP: ${filePath}`);
          return await this.phpParser.parseFile(filePath);

        case ".html":
          console.log(`🌐 Parsing HTML: ${filePath}`);
          return await this.htmlParser.parseFile(filePath);

        case ".md":
        case ".mdx":
          console.log(`🔍 Parsing Markdown: ${filePath}`);
          if (useOverlap) {
            return await this.mdParser.parseFileWithOverlap(filePath, 512, 100);
          }
          return await this.mdParser.parseFile(filePath);

        case ".pdf":
        case ".doc":
        case ".docx":
          console.log(`📄 Parsing document: ${filePath}`);
          return await this.documentParser.parseFile(filePath, 512, 100);

        default: {
          // Check if it's a Vite config file
          const fileName = path.basename(filePath);
          if (new RegExp(/^vite\.config\.(js|ts|mjs|cjs)$/).exec(fileName)) {
            console.log(`⚡ Parsing Vite config: ${filePath}`);
            return await this.viteParser.parseFile(filePath);
          }

          console.warn(`⚠️ Unsupported file type: ${ext}`);
          return [];
        }
      }
    } catch {
      // Silent error handling for graceful degradation
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
    if (filePath.endsWith(".blade.php")) {
      return "blade";
    }

    // Check for Vite config
    if (new RegExp(/^vite\.config\.(js|ts|mjs|cjs)$/).exec(fileName)) {
      return "vite";
    }

    switch (ext) {
      case ".ts":
      case ".tsx":
        return "typescript";
      case ".js":
      case ".jsx":
        return "javascript";
      case ".php":
        return "php";
      case ".html":
        return "html";
      case ".md":
      case ".mdx":
        return "markdown";
      case ".pdf":
      case ".doc":
      case ".docx":
        return "document";
      default:
        return "unknown";
    }
  }

  /**
   * Checks if a file is supported
   */
  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);
    const basicSupported = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".md",
      ".mdx",
      ".php",
      ".html",
    ];
    const documentSupported = [".pdf", ".doc", ".docx"];

    // Check for Blade templates
    if (filePath.endsWith(".blade.php")) {
      return true;
    }

    // Check for Vite config
    if (new RegExp(/^vite\.config\.(js|ts|mjs|cjs)$/).exec(fileName)) {
      return true;
    }

    if (basicSupported.includes(ext)) {
      return true;
    }

    if (documentSupported.includes(ext)) return true;

    return false;
  }
}

/**
 * Factory function to create parser service
 */
// workspaceRoot is kept in signature for backward compatibility
export function createParserService(): ParserService {
  return new ParserService();
}
