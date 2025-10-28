/**
 * @fileoverview Generic document parser (PDF/Word) with sliding-window chunking
 * @module adapters/secondary/parsers/document-parser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import mammoth from 'mammoth';
import type { DocumentChunk } from '../../../shared/types/chunk';
import type { DocumentEntityMetadata } from '../../../shared/types/entity';
import { createEntityExtractor } from '../services/entity-extraction';

/**
 * Document parser supporting: .pdf, .doc, .docx
 * - Extracts raw text using pdf-parse and mammoth
 * - Splits into overlapping chunks using a simple line-based window
 * - No entity extraction here (that belongs to dedicated services)
 */
export class DocumentParser {
  /**
   * Parses a document file and returns overlapping text chunks
   */
  async parseFile(
    filePath: string,
    maxTokens = 512,
    overlapTokens = 100,
    options?: { extractEntities?: boolean }
  ): Promise<DocumentChunk[]> {
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === '.pdf') {
        const chunks = await this.parsePDF(filePath, maxTokens, overlapTokens);
        if (options?.extractEntities) {
          await this.enrichChunksWithEntities(chunks);
        }
        return chunks;
      }
      if (ext === '.doc' || ext === '.docx') {
        const chunks = await this.parseWord(filePath, maxTokens, overlapTokens);
        if (options?.extractEntities) {
          await this.enrichChunksWithEntities(chunks);
        }
        return chunks;
      }

      console.warn(`⚠️ Unsupported document type: ${ext}`);
      return [];
    } catch (error) {
      console.error(`❌ Document parser error for ${filePath}:`, error);
      return [];
    }
  }

  private async parsePDF(filePath: string, maxTokens: number, overlapTokens: number): Promise<DocumentChunk[]> {
    const dataBuffer = fs.readFileSync(filePath);

    // Dynamic import for CommonJS module
    const pdfParseModule = await import('pdf-parse');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;

    const pdfData = await pdfParse(dataBuffer);
    const content = String(pdfData.text || '');
    if (!content.trim()) {
      console.warn(`⚠️ No text content extracted from PDF: ${filePath}`);
      return [];
    }

    const chunks = await this.extractChunksWithOverlap(filePath, content, maxTokens, overlapTokens);

    // Attach minimal PDF metadata when available
    for (const chunk of chunks) {
      chunk.metadata = {
        ...chunk.metadata,
        pdfPages: pdfData.numpages,
        pdfInfo: {
          title: pdfData.info?.Title,
          author: pdfData.info?.Author,
          subject: pdfData.info?.Subject,
          creator: pdfData.info?.Creator,
          producer: pdfData.info?.Producer,
          creationDate: pdfData.info?.CreationDate,
          modDate: pdfData.info?.ModDate
        }
      } as DocumentChunk['metadata'];
    }

    return chunks;
  }

  private async parseWord(filePath: string, maxTokens: number, overlapTokens: number): Promise<DocumentChunk[]> {
    const buffer = fs.readFileSync(filePath);

    // mammoth supports .docx (and limited .doc)
    const result = await mammoth.extractRawText({ buffer });
    const content = String(result.value || '');
    if (!content.trim()) {
      console.warn(`⚠️ No text content extracted from Word document: ${filePath}`);
      return [];
    }

    return await this.extractChunksWithOverlap(filePath, content, maxTokens, overlapTokens);
  }

  private async extractChunksWithOverlap(
    filePath: string,
    content: string,
    maxTokens: number,
    overlapTokens: number
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const lines = content.split('\n');
    const tokensPerLine = 15; // rough estimate

    const linesPerChunk = Math.max(1, Math.floor(maxTokens / tokensPerLine));
    const overlapLines = Math.max(0, Math.floor(overlapTokens / tokensPerLine));

    let lineIndex = 0;
    let chunkNumber = 0;

    while (lineIndex < lines.length) {
      const endLine = Math.min(lineIndex + linesPerChunk, lines.length);
      const chunkContent = lines.slice(lineIndex, endLine).join('\n').trim();

      if (chunkContent.length > 0) {
        const chunkId = this.generateChunkId(filePath, chunkNumber, lineIndex + 1, endLine);
        chunks.push({
          id: chunkId,
          content: chunkContent,
          metadata: {
            filePath,
            lineStart: lineIndex + 1,
            lineEnd: endLine,
            chunkType: 'document_section',
            chunkNumber,
            hasOverlap: lineIndex > 0,
            overlapTokens: lineIndex > 0 ? overlapTokens : 0
          }
        });
        chunkNumber++;
      }

      // slide with overlap
      const advance = Math.max(1, linesPerChunk - overlapLines);
      lineIndex += advance;
    }

    return chunks;
  }

  /**
   * Optionally enrich chunks with entity extraction (LLM-based)
   * Safe no-op if LLM is unavailable
   */
  private async enrichChunksWithEntities(chunks: DocumentChunk[]): Promise<void> {
    if (!chunks.length) return;

    try {
      const extractor = createEntityExtractor();

      for (const chunk of chunks) {
        try {
          const result = await extractor.extractFromChunk(chunk);
          if (!result) continue;

          const entityMetadata: DocumentEntityMetadata = {
            entities: result.entities.map(e => e.name),
            entityTypes: Object.fromEntries(result.entities.map(e => [e.name, e.type])),
            relationships: result.relationships,
            extractedAt: result.metadata.timestamp,
            extractionModel: result.metadata.model
          };

          chunk.metadata = {
            ...chunk.metadata,
            ...entityMetadata
          };

          // brief rate limit to be gentle with provider
          await new Promise(res => setTimeout(res, 200));
        } catch (err) {
          // continue on individual chunk errors
          console.warn(`⚠️ Failed to extract entities for ${chunk.id}:`, err);
        }
      }
    } catch (e) {
      // If LLM provider is unavailable, skip silently
      console.warn('⚠️ Entity extraction unavailable for documents:', e);
    }
  }

  private generateChunkId(filePath: string, chunkNumber: number, lineStart: number, lineEnd: number): string {
    const fileName = path.basename(filePath);
    return `chunk:${fileName}:${chunkNumber}:${lineStart}-${lineEnd}`;
  }

  static getSupportedExtensions(): string[] {
    return ['.pdf', '.doc', '.docx'];
  }

  static isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.getSupportedExtensions().includes(ext);
  }
}

export function createDocumentParser(): DocumentParser {
  return new DocumentParser();
}
