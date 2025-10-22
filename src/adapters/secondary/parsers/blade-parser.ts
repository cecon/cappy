/**
 * @fileoverview Blade template parser for extracting documentation and directives
 * @module adapters/secondary/parsers/blade-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from '../../../types/chunk';
import * as fs from 'fs';

/**
 * Parsed element from Blade template
 */
interface ParsedElement {
  name: string;
  kind: 'directive' | 'component' | 'section' | 'comment' | 'phpdoc';
  content?: string;
  lineStart: number;
  lineEnd: number;
  attributes?: Record<string, string>;
}

/**
 * Blade template parser using regex patterns
 * Extracts Blade directives, components, sections and comments
 */
export class BladeParser {
  /**
   * Parses a Blade template file and extracts documentation chunks
   */
  async parseFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Blade parser: File not found: ${filePath}`);
        return [];
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const chunks: DocumentChunk[] = [];
      const lines = content.split('\n');

      // Extract various Blade elements
      const elements = this.extractElements(lines);

      // Create chunks for each documented element
      for (const element of elements) {
        if (element.content || element.kind === 'directive' || element.kind === 'component') {
          const chunkId = this.generateChunkId(filePath, element.lineStart, element.lineEnd);
          
          chunks.push({
            id: chunkId,
            content: element.content || this.buildDirectiveDoc(element),
            metadata: {
              filePath,
              lineStart: element.lineStart,
              lineEnd: element.lineEnd,
              chunkType: 'blade',
              elementName: element.name,
              elementKind: element.kind,
              ...(element.attributes && { attributes: element.attributes })
            }
          });
        }
      }

      return chunks;
    } catch (error) {
      console.error(`❌ Blade parser error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extracts elements from Blade template
   */
  private extractElements(lines: string[]): ParsedElement[] {
    const elements: ParsedElement[] = [];
    let currentPhpDoc: { content: string; lineStart: number } | null = null;
    let inPhpDocBlock = false;
    let inBladeComment = false;
    let bladeCommentStart = -1;
    let bladeCommentContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track PHPDoc blocks
      if (trimmed.startsWith('/**')) {
        inPhpDocBlock = true;
        currentPhpDoc = { content: trimmed + '\n', lineStart: i + 1 };
        continue;
      }

      if (inPhpDocBlock) {
        currentPhpDoc!.content += trimmed + '\n';
        if (trimmed.includes('*/')) {
          inPhpDocBlock = false;
        }
        continue;
      }

      // Track Blade comments {{-- --}}
      if (trimmed.includes('{{--')) {
        inBladeComment = true;
        bladeCommentStart = i + 1;
        bladeCommentContent = line;
        
        // Check if comment closes on same line
        if (trimmed.includes('--}}')) {
          const comment = this.extractBladeComment(bladeCommentContent);
          if (comment) {
            elements.push({
              name: 'blade-comment',
              kind: 'comment',
              content: comment,
              lineStart: bladeCommentStart,
              lineEnd: i + 1
            });
          }
          inBladeComment = false;
          bladeCommentContent = '';
        }
        continue;
      }

      if (inBladeComment) {
        bladeCommentContent += '\n' + line;
        if (trimmed.includes('--}}')) {
          const comment = this.extractBladeComment(bladeCommentContent);
          if (comment) {
            elements.push({
              name: 'blade-comment',
              kind: 'comment',
              content: comment,
              lineStart: bladeCommentStart,
              lineEnd: i + 1
            });
          }
          inBladeComment = false;
          bladeCommentContent = '';
        }
        continue;
      }

      // Extract @section directives
      const sectionMatch = line.match(/@section\s*\(\s*['"]([^'"]+)['"]/);
      if (sectionMatch) {
        elements.push({
          name: sectionMatch[1],
          kind: 'section',
          content: currentPhpDoc?.content,
          lineStart: currentPhpDoc?.lineStart || i + 1,
          lineEnd: i + 1
        });
        currentPhpDoc = null;
        continue;
      }

      // Extract Blade components <x-component>
      const componentMatch = line.match(/<x-([a-z0-9\-.:]+)([^>]*?)>/i);
      if (componentMatch) {
        const attributes = this.extractAttributes(componentMatch[2]);
        elements.push({
          name: componentMatch[1],
          kind: 'component',
          content: currentPhpDoc?.content,
          attributes,
          lineStart: currentPhpDoc?.lineStart || i + 1,
          lineEnd: i + 1
        });
        currentPhpDoc = null;
        continue;
      }

      // Extract important Blade directives
      const directiveMatch = line.match(/@(if|foreach|for|while|switch|can|cannot|auth|guest|isset|empty|push|stack|props|aware)\b/);
      if (directiveMatch) {
        const directiveContent = this.extractDirectiveLine(line);
        elements.push({
          name: directiveMatch[1],
          kind: 'directive',
          content: currentPhpDoc?.content || directiveContent,
          lineStart: currentPhpDoc?.lineStart || i + 1,
          lineEnd: i + 1
        });
        currentPhpDoc = null;
        continue;
      }

      // If we have a PHPDoc but no following Blade element, save it anyway
      if (currentPhpDoc && !trimmed.startsWith('@') && !trimmed.startsWith('<x-')) {
        elements.push({
          name: 'documentation',
          kind: 'phpdoc',
          content: currentPhpDoc.content,
          lineStart: currentPhpDoc.lineStart,
          lineEnd: i
        });
        currentPhpDoc = null;
      }
    }

    return elements;
  }

  /**
   * Extracts content from Blade comment
   */
  private extractBladeComment(content: string): string | null {
    const match = content.match(/\{\{--\s*(.*?)\s*--\}\}/s);
    return match ? match[1].trim() : null;
  }

  /**
   * Extracts attributes from component tag
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
   * Extracts directive line content
   */
  private extractDirectiveLine(line: string): string {
    return line.trim();
  }

  /**
   * Builds documentation for directive
   */
  private buildDirectiveDoc(element: ParsedElement): string {
    if (element.kind === 'directive') {
      return `Blade directive: @${element.name}`;
    }
    if (element.kind === 'component') {
      const attrs = element.attributes 
        ? Object.entries(element.attributes).map(([k, v]) => `${k}="${v}"`).join(' ')
        : '';
      return `Blade component: <x-${element.name}${attrs ? ' ' + attrs : ''}>`;
    }
    if (element.kind === 'section') {
      return `Blade section: @section('${element.name}')`;
    }
    return '';
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
 * Factory function to create Blade parser
 */
export function createBladeParser(): BladeParser {
  return new BladeParser();
}
