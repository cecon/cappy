/**
 * @fileoverview Retrieve context tool for semantic search
 * @module codeact/tools/retrieve-context-tool
 */

import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'
import type { HybridRetriever } from '../../../services/hybrid-retriever'

/**
 * Retrieve context tool - semantic search in codebase
 * Uses HybridRetriever (unified retrieval system)
 */
export class RetrieveContextTool extends BaseTool {
  name = 'retrieve_context'
  description = 'Retrieve relevant context from the codebase database using semantic search. Use this to find code, documentation, or rules related to your query.'
  
  parameters: ToolParameter[] = [
    {
      name: 'query',
      type: 'string',
      description: 'Search query to find relevant code, docs, or rules',
      required: true
    },
    {
      name: 'sources',
      type: 'array',
      description: 'Sources to search in',
      required: false,
      default: ['code', 'documentation'],
      items: {
        type: 'string',
        enum: ['code', 'documentation', 'metadata']
      }
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      default: 5
    },
    {
      name: 'minScore',
      type: 'number',
      description: 'Minimum relevance score (0-1)',
      required: false,
      default: 0.5
    }
  ]
  
  private readonly retriever?: HybridRetriever
  
  constructor(retriever?: HybridRetriever) {
    super()
    this.retriever = retriever
  }
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    if (!this.retriever) {
      return this.error('HybridRetriever not available. Indexing may not be complete.')
    }
    
    try {
      const query = input.query as string
      const sources = (input.sources as string[]) || ['code', 'documentation']
      const maxResults = (input.maxResults as number) || 5
      const minScore = (input.minScore as number) || 0.5
      
      const results = await this.retriever.retrieve(query, {
        sources: sources as ('code' | 'documentation' | 'metadata')[],
        maxResults,
        minScore
      })
      
      // Format results for agent
      const formattedResults = results.contexts.map((ctx, idx) => ({
        rank: idx + 1,
        score: ctx.score,
        source: ctx.source,
        content: ctx.content,
        filePath: ctx.filePath,
        metadata: ctx.metadata
      }))
      
      return this.success({
        query,
        resultsCount: formattedResults.length,
        contexts: formattedResults
      })
    } catch (error) {
      return this.error(
        error instanceof Error ? error.message : 'Unknown error during context retrieval'
      )
    }
  }
}
