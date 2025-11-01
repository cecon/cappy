/**
 * @fileoverview Adapter for retrieving documentation content
 * @module nivel2/infrastructure/adapters/retrieval/doc-content-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { ContentRetrieverPort } from '../../../../domains/retrieval/ports';
import type { RetrievedContext, RetrievalOptions } from '../../../../domains/retrieval/types';
import type { GraphContentAdapter } from './graph-content-adapter';

/**
 * Adapter for retrieving documentation content
 * 
 * This leverages the graph database but filters for documentation chunks
 * (markdown_section, document_section, etc.)
 */
export class DocContentAdapter implements ContentRetrieverPort {
  private readonly graphAdapter: GraphContentAdapter;
  
  constructor(graphAdapter: GraphContentAdapter) {
    this.graphAdapter = graphAdapter;
    console.log(`[DocContentAdapter] Constructor`);
  }
  
  getSourceType(): 'documentation' {
    return 'documentation';
  }
  
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedContext[]> {
    console.log(`[DocContentAdapter] retrieve() called with query: "${query}"`);
    
    // Reuse graph adapter logic but filter to documentation sources
    const allResults = await this.graphAdapter.retrieve(query, options);
    
    // Filter to documentation contexts
    // This works because the graph adapter already classifies chunks by type
    const docResults = allResults.filter(ctx => {
      // Check if it's a documentation chunk based on metadata
      const chunkType = ctx.metadata.chunkType;
      const language = ctx.metadata.language;
      const filePath = ctx.filePath;
      
      // Match documentation chunk types
      if (chunkType === 'markdown_section' || chunkType === 'document_section') {
        return true;
      }
      
      // Match markdown language
      if (language === 'markdown') {
        return true;
      }
      
      // Match file extensions
      if (filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext === 'md' || ext === 'mdx' || ext === 'pdf' || ext === 'doc' || ext === 'docx') {
          return true;
        }
      }
      
      return false;
    }).map(ctx => ({
      ...ctx,
      source: 'documentation' as const // Ensure source is marked as documentation
    }));
    
    console.log(`[DocContentAdapter] Filtered to ${docResults.length} documentation contexts`);
    return docResults;
  }
}
