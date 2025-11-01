/**
 * @fileoverview Adapter for retrieving content from code graph
 * @module nivel2/infrastructure/adapters/retrieval/graph-content-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { ContentRetrieverPort } from '../../../../domains/retrieval/ports';
import type { RetrievedContext, RetrievalOptions } from '../../../../domains/retrieval/types';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import type { GraphData, GraphNode } from '../../../../domains/dashboard/types';
import { SearchGraphUseCase, type SearchGraphOptions } from '../../../../domains/dashboard/use-cases';

/**
 * Adapter for retrieving code content from graph database
 */
export class GraphContentAdapter implements ContentRetrieverPort {
  private readonly graphStore?: GraphStorePort;
  private readonly graphData?: GraphData;
  private readonly searchUseCase: SearchGraphUseCase;
  
  constructor(graphStore?: GraphStorePort, graphData?: GraphData) {
    this.graphStore = graphStore;
    this.graphData = graphData;
    this.searchUseCase = new SearchGraphUseCase();
    
    console.log(`[GraphContentAdapter] Constructor: graphStore=${!!graphStore}, graphData=${!!graphData}`);
  }
  
  getSourceType(): 'code' {
    return 'code';
  }
  
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedContext[]> {
    console.log(`[GraphContentAdapter] retrieve() called with query: "${query}"`);
    
    // Try graphStore first (preferred)
    if (this.graphStore) {
      return this.retrieveFromGraphStore(query, options);
    }
    
    // Fallback to graphData
    if (this.graphData) {
      return this.retrieveFromGraphData(query, options);
    }
    
    console.warn('[GraphContentAdapter] No graph source available');
    return [];
  }
  
  /**
   * Retrieves from GraphStorePort (SQLite)
   */
  private async retrieveFromGraphStore(
    query: string,
    options: RetrievalOptions
  ): Promise<RetrievedContext[]> {
    if (!this.graphStore) return [];
    
    try {
      console.log(`[GraphContentAdapter] Retrieving from graphStore`);
      const queryLower = query.toLowerCase();
      const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);
      console.log(`[GraphContentAdapter] Query tokens: [${queryTokens.join(', ')}]`);
      
      // Get content map from vectors table
      const contentMap = await this.getNodeContents();
      console.log(`[GraphContentAdapter] Loaded content for ${Object.keys(contentMap).length} nodes`);
      
      // Get subgraph
      const maxNodesToFetch = Math.min(2000, Math.max(1000, (options.maxResults ?? 10) * 100));
      const subgraph = await this.graphStore.getSubgraph(undefined, 2, maxNodesToFetch);
      console.log(`[GraphContentAdapter] Got subgraph with ${subgraph.nodes.length} nodes`);
      
      // Filter and score nodes
      const results: RetrievedContext[] = [];
      
      for (const node of subgraph.nodes) {
        const labelLower = node.label.toLowerCase();
        const idLower = node.id.toLowerCase();
        const nodeContent = contentMap[node.id];
        const contentLower = nodeContent ? nodeContent.toLowerCase() : '';
        
        // Calculate score
        let score = 0;
        let exactMatches = 0;
        
        for (const token of queryTokens) {
          const labelWords = labelLower.split(/\s+/);
          const idWords = idLower.split(/[\s/:._-]+/);
          
          if (labelWords.includes(token)) {
            score += 0.5;
            exactMatches++;
          } else if (labelLower.includes(token)) {
            score += 0.2;
          }
          
          if (idWords.includes(token)) {
            score += 0.4;
            exactMatches++;
          } else if (idLower.includes(token)) {
            score += 0.15;
          }
          
          if (contentLower && contentLower.includes(token)) {
            score += 0.3;
            const contentWords = contentLower.split(/\s+/);
            if (contentWords.includes(token)) {
              score += 0.2;
              exactMatches++;
            }
          }
        }
        
        // Boost for multiple matches
        if (exactMatches > 1) {
          score *= (1 + exactMatches * 0.2);
        }
        
        // Skip entity and file nodes
        const isEntityNode = node.id.startsWith('entity:');
        const isFileNode = node.type === 'file' && !node.metadata?.chunk_type;
        
        if (isEntityNode || isFileNode) {
          continue;
        }
        
        // Boost chunks with content
        const hasContent = contentMap[node.id] !== undefined;
        if (hasContent) {
          score *= 10;
        } else {
          score *= 0.1;
        }
        
        // Penalty for very long labels
        if (labelLower.length > 200) {
          score *= 0.8;
        }
        
        if (score <= 0) continue;
        
        // Normalize score
        score = Math.min(score, 1);
        
        const filePath = node.metadata?.file_path || (node.id.includes(':') ? node.id.split(':')[0] : undefined);
        const fullContent = contentMap[node.id] || node.label;
        const snippet = fullContent.length > 200 ? fullContent.substring(0, 200) + '...' : fullContent;
        
        results.push({
          id: node.id,
          content: fullContent,
          source: 'code',
          score,
          filePath,
          metadata: {
            title: node.label,
            category: node.type,
            keywords: [],
            lastModified: new Date().toISOString(),
            lineStart: node.metadata?.line_start,
            lineEnd: node.metadata?.line_end,
            chunkType: node.metadata?.chunk_type,
            language: node.metadata?.language
          },
          snippet
        });
      }
      
      // Sort and limit
      results.sort((a, b) => b.score - a.score);
      const maxResults = options.maxResults ?? 10;
      const limitedResults = results.slice(0, maxResults);
      
      console.log(`[GraphContentAdapter] Returning ${limitedResults.length} results`);
      return limitedResults;
      
    } catch (error) {
      console.error('[GraphContentAdapter] Error in retrieveFromGraphStore:', error);
      return [];
    }
  }
  
  /**
   * Get node contents from vectors table
   */
  private async getNodeContents(): Promise<Record<string, string>> {
    if (!this.graphStore) return {};
    
    try {
      const store = this.graphStore as { getChunkContents?: (limit: number) => Promise<Array<{ chunk_id: string; content: string }>> };
      
      if (!store.getChunkContents) {
        console.warn('[GraphContentAdapter] getChunkContents not available');
        return {};
      }
      
      const rows = await store.getChunkContents(5000);
      
      if (!rows || rows.length === 0) {
        return {};
      }
      
      const contentMap: Record<string, string> = {};
      for (const row of rows) {
        contentMap[row.chunk_id] = row.content;
      }
      
      return contentMap;
    } catch (error) {
      console.error('[GraphContentAdapter] Error loading node contents:', error);
      return {};
    }
  }
  
  /**
   * Retrieves from GraphData (fallback)
   */
  private async retrieveFromGraphData(
    query: string,
    options: RetrievalOptions
  ): Promise<RetrievedContext[]> {
    if (!this.graphData) return [];
    
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
          const filePath = node.metadata?.filePath as string | undefined;
          
          return {
            id: node.id,
            content: this.extractNodeContent(node),
            source: 'code' as const,
            score: item.score,
            filePath,
            metadata: {
              title: node.label,
              type: node.type,
              keywords: this.extractKeywords(node)
            },
            snippet: item.snippet
          };
        });
    } catch (error) {
      console.warn('[GraphContentAdapter] Error in retrieveFromGraphData:', error);
      return [];
    }
  }
  
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
  
  private extractKeywords(node: GraphNode): string[] {
    const keywords: string[] = [node.type];
    
    if (node.metadata?.tags && Array.isArray(node.metadata.tags)) {
      keywords.push(...(node.metadata.tags as string[]));
    }
    
    return keywords;
  }
}
