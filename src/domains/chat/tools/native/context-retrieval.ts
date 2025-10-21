/**
 * Context Retrieval Tool - Intelligent context search using HybridRetriever
 * 
 * Provides the Language Model with relevant context from code, docs, rules, and tasks
 */

import * as vscode from 'vscode';
import { ToolCategory } from '../types';
import { HybridRetriever, type HybridRetrieverOptions } from '../../../../services/hybrid-retriever';
import { GraphService } from '../../../../services/graph-service';
import type { GraphData } from '../../../../domains/graph/types';

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
    const { query, maxResults, minScore, sources, category, includeRelated } = options.input;

    try {
      // Ensure retriever is initialized
      if (!this.retriever) {
        await this.initialize();
      }

      if (!this.retriever) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ Context retrieval not available: retriever not initialized')
        ]);
      }

      // Build retrieval options
      const retrievalOptions: HybridRetrieverOptions = {
        maxResults: maxResults ?? 10,
        minScore: minScore ?? 0.5,
        sources: (sources || ['code', 'documentation', 'prevention']) as ('code' | 'documentation' | 'prevention' | 'task' | 'metadata')[],
        category,
        includeRelated: includeRelated ?? true,
        rerank: true
      };

      // Execute retrieval
      const result = await this.retriever.retrieve(query, retrievalOptions);

      // Format results for LLM
      if (result.contexts.length === 0) {
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
        
        if (ctx.metadata.keywords && ctx.metadata.keywords.length > 0) {
          const keywords = ctx.metadata.keywords.slice(0, 5).join(', ');
          parts.push(new vscode.LanguageModelTextPart(`🏷️ Keywords: ${keywords}\n`));
        }
        
        parts.push(new vscode.LanguageModelTextPart('\n**Content:**\n'));
        
        // Use snippet if available, otherwise use truncated content
        const content = ctx.snippet || (ctx.content.length > 500 
          ? ctx.content.substring(0, 500) + '...' 
          : ctx.content);
        
        parts.push(new vscode.LanguageModelTextPart(`\`\`\`\n${content}\n\`\`\`\n\n`));
        parts.push(new vscode.LanguageModelTextPart('---\n\n'));
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
    const { query, sources } = options.input;
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
}
