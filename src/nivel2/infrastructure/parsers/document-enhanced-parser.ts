/**
 * @fileoverview Enhanced document parser with entity extraction
 * @module adapters/secondary/parsers/document-enhanced-parser
 * @author Cappy Team
 * @since 3.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import mammoth from 'mammoth';
import type { DocumentChunk } from '../../../shared/types/chunk';
import type { DocumentEntityMetadata } from '../../../shared/types/entity';
import { createASTEntityExtractor } from '../services/entity-extraction';

/**
 * Enhanced document parser with AST-based entity extraction
 * Supports: .md, .mdx, .pdf, .docx, .doc
 */
export class DocumentEnhancedParser {
  private readonly entityExtractor;
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.entityExtractor = createASTEntityExtractor(workspaceRoot);
  }

  /**
   * Initializes the parser (no longer needs async initialization)
   */
  async initialize(): Promise<void> {
    // AST extractor doesn't need async initialization
  }

  /**
   * Parses a document file with entity extraction
   */
  async parseFile(filePath: string, extractEntities = true): Promise<DocumentChunk[]> {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.md':
      case '.mdx':
        return await this.parseMarkdown(filePath, extractEntities);
      
      case '.pdf':
        return await this.parsePDF(filePath, extractEntities);
      
      case '.doc':
      case '.docx':
        return await this.parseWord(filePath, extractEntities);
      
      default:
        console.warn(`⚠️ Unsupported document type: ${ext}`);
        return [];
    }
  }

  /**
   * Parses a Markdown file with entity extraction
   */
  private async parseMarkdown(filePath: string, extractEntities: boolean): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { content: markdownContent } = matter(content);

      // Extract sections with overlap
      const chunks = await this.extractChunksWithOverlap(
        filePath,
        markdownContent,
        512,  // maxTokens
        100   // overlapTokens
      );

      console.log(`📝 Markdown: Extracted ${chunks.length} chunks from ${filePath}`);

      // Extract entities if enabled
      if (extractEntities && chunks.length > 0) {
        await this.initialize();
        await this.enrichChunksWithEntities(chunks);
      }

      return chunks;
    } catch (error) {
      console.error(`❌ Enhanced Markdown parser error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Parses a PDF file with entity extraction
   */
  private async parsePDF(filePath: string, extractEntities: boolean): Promise<DocumentChunk[]> {
    try {
      console.log(`📄 Parsing PDF document: ${filePath}`);

      // Read the PDF file buffer
      const dataBuffer = fs.readFileSync(filePath);

      // Dynamic import for pdf-parse (CommonJS module)
      const pdfParseModule = await import('pdf-parse');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      
      // Extract text using pdf-parse
      const pdfData = await pdfParse(dataBuffer);
      const pdfContent = pdfData.text;

      if (!pdfContent || pdfContent.trim().length === 0) {
        console.warn(`⚠️ No text content extracted from PDF document: ${filePath}`);
        return [];
      }

      console.log(`   📝 Extracted ${pdfContent.length} characters from PDF (${pdfData.numpages} pages)`);
      console.log(`   📊 PDF Info: ${pdfData.info?.Title || 'Untitled'}`);

      // Extract sections with overlap
      const chunks = await this.extractChunksWithOverlap(
        filePath,
        pdfContent,
        512,  // maxTokens
        100   // overlapTokens
      );

      console.log(`📄 PDF: Extracted ${chunks.length} chunks from ${filePath}`);

      // Enrich chunks with PDF-specific metadata
      chunks.forEach((chunk) => {
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
        };
      });

      // Extract entities if enabled
      if (extractEntities && chunks.length > 0) {
        await this.initialize();
        await this.enrichChunksWithEntities(chunks);
      }

      return chunks;
    } catch (error) {
      console.error(`❌ PDF parser error for ${filePath}:`, error);
      
      // Check if error is due to corrupted or password-protected PDF
      if (error instanceof Error) {
        if (error.message.includes('Password')) {
          console.error(`   🔒 PDF is password-protected. Please unlock it first.`);
        } else if (error.message.includes('Invalid PDF')) {
          console.error(`   💡 The file may be corrupted or not a valid PDF format.`);
        }
      }
      
      return [];
    }
  }

  /**
   * Parses a Word document (.doc or .docx) with entity extraction
   */
  private async parseWord(filePath: string, extractEntities: boolean): Promise<DocumentChunk[]> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      // Only .docx is fully supported by mammoth
      if (ext === '.doc') {
        console.warn(`⚠️ .doc format has limited support. Consider converting to .docx: ${filePath}`);
      }

      console.log(`📄 Parsing Word document: ${filePath}`);

      // Read the file buffer
      const buffer = fs.readFileSync(filePath);

      // Extract text using mammoth
      const result = await mammoth.extractRawText({ buffer });
      const wordContent = result.value;

      if (!wordContent || wordContent.trim().length === 0) {
        console.warn(`⚠️ No text content extracted from Word document: ${filePath}`);
        return [];
      }

      console.log(`   📝 Extracted ${wordContent.length} characters from Word document`);

      // Extract sections with overlap
      const chunks = await this.extractChunksWithOverlap(
        filePath,
        wordContent,
        512,  // maxTokens
        100   // overlapTokens
      );

      console.log(`📄 Word: Extracted ${chunks.length} chunks from ${filePath}`);

      // Extract entities if enabled
      if (extractEntities && chunks.length > 0) {
        await this.initialize();
        await this.enrichChunksWithEntities(chunks);
      }

      return chunks;
    } catch (error) {
      console.error(`❌ Word parser error for ${filePath}:`, error);
      
      // Check if error is due to unsupported format
      if (error instanceof Error && error.message.includes('Unsupported file format')) {
        console.error(`   💡 Tip: Make sure the file is a valid .docx or .doc format`);
      }
      
      return [];
    }
  }

  /**
   * Extracts chunks with overlap (sliding window)
   */
  private async extractChunksWithOverlap(
    filePath: string,
    content: string,
    maxTokens: number,
    overlapTokens: number
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const lines = content.split('\n');
    const tokensPerLine = 15; // Rough estimate (adjustable)
    
    const linesPerChunk = Math.floor(maxTokens / tokensPerLine);
    const overlapLines = Math.floor(overlapTokens / tokensPerLine);
    
    let lineIndex = 0;
    let chunkNumber = 0;
    
    while (lineIndex < lines.length) {
      const endLine = Math.min(lineIndex + linesPerChunk, lines.length);
      const chunkLines = lines.slice(lineIndex, endLine);
      const chunkContent = chunkLines.join('\n').trim();
      
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
      
      // Move forward with overlap
      lineIndex += linesPerChunk - overlapLines;
      
      // Ensure we make progress even with large overlap
      if (lineIndex < lines.length && lineIndex + linesPerChunk <= endLine) {
        lineIndex = endLine;
      }
    }
    
    return chunks;
  }

  /**
   * Enriches chunks with entity extraction
   */
  private async enrichChunksWithEntities(chunks: DocumentChunk[]): Promise<void> {
    console.log(`🧠 Extracting entities from ${chunks.length} chunks...`);
    
    const startTime = Date.now();
    
    for (const chunk of chunks) {
      try {
        const extractionResult = await this.entityExtractor.extractFromChunk(chunk);
        
        if (extractionResult) {
          // Add entity metadata to chunk
          const entityMetadata: DocumentEntityMetadata = {
            entities: extractionResult.entities.map((e: { name: unknown; }) => String(e.name)),
            entityTypes: Object.fromEntries(
              extractionResult.entities.map((e: { name: unknown; type: unknown; }) => [e.name, e.type])
            ),
            relationships: extractionResult.relationships,
            extractedAt: extractionResult.metadata.timestamp,
            extractionModel: extractionResult.metadata.model
          };
          
          // Merge with existing metadata
          chunk.metadata = {
            ...chunk.metadata,
            ...entityMetadata
          };
          
          console.log(`   ✨ Chunk ${chunk.id}: ${extractionResult.entities.length} entities, ${extractionResult.relationships.length} relationships`);
        }
        
        // Rate limiting
        await this.delay(300);
      } catch (error) {
        console.error(`❌ Failed to extract entities for chunk ${chunk.id}:`, error);
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Entity extraction completed in ${totalTime}ms`);
  }

  /**
   * Generates a chunk ID
   */
  private generateChunkId(
    filePath: string,
    chunkNumber: number,
    lineStart: number,
    lineEnd: number
  ): string {
    const fileName = path.basename(filePath);
    return `chunk:${fileName}:${chunkNumber}:${lineStart}-${lineEnd}`;
  }

  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets supported file extensions
   */
  static getSupportedExtensions(): string[] {
    return ['.md', '.mdx', '.pdf', '.doc', '.docx'];
  }

  /**
   * Checks if a file is supported
   */
  static isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.getSupportedExtensions().includes(ext);
  }
}

/**
 * Factory function to create enhanced document parser
 */
export function createDocumentEnhancedParser(workspaceRoot: string): DocumentEnhancedParser {
  return new DocumentEnhancedParser(workspaceRoot);
}
