/**
 * @fileoverview Hybrid Retriever - Powerful context retrieval combining multiple strategies
 * @module services/hybrid-retriever
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { GraphData, GraphNode } from '../domains/graph/types';
import { SearchGraphUseCase, type SearchGraphOptions } from '../domains/graph/use-cases';

/**
 * Index entry from docs/rules/tasks indexes
 */
interface IndexEntry {
  id: string;
  title: string;
  path: string;
  content: string;
  category: string;
  keywords: string[];
  lastModified: string;
  type?: string;
}

/**
 * Source of retrieved context
 */
export type ContextSource = 
  | 'code'           // From code graph
  | 'documentation'  // From docs index
  | 'task'          // From tasks
  | 'prevention'    // From prevention rules
  | 'metadata';     // From file metadata

/**
 * Retrieved context item
 */
export interface RetrievedContext {
  /**
   * Unique identifier
   */
  id: string;
  
  /**
   * Content of the context
   */
  content: string;
  
  /**
   * Source type
   */
  source: ContextSource;
  
  /**
   * Relevance score (0-1)
   */
  score: number;
  
  /**
   * File path (if applicable)
   */
  filePath?: string;
  
  /**
   * Metadata about the context
   */
  metadata: {
    title?: string;
    category?: string;
    keywords?: string[];
    type?: string;
    lastModified?: string;
  };
  
  /**
   * Snippet highlighting the match
   */
  snippet?: string;
}

/**
 * Retrieval strategy
 */
export type RetrievalStrategy = 
  | 'hybrid'      // Combines all strategies with weighted scoring
  | 'semantic'    // Semantic similarity only
  | 'keyword'     // Keyword matching only
  | 'graph'       // Graph-based traversal
  | 'vector';     // Vector similarity (if available)

/**
 * Options for hybrid retrieval
 */
export interface HybridRetrieverOptions {
  /**
   * Retrieval strategy
   * @default 'hybrid'
   */
  strategy?: RetrievalStrategy;
  
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
  sources?: ContextSource[];
  
  /**
   * Weight for code results (0-1)
   * @default 0.4
   */
  codeWeight?: number;
  
  /**
   * Weight for documentation results (0-1)
   * @default 0.3
   */
  docWeight?: number;
  
  /**
   * Weight for prevention rules (0-1)
   * @default 0.2
   */
  preventionWeight?: number;
  
  /**
   * Weight for tasks (0-1)
   * @default 0.1
   */
  taskWeight?: number;
  
  /**
   * Enable re-ranking
   * @default true
   */
  rerank?: boolean;
  
  /**
   * Include related context
   * @default true
   */
  includeRelated?: boolean;
  
  /**
   * Filter by category
   */
  category?: string;
  
  /**
   * Filter by file types
   */
  fileTypes?: string[];
}

/**
 * Result of hybrid retrieval
 */
export interface HybridRetrieverResult {
  /**
   * Retrieved contexts, sorted by relevance
   */
  contexts: RetrievedContext[];
  
  /**
   * Metadata about the retrieval
   */
  metadata: {
    /**
     * Query that was executed
     */
    query: string;
    
    /**
     * Strategy used
     */
    strategy: RetrievalStrategy;
    
    /**
     * Total contexts found (before limiting)
     */
    totalFound: number;
    
    /**
     * Number of contexts returned
     */
    returned: number;
    
    /**
     * Breakdown by source
     */
    sourceBreakdown: Record<ContextSource, number>;
    
    /**
     * Time taken (in milliseconds)
     */
    retrievalTimeMs: number;
    
    /**
     * Whether results were re-ranked
     */
    reranked: boolean;
  };
}

/**
 * Hybrid Retriever - Combines multiple retrieval strategies for powerful context discovery
 * 
 * This retriever intelligently searches across:
 * - Code graph (semantic + structural relationships)
 * - Documentation index (markdown files, guides)
 * - Tasks (active and completed)
 * - Prevention rules (categorized rules)
 * 
 * Features:
 * - Multi-source fusion with weighted scoring
 * - Intelligent re-ranking based on query-context relevance
 * - Graph-based expansion for related context
 * - Category-aware filtering
 * 
 * @example
 * ```typescript
 * const retriever = new HybridRetriever(graphData);
 * 
 * // Basic retrieval
 * const result = await retriever.retrieve('JWT authentication');
 * 
 * // Advanced retrieval with custom weights
 * const advanced = await retriever.retrieve('database migration', {
 *   strategy: 'hybrid',
 *   maxResults: 20,
 *   codeWeight: 0.5,
 *   docWeight: 0.3,
 *   category: 'database'
 * });
 * 
 * // Get contexts for specific sources
 * const docsOnly = await retriever.retrieve('API design', {
 *   sources: ['documentation'],
 *   minScore: 0.7
 * });
 * ```
 */
export class HybridRetriever {
  private graphData: GraphData | null = null;
  private searchUseCase: SearchGraphUseCase;
  private workspaceRoot: string | null = null;
  private graphStore: import('../domains/graph/ports/indexing-port').GraphStorePort | null = null;
  
  constructor(graphData?: GraphData, graphStore?: import('../domains/graph/ports/indexing-port').GraphStorePort) {
    this.graphData = graphData || null;
    this.graphStore = graphStore || null;
    this.searchUseCase = new SearchGraphUseCase();
    
    console.log(`[HybridRetriever] Constructor: graphData=${!!graphData}, graphStore=${!!graphStore}`);
    
    // Initialize workspace root
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      this.workspaceRoot = workspaceFolder.uri.fsPath;
      console.log(`[HybridRetriever] Workspace root: ${this.workspaceRoot}`);
    }
  }
  
  /**
   * Sets or updates the graph data
   */
  setGraphData(graphData: GraphData): void {
    this.graphData = graphData;
  }
  
  /**
   * Retrieves relevant context for a query
   * 
   * @param query - Search query
   * @param options - Retrieval options
   * @returns Promise resolving to retrieval result
   * @throws {Error} When retrieval fails
   */
  async retrieve(
    query: string,
    options: HybridRetrieverOptions = {}
  ): Promise<HybridRetrieverResult> {
    const startTime = Date.now();
    
    console.log(`[HybridRetriever] retrieve() called with query: "${query}"`);
    console.log(`[HybridRetriever] graphStore available: ${!!this.graphStore}`);
    
    try {
      // Validate input
      if (!query || query.trim().length === 0) {
        throw new Error('Query cannot be empty');
      }
      
      // Set defaults
      const strategy = options.strategy ?? 'hybrid';
      const maxResults = options.maxResults ?? 10;
      const minScore = options.minScore ?? 0.5;
      const sources = options.sources ?? ['code', 'documentation', 'prevention'];
      const rerank = options.rerank ?? true;
      
      console.log(`[HybridRetriever] Options: strategy=${strategy}, maxResults=${maxResults}, minScore=${minScore}, sources=${sources.join(',')}`);
      
      // Execute retrieval based on strategy
      let allContexts: RetrievedContext[] = [];
      
      if (strategy === 'hybrid' || strategy === 'semantic') {
        // Search all enabled sources
        const retrievalPromises: Promise<RetrievedContext[]>[] = [];
        
        if (sources.includes('code')) {
          retrievalPromises.push(this.retrieveFromCode(query, options));
        }
        
        if (sources.includes('documentation')) {
          retrievalPromises.push(this.retrieveFromDocs(query, options));
        }
        
        if (sources.includes('prevention')) {
          retrievalPromises.push(this.retrieveFromPrevention(query, options));
        }
        
        if (sources.includes('task')) {
          retrievalPromises.push(this.retrieveFromTasks(query, options));
        }
        
        // Execute all retrievals in parallel
        const results = await Promise.all(retrievalPromises);
        allContexts = results.flat();
      } else if (strategy === 'graph') {
        // Graph-based only
        allContexts = await this.retrieveFromCode(query, options);
      } else if (strategy === 'keyword') {
        // Keyword-based search across all sources
        allContexts = await this.keywordSearch(query, options);
      }
      
      // Apply weighted scoring
      allContexts = this.applyWeightedScoring(allContexts, options);
      
      // Filter by minimum score
      allContexts = allContexts.filter(ctx => ctx.score >= minScore);
      
      // Re-rank if enabled
      if (rerank && allContexts.length > 0) {
        allContexts = await this.rerank(query, allContexts, options);
      }
      
      // Sort by score descending
      allContexts.sort((a, b) => b.score - a.score);
      
      // Limit results
      const totalFound = allContexts.length;
      const contexts = allContexts.slice(0, maxResults);
      
      // Calculate source breakdown
      const sourceBreakdown = this.calculateSourceBreakdown(contexts);
      
      const retrievalTimeMs = Date.now() - startTime;
      
      return {
        contexts,
        metadata: {
          query,
          strategy,
          totalFound,
          returned: contexts.length,
          sourceBreakdown,
          retrievalTimeMs,
          reranked: rerank
        }
      };
    } catch (error) {
      throw new Error(`Hybrid retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieves context from code graph
   */
  private async retrieveFromCode(
    query: string,
    options: HybridRetrieverOptions
  ): Promise<RetrievedContext[]> {
    // Use graphStore if available
    if (this.graphStore) {
      try {
        console.log(`[HybridRetriever] Retrieving from code with query: "${query}"`);
        const queryLower = query.toLowerCase();
        const queryTokens = queryLower.split(/\s+/);
        
        // Get larger subgraph to search across more nodes (undefined seeds = all nodes up to maxNodes)
        const maxNodesToFetch = Math.max(500, (options.maxResults ?? 10) * 50);
        const subgraph = await this.graphStore.getSubgraph(undefined, 2, maxNodesToFetch);
        console.log(`[HybridRetriever] Got subgraph with ${subgraph.nodes.length} nodes, ${subgraph.edges.length} edges`);
        
        // Filter and score nodes based on query match
        const results: RetrievedContext[] = [];
        let matchedCount = 0;
        let filteredCount = 0;
        
        for (const node of subgraph.nodes) {
          const labelLower = node.label.toLowerCase();
          const idLower = node.id.toLowerCase();
          
          // Calculate score based on matches
          let score = 0;
          for (const token of queryTokens) {
            if (labelLower.includes(token)) score += 0.4;
            if (idLower.includes(token)) score += 0.3;
          }
          
          if (score > 0) {
            matchedCount++;
            if (score >= 0.3) {
              filteredCount++;
            }
          }
          
          // Minimum threshold
          if (score < 0.3) continue;
          
          score = Math.min(score, 1.0);
          
          // Extract file path from node ID (format: "file.ts:startLine-endLine")
          const filePath = node.id.includes(':') ? node.id.split(':')[0] : undefined;
          
          results.push({
            id: node.id,
            content: node.label,
            source: 'code' as ContextSource,
            score,
            filePath,
            metadata: {
              title: node.label,
              category: node.type,
              keywords: [],
              lastModified: new Date().toISOString()
            },
            snippet: node.label
          });
        }
        
        console.log(`[HybridRetriever] Matched ${matchedCount} nodes, ${filteredCount} passed threshold, returning ${results.length} results`);
        
        return results.sort((a, b) => b.score - a.score);
      } catch (error) {
        console.warn('Failed to retrieve from graph store:', error);
        return [];
      }
    }
    
    // Fallback to graphData if available
    if (!this.graphData) {
      return [];
    }
    
    try {
      const searchOptions: SearchGraphOptions = {
        mode: 'fuzzy',
        searchLabels: true,
        searchIds: true,
        searchMetadata: true,
        maxResults: options.maxResults ?? 10,
        minScore: 0.3,
        includeRelated: options.includeRelated ?? true,
        relatedDepth: 1
      };
      
      const searchResult = await this.searchUseCase.execute(
        this.graphData,
        query,
        searchOptions
      );
      
      return searchResult.results
        .filter(item => item.type === 'node')
        .map(item => {
          const node = item.item as GraphNode;
          return {
            id: node.id,
            content: this.extractNodeContent(node),
            source: 'code' as ContextSource,
            score: item.score,
            filePath: node.metadata?.filePath as string | undefined,
            metadata: {
              title: node.label,
              type: node.type,
              keywords: this.extractKeywords(node)
            },
            snippet: item.snippet
          };
        });
    } catch (error) {
      console.warn('Failed to retrieve from code graph:', error);
      return [];
    }
  }
  
  /**
   * Retrieves context from documentation index
   */
  private async retrieveFromDocs(
    query: string,
    options: HybridRetrieverOptions
  ): Promise<RetrievedContext[]> {
    if (!this.workspaceRoot) {
      return [];
    }
    
    try {
      const docsIndexPath = path.join(this.workspaceRoot, '.cappy', 'indexes', 'docs.json');
      
      if (!fs.existsSync(docsIndexPath)) {
        return [];
      }
      
      const docsIndex = JSON.parse(await fs.promises.readFile(docsIndexPath, 'utf8'));
      const docs = docsIndex.docs || [];
      
      // Search docs using fuzzy matching
      const queryLower = query.toLowerCase();
      const queryTokens = queryLower.split(/\s+/);
      
      return docs
        .map((doc: IndexEntry) => {
          const score = this.calculateDocScore(doc, queryTokens, options);
          
          if (score < 0.3) {
            return null;
          }
          
          return {
            id: doc.id,
            content: doc.content || '',
            source: 'documentation' as ContextSource,
            score,
            filePath: doc.path,
            metadata: {
              title: doc.title,
              category: doc.category,
              keywords: doc.keywords || [],
              lastModified: doc.lastModified
            },
            snippet: this.extractSnippet(doc.content || '', queryTokens)
          };
        })
        .filter((ctx: RetrievedContext | null): ctx is RetrievedContext => ctx !== null);
    } catch (error) {
      console.warn('Failed to retrieve from docs:', error);
      return [];
    }
  }
  
  /**
   * Retrieves context from prevention rules
   */
  private async retrieveFromPrevention(
    query: string,
    options: HybridRetrieverOptions
  ): Promise<RetrievedContext[]> {
    if (!this.workspaceRoot) {
      return [];
    }
    
    try {
      const rulesIndexPath = path.join(this.workspaceRoot, '.cappy', 'indexes', 'rules.json');
      
      if (!fs.existsSync(rulesIndexPath)) {
        return [];
      }
      
      const rulesIndex = JSON.parse(await fs.promises.readFile(rulesIndexPath, 'utf8'));
      const rules = rulesIndex.rules || [];
      
      // Search rules
      const queryLower = query.toLowerCase();
      const queryTokens = queryLower.split(/\s+/);
      
      return rules
        .map((rule: IndexEntry) => {
          const score = this.calculateDocScore(rule, queryTokens, options);
          
          if (score < 0.3) {
            return null;
          }
          
          return {
            id: rule.id,
            content: rule.content || '',
            source: 'prevention' as ContextSource,
            score,
            filePath: rule.path,
            metadata: {
              title: rule.title,
              category: rule.category,
              keywords: rule.keywords || [],
              lastModified: rule.lastModified
            },
            snippet: this.extractSnippet(rule.content || '', queryTokens)
          };
        })
        .filter((ctx: RetrievedContext | null): ctx is RetrievedContext => ctx !== null);
    } catch (error) {
      console.warn('Failed to retrieve from prevention rules:', error);
      return [];
    }
  }
  
  /**
   * Retrieves context from tasks
   */
  private async retrieveFromTasks(
    query: string,
    options: HybridRetrieverOptions
  ): Promise<RetrievedContext[]> {
    if (!this.workspaceRoot) {
      return [];
    }
    
    try {
      const tasksIndexPath = path.join(this.workspaceRoot, '.cappy', 'indexes', 'tasks.json');
      
      if (!fs.existsSync(tasksIndexPath)) {
        return [];
      }
      
      const tasksIndex = JSON.parse(await fs.promises.readFile(tasksIndexPath, 'utf8'));
      const tasks = tasksIndex.tasks || [];
      
      // Search tasks
      const queryLower = query.toLowerCase();
      const queryTokens = queryLower.split(/\s+/);
      
      return tasks
        .map((task: IndexEntry) => {
          const score = this.calculateDocScore(task, queryTokens, options);
          
          if (score < 0.3) {
            return null;
          }
          
          return {
            id: task.id,
            content: task.content || '',
            source: 'task' as ContextSource,
            score,
            filePath: task.path,
            metadata: {
              title: task.title,
              category: task.category,
              keywords: task.keywords || [],
              lastModified: task.lastModified
            },
            snippet: this.extractSnippet(task.content || '', queryTokens)
          };
        })
        .filter((ctx: RetrievedContext | null): ctx is RetrievedContext => ctx !== null);
    } catch (error) {
      console.warn('Failed to retrieve from tasks:', error);
      return [];
    }
  }
  
  /**
   * Performs keyword-based search across all sources
   */
  private async keywordSearch(
    query: string,
    options: HybridRetrieverOptions
  ): Promise<RetrievedContext[]> {
    const sources = options.sources ?? ['code', 'documentation', 'prevention'];
    const results: Promise<RetrievedContext[]>[] = [];
    
    if (sources.includes('documentation')) {
      results.push(this.retrieveFromDocs(query, options));
    }
    
    if (sources.includes('prevention')) {
      results.push(this.retrieveFromPrevention(query, options));
    }
    
    if (sources.includes('task')) {
      results.push(this.retrieveFromTasks(query, options));
    }
    
    const allResults = await Promise.all(results);
    return allResults.flat();
  }
  
  /**
   * Applies weighted scoring based on source
   */
  private applyWeightedScoring(
    contexts: RetrievedContext[],
    options: HybridRetrieverOptions
  ): RetrievedContext[] {
    // Count available sources
    const availableSources = new Set(contexts.map(ctx => ctx.source));
    const sourceCount = availableSources.size;
    
    // If only one source, don't apply penalties (use weight = 1.0)
    // This prevents filtering out results when searching only code, for example
    const weights = {
      code: sourceCount === 1 ? 1.0 : (options.codeWeight ?? 0.4),
      documentation: sourceCount === 1 ? 1.0 : (options.docWeight ?? 0.3),
      prevention: sourceCount === 1 ? 1.0 : (options.preventionWeight ?? 0.2),
      task: sourceCount === 1 ? 1.0 : (options.taskWeight ?? 0.1),
      metadata: 0.0
    };
    
    return contexts.map(ctx => ({
      ...ctx,
      score: ctx.score * weights[ctx.source]
    }));
  }
  
  /**
   * Re-ranks contexts based on query relevance
   */
  private async rerank(
    query: string,
    contexts: RetrievedContext[],
    options: HybridRetrieverOptions
  ): Promise<RetrievedContext[]> {
    // Advanced re-ranking using multiple signals:
    // 1. Query-context semantic similarity (approximated by keyword overlap)
    // 2. Recency (if lastModified available)
    // 3. Category match (if category filter provided)
    // 4. Content quality (length, structure)
    
    const queryTokens = query.toLowerCase().split(/\s+/);
    
    return contexts.map(ctx => {
      let boostFactor = 1.0;
      
      // Boost by keyword overlap
      const contentLower = ctx.content.toLowerCase();
      const matchCount = queryTokens.filter(token => contentLower.includes(token)).length;
      const overlapRatio = matchCount / queryTokens.length;
      boostFactor *= (1 + overlapRatio * 0.5);
      
      // Boost by category match
      if (options.category && ctx.metadata.category === options.category) {
        boostFactor *= 1.3;
      }
      
      // Boost recent content
      if (ctx.metadata.lastModified) {
        const modifiedDate = new Date(ctx.metadata.lastModified);
        const daysSinceModified = (Date.now() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 30) {
          boostFactor *= 1.2;
        } else if (daysSinceModified < 90) {
          boostFactor *= 1.1;
        }
      }
      
      // Boost by content quality (prefer well-structured content)
      if (ctx.content.length > 200 && ctx.content.length < 2000) {
        boostFactor *= 1.1;
      }
      
      return {
        ...ctx,
        score: Math.min(ctx.score * boostFactor, 1.0)
      };
    });
  }
  
  /**
   * Calculates relevance score for a document
   */
  private calculateDocScore(
    doc: IndexEntry,
    queryTokens: string[],
    options: HybridRetrieverOptions
  ): number {
    let score = 0;
    const content = (doc.content || '').toLowerCase();
    const title = (doc.title || '').toLowerCase();
    const keywords = (doc.keywords || []).map((k: string) => k.toLowerCase());
    
    // Title matches (highest weight)
    for (const token of queryTokens) {
      if (title.includes(token)) {
        score += 0.4;
      }
    }
    
    // Keyword matches
    for (const token of queryTokens) {
      if (keywords.some((kw: string) => kw.includes(token))) {
        score += 0.3;
      }
    }
    
    // Content matches
    for (const token of queryTokens) {
      if (content.includes(token)) {
        score += 0.2;
      }
    }
    
    // Category match bonus
    if (options.category && doc.category === options.category) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Extracts content snippet highlighting query matches
   */
  private extractSnippet(content: string, queryTokens: string[]): string {
    const maxSnippetLength = 200;
    const contentLower = content.toLowerCase();
    
    // Find first match position
    let matchPos = -1;
    for (const token of queryTokens) {
      const pos = contentLower.indexOf(token);
      if (pos !== -1 && (matchPos === -1 || pos < matchPos)) {
        matchPos = pos;
      }
    }
    
    if (matchPos === -1) {
      return content.substring(0, maxSnippetLength) + '...';
    }
    
    // Extract snippet around match
    const start = Math.max(0, matchPos - 50);
    const end = Math.min(content.length, matchPos + maxSnippetLength - 50);
    
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }
  
  /**
   * Extracts content from graph node
   */
  private extractNodeContent(node: GraphNode): string {
    const parts: string[] = [node.label];
    
    if (node.metadata?.signature) {
      parts.push(String(node.metadata.signature));
    }
    
    if (node.metadata?.description) {
      parts.push(String(node.metadata.description));
    }
    
    return parts.join('\n');
  }
  
  /**
   * Extracts keywords from graph node
   */
  private extractKeywords(node: GraphNode): string[] {
    const keywords: string[] = [node.type];
    
    if (node.metadata?.tags && Array.isArray(node.metadata.tags)) {
      keywords.push(...(node.metadata.tags as string[]));
    }
    
    return keywords;
  }
  
  /**
   * Calculates source breakdown
   */
  private calculateSourceBreakdown(contexts: RetrievedContext[]): Record<ContextSource, number> {
    const breakdown: Record<ContextSource, number> = {
      code: 0,
      documentation: 0,
      task: 0,
      prevention: 0,
      metadata: 0
    };
    
    for (const ctx of contexts) {
      breakdown[ctx.source]++;
    }
    
    return breakdown;
  }
}
