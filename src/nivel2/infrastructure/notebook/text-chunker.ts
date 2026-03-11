/**
 * @fileoverview Recursive character text splitter for document chunking
 * @module infrastructure/notebook/text-chunker
 */

import type { ChunkMetadata } from '../../../domains/notebook/notebook-types';

export interface ChunkedText {
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkerOptions {
  /** Maximum characters per chunk (default: 512) */
  chunkSize?: number;
  /** Number of overlapping characters between chunks (default: 50) */
  chunkOverlap?: number;
  /** Separator hierarchy for splitting (default: ["\n\n", "\n", ". ", " "]) */
  separators?: string[];
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  chunkSize: 512,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '. ', ' '],
};

/**
 * Recursive character text splitter.
 * Splits text hierarchically using separators, preserving natural boundaries.
 */
export class TextChunker {
  private readonly opts: Required<ChunkerOptions>;

  constructor(options?: ChunkerOptions) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Chunk a document into overlapping text segments.
   * @param text Full document text
   * @param source Source file path (for metadata)
   */
  chunk(text: string, source: string): ChunkedText[] {
    const lines = text.split('\n');
    const rawChunks = this.splitRecursive(text, this.opts.separators);
    const results: ChunkedText[] = [];

    let cursor = 0; // character position in the original text

    for (const chunkText of rawChunks) {
      const startPos = text.indexOf(chunkText, cursor);
      const startLine = startPos >= 0
        ? this.charPosToLine(text, startPos)
        : 0;
      const endLine = startPos >= 0
        ? this.charPosToLine(text, startPos + chunkText.length - 1)
        : lines.length - 1;

      // Extract section from nearest preceding markdown header
      const section = this.findSection(lines, startLine);

      results.push({
        text: chunkText.trim(),
        metadata: {
          section,
          startLine: startLine + 1, // 1-indexed
          endLine: endLine + 1,
        },
      });

      if (startPos >= 0) {
        cursor = startPos + chunkText.length - this.opts.chunkOverlap;
        if (cursor < 0) cursor = 0;
      }
    }

    return results.filter(c => c.text.length > 0);
  }

  /**
   * Recursively split text using a hierarchy of separators.
   */
  private splitRecursive(text: string, separators: string[]): string[] {
    if (text.length <= this.opts.chunkSize) {
      return [text];
    }

    if (separators.length === 0) {
      // Last resort: hard-cut by chunkSize with overlap
      return this.hardSplit(text);
    }

    const [sep, ...remainingSeps] = separators;
    const parts = text.split(sep);

    if (parts.length <= 1) {
      // This separator doesn't help, try the next one
      return this.splitRecursive(text, remainingSeps);
    }

    // Merge parts back into chunks of acceptable size
    const chunks: string[] = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;

      if (candidate.length > this.opts.chunkSize && current) {
        chunks.push(current);
        // Overlap: keep the end of the previous chunk
        const overlapText = current.slice(-this.opts.chunkOverlap);
        current = overlapText + sep + part;
      } else {
        current = candidate;
      }
    }

    if (current) {
      chunks.push(current);
    }

    // Recursively split any chunks that are still too large
    const result: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length > this.opts.chunkSize) {
        result.push(...this.splitRecursive(chunk, remainingSeps));
      } else {
        result.push(chunk);
      }
    }

    return result;
  }

  /**
   * Hard-split by chunkSize with overlap (last resort).
   */
  private hardSplit(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + this.opts.chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += this.opts.chunkSize - this.opts.chunkOverlap;
    }
    return chunks;
  }

  /**
   * Convert a character position to a 0-indexed line number.
   */
  private charPosToLine(text: string, charPos: number): number {
    let line = 0;
    for (let i = 0; i < charPos && i < text.length; i++) {
      if (text[i] === '\n') line++;
    }
    return line;
  }

  /**
   * Find the nearest preceding markdown heading for a given line.
   */
  private findSection(lines: string[], lineIndex: number): string | undefined {
    for (let i = lineIndex; i >= 0; i--) {
      const match = lines[i].match(/^#{1,6}\s+(.+)/);
      if (match) return match[1].trim();
    }
    return undefined;
  }
}
