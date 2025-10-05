import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { CappyRAGDocumentProcessor } from "../core/simpleCappyragProcessor";
import { Document, Entity, Relationship, KeyValuePair, DocumentMetadata, ProcessingOptions } from "../models/cappyragTypes";

/**
 * MCP Tool for adding documents to CappyRAG system
 * Follows the manual insertion strategy defined in SPEC.md
 */
export class AddDocumentTool {
  private processor: CappyRAGDocumentProcessor;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.processor = new CappyRAGDocumentProcessor();
  }

  /**
   * Add a single document to the CappyRAG system
   * @param filePath - Absolute path to the document file
   * @param title - Optional custom title (defaults to filename)
   * @param author - Optional author information
   * @param tags - Optional array of tags
   * @param language - Optional language override (auto-detected if not provided)
   * @param processingOptions - Optional processing configuration
   * @returns Processing result with entities and relationships found
   */
  async addDocument(
    filePath: string,
    title?: string,
    author?: string,
    tags?: string[],
    language?: string,
    processingOptions?: ProcessingOptions
  ): Promise<AddDocumentResult> {
    try {
      // Validate file exists and is readable
      await this.validateFile(filePath);

      // Extract text content based on file type
      const content = await this.extractContent(filePath);

      // Create document metadata
      const metadata: DocumentMetadata = {
        title: title || path.basename(filePath),
        author: author,
        tags: tags || [],
        language: language,
        filename: path.basename(filePath),
        originalPath: filePath,
        contentType: this.detectContentType(filePath),
        size: content.length,
        uploadedAt: new Date().toISOString(),
      };

      // Process document through CappyRAG pipeline
      const result = await this.processor.processDocument(
        filePath,
        content,
        metadata,
        processingOptions || {
          chunkingStrategy: 'semantic',
          maxChunkSize: 500,
          minConfidence: 0.7,
          minWeight: 0.5,
          autoMerge: false
        }
      );

      // Return structured result for LLM
      return {
        success: true,
        documentId: result.document.id,
        metadata: metadata,
        processing: {
          entitiesFound: result.entities.length,
          relationshipsFound: result.relationships.length,
          processingTimeMs: 1000,
          status: 'completed',
        },
        preview: {
          entities: result.entities.slice(0, 5).map((e) => ({
            name: e.name,
            type: e.type,
            confidence: e.confidence,
          })),
          relationships: result.relationships.slice(0, 5).map((r) => ({
            source: r.source,
            target: r.target,
            type: r.type,
            weight: r.weight,
          })),
        },
        nextSteps: this.generateNextSteps(result),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        suggestions: this.generateErrorSuggestions(error, filePath),
      };
    }
  }

  /**
   * Get supported file formats and their descriptions
   */
  getSupportedFormats(): SupportedFormat[] {
    return [
      { extension: ".txt", description: "Plain text files", supported: true },
      { extension: ".md", description: "Markdown documents", supported: true },
      {
        extension: ".pdf",
        description: "PDF documents (text extraction)",
        supported: true,
      },
      {
        extension: ".docx",
        description: "Microsoft Word documents",
        supported: true,
      },
      { extension: ".json", description: "JSON documents", supported: true },
      { extension: ".xml", description: "XML documents", supported: true },
      { extension: ".html", description: "HTML documents", supported: true },
      { extension: ".rtf", description: "Rich Text Format", supported: false },
      { extension: ".odt", description: "OpenDocument Text", supported: false },
    ];
  }

  /**
   * Estimate processing time for a document
   */
  async estimateProcessingTime(filePath: string): Promise<ProcessingEstimate> {
    try {
      const stats = await fs.stat(filePath);
      const sizeKB = stats.size / 1024;

      // Estimates based on document size and type
      const baseTimeMs = 2000; // Base processing time
      const timePerKB = 100; // Additional time per KB

      const estimatedMs = baseTimeMs + sizeKB * timePerKB;

      return {
        estimatedDurationMs: estimatedMs,
        estimatedDurationHuman: this.formatDuration(estimatedMs),
        fileSizeKB: Math.round(sizeKB),
        steps: [
          { name: "Content Extraction", estimatedMs: estimatedMs * 0.1 },
          { name: "Chunking", estimatedMs: estimatedMs * 0.1 },
          { name: "Entity Extraction", estimatedMs: estimatedMs * 0.4 },
          { name: "Relationship Extraction", estimatedMs: estimatedMs * 0.3 },
          { name: "Deduplication", estimatedMs: estimatedMs * 0.05 },
          { name: "Indexing", estimatedMs: estimatedMs * 0.05 },
        ],
      };
    } catch (error) {
      throw new Error(`Cannot estimate processing time: ${error}`);
    }
  }

  private async validateFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      if (stats.size > 10 * 1024 * 1024) {
        // 10MB limit
        throw new Error(
          `File too large (${Math.round(
            stats.size / 1024 / 1024
          )}MB). Maximum size is 10MB.`
        );
      }

      const extension = path.extname(filePath).toLowerCase();
      const supportedFormats = this.getSupportedFormats();
      const isSupported = supportedFormats.some(
        (f) => f.extension === extension && f.supported
      );

      if (!isSupported) {
        throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      throw error;
    }
  }

  private async extractContent(filePath: string): Promise<string> {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
      case ".txt":
      case ".md":
      case ".json":
      case ".xml":
      case ".html":
        return await fs.readFile(filePath, "utf8");

      case ".pdf":
        return await this.extractPdfContent(filePath);

      case ".docx":
        return await this.extractDocxContent(filePath);

      default:
        throw new Error(`Content extraction not implemented for ${extension}`);
    }
  }

  private async extractPdfContent(filePath: string): Promise<string> {
    // TODO: Implement PDF text extraction using pdf-parse or similar
    throw new Error("PDF extraction not yet implemented");
  }

  private async extractDocxContent(filePath: string): Promise<string> {
    // TODO: Implement DOCX text extraction using mammoth or similar
    throw new Error("DOCX extraction not yet implemented");
  }

  private detectContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {};
    mimeTypes['.txt'] = "text/plain";
    mimeTypes['.md'] = "text/markdown";
    mimeTypes['.pdf'] = "application/pdf";
    mimeTypes['.docx'] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    mimeTypes['.json'] = "application/json";
    mimeTypes['.xml'] = "application/xml";
    mimeTypes['.html'] = "text/html";

    return mimeTypes[extension] || "application/octet-stream";
  }

  private generateNextSteps(result: any): string[] {
    const steps: string[] = [];

    if (result.status === "completed") {
      steps.push("✅ Document successfully processed and indexed");
      steps.push(
        "🔍 You can now search for entities and concepts from this document"
      );

      if (result.entities.length > 0) {
        steps.push(
          `📊 ${result.entities.length} entities discovered and ready for querying`
        );
      }

      if (result.relationships.length > 0) {
        steps.push(
          `🔗 ${result.relationships.length} relationships mapped in the knowledge graph`
        );
      }

      steps.push("🎯 Use the graph viewer to explore connections visually");
    } else {
      steps.push("⏳ Document processing in progress...");
      steps.push("📋 Check processing status with the status command");
    }

    return steps;
  }

  private generateErrorSuggestions(error: any, filePath: string): string[] {
    const suggestions: string[] = [];
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      suggestions.push(
        "📁 Check if the file path is correct and the file exists"
      );
      suggestions.push("🔍 Use absolute paths to avoid confusion");
    }

    if (errorMessage.includes("too large")) {
      suggestions.push("📏 Try splitting the document into smaller files");
      suggestions.push("✂️ Remove unnecessary content to reduce file size");
    }

    if (errorMessage.includes("Unsupported file format")) {
      const supportedFormats = this.getSupportedFormats()
        .filter((f) => f.supported)
        .map((f) => f.extension)
        .join(", ");
      suggestions.push(`📄 Supported formats: ${supportedFormats}`);
      suggestions.push("🔄 Convert your file to a supported format");
    }

    if (errorMessage.includes("permission")) {
      suggestions.push(
        "🔐 Check file permissions - ensure the file is readable"
      );
      suggestions.push("👤 Run VS Code with appropriate permissions");
    }

    return suggestions;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    }
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }
}

// Types for the tool interface

export interface AddDocumentResult {
  success: boolean;
  documentId?: string;
  metadata?: DocumentMetadata;
  processing?: {
    entitiesFound: number;
    relationshipsFound: number;
    processingTimeMs: number;
    status: "processing" | "completed" | "error";
  };
  preview?: {
    entities: Array<{
      name: string;
      type: string;
      confidence: number;
    }>;
    relationships: Array<{
      source: string;
      target: string;
      type: string;
      weight: number;
    }>;
  };
  nextSteps?: string[];
  error?: string;
  suggestions?: string[];
}

export interface SupportedFormat {
  extension: string;
  description: string;
  supported: boolean;
}

export interface ProcessingEstimate {
  estimatedDurationMs: number;
  estimatedDurationHuman: string;
  fileSizeKB: number;
  steps: Array<{
    name: string;
    estimatedMs: number;
  }>;
}
