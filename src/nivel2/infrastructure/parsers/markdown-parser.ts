/**
 * @fileoverview Markdown parser for extracting sections
 * @module adapters/secondary/parsers/markdown-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import * as fs from 'fs';
import matter from 'gray-matter';
import type { DocumentChunk } from '../../../shared/types/chunk';
import { generateChunkId } from './chunk-id-generator';

/**
 * Markdown section
 */
interface MarkdownSection {
  heading: string;
  headingLevel: number;
  content: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Markdown parser using gray-matter
 */
export class MarkdownParser {
  /**
   * Parses a Markdown file and extracts sections
   */
  async parseFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const chunks: DocumentChunk[] = [];

      // Parse frontmatter
      const { data: frontmatter, content: markdownContent } = matter(content);
      
      // Extract sections
      const sections = this.extractSections(markdownContent);

      // Create chunks for each section
      for (const section of sections) {
        const chunkId = generateChunkId(filePath, section.lineStart, section.lineEnd);
        
        chunks.push({
          id: chunkId,
          content: `## ${section.heading}\n\n${section.content}`,
          metadata: {
            filePath,
            lineStart: section.lineStart,
            lineEnd: section.lineEnd,
            chunkType: 'markdown_section',
            heading: section.heading,
            headingLevel: section.headingLevel
          }
        });
      }

      console.log(`📝 Markdown: Parsed ${chunks.length} sections from ${filePath}`);
      console.log(`   Frontmatter:`, Object.keys(frontmatter).length > 0 ? frontmatter : 'none');
      
      return chunks;
    } catch (error) {
      console.error(`❌ Markdown parser error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extracts sections from Markdown content
   */
  private extractSections(content: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: MarkdownSection | null = null;
    let currentContent: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          currentSection.lineEnd = i;
          sections.push(currentSection);
        }
        
        // Start new section
        const headingLevel = headingMatch[1].length;
        const heading = headingMatch[2].trim();
        
        currentSection = {
          heading,
          headingLevel,
          content: '',
          lineStart: i + 1,
          lineEnd: i + 1
        };
        currentContent = [];
      } else if (currentSection) {
        // Add line to current section
        currentContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      currentSection.lineEnd = lines.length;
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Creates chunks with overlap (sliding window)
   */
  async parseFileWithOverlap(
    filePath: string,
    maxTokens = 512,
    overlapTokens = 100
  ): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { content: markdownContent } = matter(content);
      const chunks: DocumentChunk[] = [];

      // Token-based sliding window to handle long lines/paragraphs
      const tokens = markdownContent.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        console.log(`📝 Markdown: Parsed 0 overlapping chunks from ${filePath}`);
        return [];
      }

      const windowSize = Math.max(1, maxTokens);
      const step = Math.max(1, windowSize - Math.max(0, overlapTokens));
      let start = 0;
      let chunkNumber = 0;

      while (start < tokens.length) {
        const end = Math.min(start + windowSize, tokens.length);
        const chunkContent = tokens.slice(start, end).join(' ').trim();

        if (chunkContent.length > 0) {
          const chunkId = generateChunkId(filePath, start + 1, end, chunkNumber);
          chunks.push({
            id: chunkId,
            content: chunkContent,
            metadata: {
              filePath,
              // Since we are token-based here, approximate line numbers with token indices
              lineStart: start + 1,
              lineEnd: end,
              chunkType: 'markdown_section',
              chunkNumber,
              hasOverlap: chunkNumber > 0,
              overlapTokens: chunkNumber > 0 ? overlapTokens : 0,
            } as unknown as DocumentChunk['metadata']
          });
          chunkNumber++;
        }

        // Advance with overlap
        start += step;
        if (start >= tokens.length && end < tokens.length) {
          // Safety: ensure progress if step is too small (shouldn't happen due to Math.max)
          start = end;
        }
      }

      console.log(`📝 Markdown: Parsed ${chunks.length} overlapping chunks from ${filePath}`);
      return chunks;
    } catch (error) {
      console.error(`❌ Markdown parser (overlap) error for ${filePath}:`, error);
      return [];
    }
  }

}

/**
 * Factory function to create Markdown parser
 */
export function createMarkdownParser(): MarkdownParser {
  return new MarkdownParser();
}
