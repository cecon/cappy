/**
 * @fileoverview Port for scoring and weighting contexts
 * @module domains/retrieval/ports/scoring-port
 * @author Cappy Team
 * @since 3.0.0
 */

import type { RetrievedContext, RetrievalOptions, SourceWeights } from '../types';

/**
 * Port for applying scoring logic to contexts
 */
export interface ScoringPort {
  /**
   * Applies weighted scoring based on source type
   * 
   * @param contexts - Contexts to score
   * @param options - Retrieval options with weights
   * @returns Contexts with adjusted scores
   */
  applyWeightedScoring(
    contexts: RetrievedContext[],
    options: RetrievalOptions
  ): RetrievedContext[];
  
  /**
   * Calculates normalized weights for available sources
   * 
   * @param contexts - Contexts to analyze
   * @param baseWeights - Base weight configuration
   * @returns Normalized weights that sum to 1.0
   */
  calculateNormalizedWeights(
    contexts: RetrievedContext[],
    baseWeights: SourceWeights
  ): Partial<SourceWeights>;
}
