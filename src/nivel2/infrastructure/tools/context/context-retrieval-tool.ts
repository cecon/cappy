/**
 * Context Retrieval Tool - Intelligent context search using HybridRetriever
 * 
 * Provides the Language Model with relevant context from code, docs, rules, and tasks
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { HybridRetriever, type HybridRetrieverOptions, type RetrievedContext } from '../../services/hybrid-retriever';
import { GraphService } from '../../services/graph-service';
import type { GraphData } from '../../../../domains/dashboard/types';

// Tool category constant for metadata
const ToolCategory = {
  CONTEXT: 'context'
} as const;

interface ContextRetrievalInput {
  /**
   * Search query
   */
  query: string;
  
  /**
   * Maximum number of results
   * @default 10
   */
  maxResults?: number;
  
  /**
   * Minimum relevance score (0-1)
   * @default 0.5
   */
  minScore?: number;
  
  /**
   * Sources to search in
   * @default ['code', 'documentation', 'prevention']
   */
  sources?: Array<'code' | 'documentation' | 'prevention' | 'task'>;
  
  /**
   * Category filter
   */
  category?: string;
  
  /**
   * Include related context
   * @default true
   */
  includeRelated?: boolean;
}

/**
 * Language Model Tool for retrieving relevant context
 * 
 * This tool allows the LLM to search across multiple sources:
 * - Code graph (functions, classes, relationships)
 * - Documentation (markdown files, guides)
 * - Prevention rules (categorized rules)
 * - Tasks (active and completed)
 * 
 * Uses HybridRetriever for intelligent multi-source fusion
 */
export class ContextRetrievalTool implements vscode.LanguageModelTool<ContextRetrievalInput> {
  static readonly metadata = {
    id: 'cappy_retrieve_context',
    name: 'Retrieve Context',
    description: 'Searches for relevant context across code, documentation, prevention rules, and tasks. Use this to find information about code patterns, best practices, existing implementations, or related tasks before answering questions or generating code.',
    category: ToolCategory.CONTEXT,
    version: '1.0.0',
    requiresConfirmation: false,
    estimatedDuration: 300
  };

  private retriever: HybridRetriever | null = null;
  private graphService: GraphService | null = null;

  constructor(
    retriever?: HybridRetriever,
    graphService?: GraphService
  ) {
    this.retriever = retriever || null;
    this.graphService = graphService || null;
  }

  /**
   * Updates the retriever instance (for late initialization)
   */
  setRetriever(retriever: HybridRetriever): void {
    this.retriever = retriever;
  }

  /**
   * Updates the graph service instance (for late initialization)
   */
  setGraphService(graphService: GraphService): void {
    this.graphService = graphService;
  }

  /**
   * Initialize the tool with graph data
   */
  async initialize(): Promise<void> {
    try {
      // Load graph data if available
      if (this.graphService) {
        const result = await this.graphService.loadGraph();
        if (result.data) {
          this.retriever = new HybridRetriever(result.data);
        }
      }
      
      // If no graph service, create retriever without graph data
      // It will still work with docs/rules/tasks
      if (!this.retriever) {
        this.retriever = new HybridRetriever();
      }
    } catch (error) {
      console.warn('Failed to initialize context retrieval tool:', error);
      // Create fallback retriever
      this.retriever = new HybridRetriever();
    }
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ContextRetrievalInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    // Validate input exists
    if (!options.input) {
      console.error('[ContextRetrievalTool] Missing input parameters');
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('❌ Error: Missing tool parameters. Please provide a "query" parameter.')
      ]);
    }

    const { query, maxResults, minScore, sources, category, includeRelated } = options.input;

    // Validate required query parameter
    if (!query) {
      console.error('[ContextRetrievalTool] Missing required "query" parameter');
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('❌ Error: Missing required "query" parameter. Example: {"query": "authentication patterns"}')
      ]);
    }

    console.log(`[ContextRetrievalTool] ═══════════════════════════════════════════════`);
    console.log(`[ContextRetrievalTool] INVOKE CALLED`);
    console.log(`[ContextRetrievalTool] Query: "${query}"`);
    console.log(`[ContextRetrievalTool] Options:`, { maxResults, minScore, sources, category, includeRelated });
    console.log(`[ContextRetrievalTool] Retriever initialized: ${!!this.retriever}`);
    console.log(`[ContextRetrievalTool] GraphService initialized: ${!!this.graphService}`);

    try {
      // Ensure retriever is initialized
      if (!this.retriever) {
        console.log('[ContextRetrievalTool] Retriever not initialized, initializing now...');
        await this.initialize();
      }

      if (!this.retriever) {
        console.error('[ContextRetrievalTool] Failed to initialize retriever');
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ Context retrieval not available: retriever not initialized')
        ]);
      }
      
      console.log(`[ContextRetrievalTool] Starting retrieval with options:`, { maxResults, minScore, sources, category, includeRelated });

      // Build retrieval options
      const retrievalOptions: HybridRetrieverOptions = {
        maxResults: maxResults ?? 10,
        minScore: minScore ?? 0.5,
        sources: (sources || ['code', 'documentation']) as ('code' | 'documentation' | 'metadata')[],
        category,
        includeRelated: includeRelated ?? true,
        rerank: true
      };

      // Execute retrieval
      const result = await this.retriever.retrieve(query, retrievalOptions);
      
      console.log(`[ContextRetrievalTool] Retrieval completed: ${result.contexts.length} contexts found in ${result.metadata.retrievalTimeMs}ms`);
      console.log(`[ContextRetrievalTool] Source breakdown:`, result.metadata.sourceBreakdown);

      // Format results for LLM
      if (result.contexts.length === 0) {
        console.log(`[ContextRetrievalTool] No contexts found for query: "${query}"`);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`ℹ️ No relevant context found for: "${query}"`)
        ]);
      }

      // Build formatted response
      const parts: vscode.LanguageModelTextPart[] = [];
      
      // Summary
      parts.push(new vscode.LanguageModelTextPart(
        `📊 Found ${result.contexts.length} relevant contexts (${result.metadata.retrievalTimeMs}ms)\n\n`
      ));

      // Source breakdown
      const breakdown = Object.entries(result.metadata.sourceBreakdown)
        .filter(([, count]) => count > 0)
        .map(([source, count]) => `${source}: ${count}`)
        .join(', ');
      
      if (breakdown) {
        parts.push(new vscode.LanguageModelTextPart(`📁 Sources: ${breakdown}\n\n`));
      }

      // Contexts
      parts.push(new vscode.LanguageModelTextPart('---\n\n'));
      
      for (const ctx of result.contexts) {
        const sourceIcon = this.getSourceIcon(ctx.source);
        const score = (ctx.score * 100).toFixed(0);
        
        parts.push(new vscode.LanguageModelTextPart(
          `${sourceIcon} **${ctx.metadata.title || ctx.id}** (${score}% relevant)\n`
        ));
        
        if (ctx.metadata.category) {
          parts.push(new vscode.LanguageModelTextPart(`📂 Category: ${ctx.metadata.category}\n`));
        }
        
        if (ctx.filePath) {
          parts.push(new vscode.LanguageModelTextPart(`📄 File: \`${ctx.filePath}\`\n`));
        }
        
        if (ctx.metadata.lineStart && ctx.metadata.lineEnd) {
          parts.push(new vscode.LanguageModelTextPart(
            `📍 Lines: ${ctx.metadata.lineStart}-${ctx.metadata.lineEnd}\n`
          ));
        }
        
        if (ctx.metadata.keywords && ctx.metadata.keywords.length > 0) {
          const keywords = ctx.metadata.keywords.slice(0, 5).join(', ');
          parts.push(new vscode.LanguageModelTextPart(`🏷️ Keywords: ${keywords}\n`));
        }
        
        parts.push(new vscode.LanguageModelTextPart('\n**Content:**\n'));
        
        // Enrich minimal content by reading surrounding code
        const enrichedContent = await this.enrichContext(ctx);
        
        // Determine which content to use
        let content: string;
        if (enrichedContent === ctx.content) {
          // Not enriched, use snippet or truncated content
          if (ctx.snippet) {
            content = ctx.snippet;
          } else if (ctx.content.length > 500) {
            content = ctx.content.substring(0, 500) + '...';
          } else {
            content = ctx.content;
          }
        } else {
          // Use enriched content
          content = enrichedContent;
        }
        
        // Add language hint for code blocks
        const language = ctx.metadata.language || '';
        const codeBlockPart = `\`\`\`${language}\n${content}\n\`\`\`\n\n---\n\n`;
        parts.push(new vscode.LanguageModelTextPart(codeBlockPart));
      }

      return new vscode.LanguageModelToolResult(parts);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error retrieving context: ${errorMessage}`)
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ContextRetrievalInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    // Validate input exists
    if (!options.input) {
      return {
        invocationMessage: 'Error: Missing tool parameters',
      };
    }

    const { query, sources } = options.input;
    
    // Validate required query parameter
    if (!query) {
      return {
        invocationMessage: 'Error: Missing required "query" parameter',
      };
    }

    const sourcesText = sources?.join(', ') || 'all sources';
    
    return {
      invocationMessage: `Searching ${sourcesText} for: "${query}"`,
    };
  }

  /**
   * Update graph data
   */
  setGraphData(graphData: GraphData): void {
    if (!this.retriever) {
      this.retriever = new HybridRetriever(graphData);
    } else {
      this.retriever.setGraphData(graphData);
    }
  }

  /**
   * Get icon for context source
   */
  private getSourceIcon(source: string): string {
    switch (source) {
      case 'code':
        return '💻';
      case 'documentation':
        return '📚';
      case 'prevention':
        return '🛡️';
      case 'task':
        return '✅';
      default:
        return '📄';
    }
  }

  /**
   * Enrich context by reading surrounding code lines when content is minimal
   * @param ctx Retrieved context to enrich
   * @returns Enriched content or original content if enrichment fails
   */
  private async enrichContext(ctx: RetrievedContext): Promise<string> {
    // Only enrich code contexts with file paths and line information
    if (ctx.source !== 'code' || !ctx.filePath || !ctx.metadata.lineStart) {
      return ctx.content;
    }

    // Check if content is minimal (less than 150 characters or very few lines)
    const isMinimalContent = ctx.content.length < 150 || 
                             ctx.content.split('\n').length < 5;
    
    if (!isMinimalContent) {
      return ctx.content;
    }

    try {
      // Read the file from workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return ctx.content;
      }

      // Find the file in workspace
      let fullPath = ctx.filePath;
      if (!path.isAbsolute(fullPath)) {
        fullPath = path.join(workspaceFolders[0].uri.fsPath, ctx.filePath);
      }

      // Read the file
      const fileContent = await fs.readFile(fullPath, 'utf-8');
      const lines = fileContent.split('\n');

      // Calculate expanded range (add context lines before and after)
      const contextLines = 5; // Add 5 lines before and after
      const startLine = Math.max(0, (ctx.metadata.lineStart || 1) - contextLines - 1);
      const endLine = Math.min(lines.length, (ctx.metadata.lineEnd || startLine + 1) + contextLines);

      // Extract expanded content
      const enrichedLines = lines.slice(startLine, endLine);
      const enrichedContent = enrichedLines.join('\n');

      console.log(`[ContextRetrievalTool] Enriched context for ${ctx.filePath}:${ctx.metadata.lineStart} from ${ctx.content.length} to ${enrichedContent.length} chars`);

      return enrichedContent;
    } catch (error) {
      console.warn(`[ContextRetrievalTool] Failed to enrich context for ${ctx.filePath}:`, error);
      return ctx.content;
    }
  }
}
