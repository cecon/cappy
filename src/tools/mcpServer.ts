import * as vscode from 'vscode';
import { AddDocumentTool, AddDocumentResult } from './addDocumentTool';

/**
 * MCP Server for exposing LightRAG tools to LLMs
 * Based on Model Context Protocol specification
 */
export class LightRAGMCPServer {
    private addDocumentTool: AddDocumentTool;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.addDocumentTool = new AddDocumentTool(context);
    }

    /**
     * Register MCP tools with VS Code LM Tools API
     */
    registerTools(): void {
        // Register commands that can be called by LLMs
        this.context.subscriptions.push(
            vscode.commands.registerCommand('lightrag.addDocument', this.handleAddDocument.bind(this)),
            vscode.commands.registerCommand('lightrag.getSupportedFormats', this.handleGetSupportedFormats.bind(this)),
            vscode.commands.registerCommand('lightrag.estimateProcessingTime', this.handleEstimateProcessingTime.bind(this))
        );

        console.log('Registered LightRAG MCP commands');
    }

    private async handleAddDocument(
        filePath: string,
        title?: string,
        author?: string,
        tags?: string[],
        language?: string,
        processingOptions?: any
    ): Promise<string> {
        try {
            const result = await this.addDocumentTool.addDocument(
                filePath,
                title,
                author,
                tags,
                language,
                processingOptions
            );

            return this.formatAddDocumentResponse(result);

        } catch (error) {
            return `Error processing document: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    private async handleGetSupportedFormats(): Promise<string> {
        try {
            const formats = this.addDocumentTool.getSupportedFormats();
            
            const supportedFormats = formats.filter(f => f.supported);
            const unsupportedFormats = formats.filter(f => !f.supported);

            let response = `📄 **Supported Document Formats:**\n\n`;
            
            response += `✅ **Currently Supported (${supportedFormats.length} formats):**\n`;
            for (const format of supportedFormats) {
                response += `  • ${format.extension} - ${format.description}\n`;
            }

            if (unsupportedFormats.length > 0) {
                response += `\n⏳ **Coming Soon (${unsupportedFormats.length} formats):**\n`;
                for (const format of unsupportedFormats) {
                    response += `  • ${format.extension} - ${format.description}\n`;
                }
            }

            response += `\n💡 **Tips:**\n`;
            response += `  • Maximum file size: 10MB\n`;
            response += `  • Use absolute file paths\n`;
            response += `  • Ensure files are readable\n`;
            response += `  • Plain text formats work best\n`;

            return response;

        } catch (error) {
            return `Error getting supported formats: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    private async handleEstimateProcessingTime(filePath: string): Promise<string> {
        try {
            const estimate = await this.addDocumentTool.estimateProcessingTime(filePath);

            let response = `⏱️ **Processing Time Estimate for Document**\n\n`;
            response += `📁 **File:** ${filePath}\n`;
            response += `📏 **Size:** ${estimate.fileSizeKB} KB\n`;
            response += `⏰ **Total Estimated Time:** ${estimate.estimatedDurationHuman}\n\n`;

            response += `📋 **Processing Steps:**\n`;
            for (const step of estimate.steps) {
                const duration = this.formatDuration(step.estimatedMs);
                response += `  • ${step.name}: ~${duration}\n`;
            }

            response += `\n💡 **Notes:**\n`;
            response += `  • Estimates are approximate and may vary\n`;
            response += `  • Larger documents take proportionally longer\n`;
            response += `  • LLM processing speed depends on complexity\n`;
            response += `  • First-time processing may take longer\n`;

            return response;

        } catch (error) {
            return `Error estimating processing time: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    private formatAddDocumentResponse(result: AddDocumentResult): string {
        if (!result.success) {
            let response = `❌ **Document Processing Failed**\n\n`;
            response += `**Error:** ${result.error}\n\n`;
            
            if (result.suggestions && result.suggestions.length > 0) {
                response += `**Suggestions:**\n`;
                for (const suggestion of result.suggestions) {
                    response += `  ${suggestion}\n`;
                }
            }
            
            return response;
        }

        let response = `✅ **Document Successfully Processed**\n\n`;
        
        if (result.metadata) {
            response += `📄 **Document Information:**\n`;
            response += `  • Title: ${result.metadata.title}\n`;
            response += `  • Size: ${Math.round(result.metadata.size / 1024)} KB\n`;
            if (result.metadata.author) {
                response += `  • Author: ${result.metadata.author}\n`;
            }
            if (result.metadata.tags && result.metadata.tags.length > 0) {
                response += `  • Tags: ${result.metadata.tags.join(', ')}\n`;
            }
            response += `\n`;
        }

        if (result.processing) {
            response += `📊 **Processing Results:**\n`;
            response += `  • Entities Found: ${result.processing.entitiesFound}\n`;
            response += `  • Relationships Found: ${result.processing.relationshipsFound}\n`;
            response += `  • Processing Time: ${this.formatDuration(result.processing.processingTimeMs)}\n`;
            response += `  • Status: ${result.processing.status}\n\n`;
        }

        if (result.preview) {
            if (result.preview.entities.length > 0) {
                response += `🏷️ **Sample Entities Discovered:**\n`;
                for (const entity of result.preview.entities) {
                    response += `  • ${entity.name} (${entity.type}) - ${Math.round(entity.confidence * 100)}% confidence\n`;
                }
                response += `\n`;
            }

            if (result.preview.relationships.length > 0) {
                response += `🔗 **Sample Relationships Discovered:**\n`;
                for (const rel of result.preview.relationships) {
                    response += `  • ${rel.source} ${rel.type} ${rel.target} (strength: ${Math.round(rel.weight * 100)}%)\n`;
                }
                response += `\n`;
            }
        }

        if (result.nextSteps && result.nextSteps.length > 0) {
            response += `🎯 **Next Steps:**\n`;
            for (const step of result.nextSteps) {
                response += `  ${step}\n`;
            }
        }

        return response;
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

    /**
     * Get tool descriptions for LLM consumption
     */
    getToolDescriptions(): string {
        return `
🛠️ **Available LightRAG Tools:**

1. **lightrag_add_document** - Add a single document to the knowledge base
   • Processes documents through entity extraction and relationship mapping
   • Supports: .txt, .md, .pdf, .docx, .json, .xml, .html
   • Returns: Entities found, relationships mapped, processing status
   • Use for: Adding new documents to build your knowledge graph

2. **lightrag_get_supported_formats** - Get supported file formats
   • Lists all supported and planned file formats
   • Includes format descriptions and requirements
   • Use for: Checking compatibility before upload

3. **lightrag_estimate_processing_time** - Estimate processing duration
   • Analyzes file size and complexity
   • Provides step-by-step time breakdown
   • Use for: Planning document uploads and setting expectations

**Example Usage:**
\`\`\`
// Add a research paper to the knowledge base
lightrag_add_document({
  "filePath": "/path/to/research-paper.pdf",
  "title": "AI Research Paper",
  "tags": ["ai", "research", "machine-learning"],
  "processingOptions": {
    "entityTypes": ["Person", "Technology", "Concept"],
    "minConfidence": 0.7
  }
})
\`\`\`

**Best Practices:**
• Use absolute file paths
• Add relevant tags for better organization
• Set appropriate confidence thresholds
• Review entities and relationships after processing
• Use the graph viewer to explore connections
        `.trim();
    }
}