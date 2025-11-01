/**
 * @fileoverview Adapter for scoring and weighting contexts
 * @module nivel2/infrastructure/adapters/retrieval/scoring-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import type { ScoringPort } from '../../../../domains/retrieval/ports';
import type { RetrievedContext, RetrievalOptions, SourceWeights } from '../../../../domains/retrieval/types';

/**
 * Adapter for applying scoring logic to contexts
 */
export class ScoringAdapter implements ScoringPort {
  
  applyWeightedScoring(
    contexts: RetrievedContext[],
    options: RetrievalOptions
  ): RetrievedContext[] {
    // Count available sources WITH results
    const availableSources = new Set(contexts.map(ctx => ctx.source));
    const sourceCount = availableSources.size;
    
    console.log(`[ScoringAdapter] applyWeightedScoring: ${sourceCount} unique source(s) with results:`, Array.from(availableSources));
    
    // If only one source has results, don't apply penalties
    if (sourceCount === 1) {
      console.log(`[ScoringAdapter] Only one source, using weight 1.0 for all`);
      return contexts;
    }
    
    // Get base weights
    const baseWeights: SourceWeights = {
      code: options.codeWeight ?? 0.4,
      documentation: options.docWeight ?? 0.3,
      prevention: options.preventionWeight ?? 0.2,
      task: options.taskWeight ?? 0.1,
      metadata: 0
    };
    
    // Calculate normalized weights
    const weights = this.calculateNormalizedWeights(contexts, baseWeights);
    
    console.log(`[ScoringAdapter] Normalized weights:`, weights);
    console.log(`[ScoringAdapter] Sample scores BEFORE weighting:`, 
      contexts.slice(0, 3).map(c => `${c.source}:${c.score.toFixed(3)}`).join(', '));
    
    // Apply weights
    const weighted = contexts.map(ctx => ({
      ...ctx,
      score: ctx.score * (weights[ctx.source] || 1)
    }));
    
    console.log(`[ScoringAdapter] Sample scores AFTER weighting:`, 
      weighted.slice(0, 3).map(c => `${c.source}:${c.score.toFixed(3)}`).join(', '));
    
    return weighted;
  }
  
  calculateNormalizedWeights(
    contexts: RetrievedContext[],
    baseWeights: SourceWeights
  ): Partial<SourceWeights> {
    const availableSources = new Set(contexts.map(ctx => ctx.source));
    
    // Calculate sum of weights for sources that actually have results
    let totalWeight = 0;
    for (const source of availableSources) {
      totalWeight += baseWeights[source] || 0;
    }
    
    // Normalize weights so they sum to 1.0 for available sources
    const weights: Partial<SourceWeights> = {};
    for (const source of availableSources) {
      const baseWeight = baseWeights[source] || 0;
      weights[source] = totalWeight > 0 ? baseWeight / totalWeight : 1;
    }
    
    return weights;
  }
}
