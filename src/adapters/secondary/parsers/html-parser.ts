/**
 * @fileoverview HTML parser for extracting comments and structure
 * @module adapters/secondary/parsers/html-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from '../../../types/chunk';
import * as fs from 'fs';

/**
 * Parsed element from HTML document
 */
interface ParsedElement {
  name: string;
  kind: 'comment' | 'meta' | 'title' | 'heading' | 'landmark';
  content: string;
  lineStart: number;
  lineEnd: number;
  attributes?: Record<string, string>;
}

/**
 * HTML parser using regex patterns
 * Extracts HTML comments, meta tags, semantic structure
 */
export class HTMLParser {
  /**
   * Parses an HTML file and extracts documentation chunks
   */
  async parseFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`❌ HTML parser: File not found: ${filePath}`);
        return [];
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const chunks: DocumentChunk[] = [];
      const lines = content.split('\n');

      // Extract various HTML elements
      const elements = this.extractElements(lines, content);

      // Create chunks for each documented element
      for (const element of elements) {
        if (element.content) {
          const chunkId = this.generateChunkId(filePath, element.lineStart, element.lineEnd);
          
          chunks.push({
            id: chunkId,
            content: element.content,
            metadata: {
              filePath,
              lineStart: element.lineStart,
              lineEnd: element.lineEnd,
              chunkType: 'html',
              elementName: element.name,
              elementKind: element.kind,
              ...(element.attributes && { attributes: element.attributes })
            }
          });
        }
      }

      return chunks;
    } catch (error) {
      console.error(`❌ HTML parser error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extracts elements from HTML document
   */
  private extractElements(lines: string[], fullContent: string): ParsedElement[] {
    const elements: ParsedElement[] = [];

    // Extract multi-line HTML comments
    this.extractComments(fullContent, elements);

    // Extract meta tags and other elements line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract <title>
      const titleMatch = line.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        elements.push({
          name: 'title',
          kind: 'title',
          content: titleMatch[1].trim(),
          lineStart: i + 1,
          lineEnd: i + 1
        });
        continue;
      }

      // Extract <meta> tags
      const metaMatch = line.match(/<meta\s+([^>]+)>/i);
      if (metaMatch) {
        const attributes = this.extractAttributes(metaMatch[1]);
        const content = attributes.content || attributes.name || attributes.property;
        if (content) {
          elements.push({
            name: attributes.name || attributes.property || 'meta',
            kind: 'meta',
            content: `${attributes.name || attributes.property || 'meta'}: ${content}`,
            attributes,
            lineStart: i + 1,
            lineEnd: i + 1
          });
        }
        continue;
      }

      // Extract headings (h1-h6)
      const headingMatch = line.match(/<h([1-6])[^>]*>([^<]+)<\/h\1>/i);
      if (headingMatch) {
        elements.push({
          name: `h${headingMatch[1]}`,
          kind: 'heading',
          content: headingMatch[2].trim(),
          lineStart: i + 1,
          lineEnd: i + 1
        });
        continue;
      }

      // Extract ARIA landmarks
      const landmarkMatch = line.match(/<(header|nav|main|aside|footer|section|article)([^>]*)>/i);
      if (landmarkMatch) {
        const attributes = this.extractAttributes(landmarkMatch[2]);
        const ariaLabel = attributes['aria-label'] || attributes.id || attributes.class;
        if (ariaLabel) {
          elements.push({
            name: landmarkMatch[1],
            kind: 'landmark',
            content: `${landmarkMatch[1]}: ${ariaLabel}`,
            attributes,
            lineStart: i + 1,
            lineEnd: i + 1
          });
        }
        continue;
      }
    }

    return elements;
  }

  /**
   * Extracts HTML comments (including multi-line)
   */
  private extractComments(content: string, elements: ParsedElement[]): void {
    const commentRegex = /<!--([\s\S]*?)-->/g;
    let match;

    while ((match = commentRegex.exec(content)) !== null) {
      const commentContent = match[1].trim();
      
      // Skip empty comments or those that look like code (e.g., conditional comments)
      if (!commentContent || commentContent.startsWith('[if ')) {
        continue;
      }

      // Find line numbers
      const beforeComment = content.substring(0, match.index);
      const lineStart = (beforeComment.match(/\n/g) || []).length + 1;
      const commentLines = (match[0].match(/\n/g) || []).length;
      const lineEnd = lineStart + commentLines;

      elements.push({
        name: 'comment',
        kind: 'comment',
        content: commentContent,
        lineStart,
        lineEnd
      });
    }
  }

  /**
   * Extracts attributes from HTML tag
   */
  private extractAttributes(attrString: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attrRegex = /([a-z0-9\-:]+)\s*=\s*["']([^"']+)["']/gi;
    let match;

    while ((match = attrRegex.exec(attrString)) !== null) {
      attributes[match[1]] = match[2];
    }

    return attributes;
  }

  /**
   * Generates a unique chunk ID
   */
  private generateChunkId(filePath: string, lineStart: number, lineEnd: number): string {
    const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
    return `chunk:${fileName}:${lineStart}-${lineEnd}`;
  }
}

/**
 * Factory function to create HTML parser
 */
export function createHTMLParser(): HTMLParser {
  return new HTMLParser();
}
