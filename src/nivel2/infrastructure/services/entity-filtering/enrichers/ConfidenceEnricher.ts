import type { NormalizedEntity } from '../types/FilterTypes';

/**
 * Calcula score de confiança para entidades
 */
export class ConfidenceEnricher {
  /**
   * Calcula confiança baseado em características da entidade
   */
  static calculate(entity: NormalizedEntity): number {
    let confidence = entity.relevanceScore;

    // Aumenta confiança para exports (interface pública)
    if (entity.type === 'export') {
      confidence = Math.min(1, confidence * 1.2);
    }

    // Aumenta confiança para entidades com múltiplas ocorrências
    if (entity.occurrences > 1) {
      const occurrenceBoost = 1 + Math.log10(entity.occurrences) * 0.1;
      confidence = Math.min(1, confidence * occurrenceBoost);
    }

    // Aumenta confiança para entidades categorizadas
    if (entity.category === 'builtin') {
      confidence = Math.min(1, confidence * 1.1);
    }

    // Reduz confiança para entidades sem source
    if (entity.type === 'import' && !entity.source) {
      confidence *= 0.7;
    }

    return confidence;
  }
}
