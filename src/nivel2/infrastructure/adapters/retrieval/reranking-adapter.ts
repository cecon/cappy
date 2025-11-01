/**
 * @fileoverview Adapter for re-ranking contexts
 * @module nivel2/infrastructure/adapters/retrieval/reranking-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { RerankingPort } from '../../../../domains/retrieval/ports';
import type { RetrievedContext, RetrievalOptions } from '../../../../domains/retrieval/types';

/**
 * Adapter for re-ranking contexts using advanced signals
 */
export class RerankingAdapter implements RerankingPort {
  
  async rerank(
    query: string,
    contexts: RetrievedContext[],
    options: RetrievalOptions
  ): Promise<RetrievedContext[]> {
    console.log(`[RerankingAdapter] rerank() called with ${contexts.length} contexts`);
    
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
}
