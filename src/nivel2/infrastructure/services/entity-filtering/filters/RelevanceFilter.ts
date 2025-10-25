import type { RawEntity, FilteredEntity, FilterPipelineConfig } from '../types/FilterTypes';

/**
 * Filtro de Relevância - Remove ruído e entidades irrelevantes
 */
export class RelevanceFilter {
  /**
   * Aplica filtro de relevância
   */
  static apply(entities: RawEntity[], config: FilterPipelineConfig): FilteredEntity[] {
    const filtered: FilteredEntity[] = [];
    
    for (const entity of entities) {
      const result = this.evaluateRelevance(entity, config);
      
      if (result.shouldKeep) {
        filtered.push({
          ...entity,
          relevanceScore: result.score,
          filterReason: result.reason
        });
      }
    }
    
    return filtered;
  }

  /**
   * Avalia relevância de uma entidade
   */
  private static evaluateRelevance(
    entity: RawEntity,
    config: FilterPipelineConfig
  ): { shouldKeep: boolean; score: number; reason?: string } {
    let score = 1.0;
    let reason: string | undefined;
    let shouldKeep = true;

    // Descarta variáveis locais
    if (config.skipLocalVariables && entity.scope === 'local') {
      shouldKeep = false;
      reason = 'Local variable (implementation detail)';
    }

    // Descarta tipos primitivos
    if (config.skipPrimitiveTypes && entity.type === 'typeRef') {
      const primitives = ['string', 'number', 'boolean', 'any', 'void', 'null', 'undefined', 'unknown'];
      if (primitives.includes(entity.name.toLowerCase())) {
        shouldKeep = false;
        reason = 'Primitive type (noise)';
      }
    }

    // Descarta imports de assets (CSS, imagens, etc)
    if (config.skipAssetImports && entity.type === 'import' && entity.source) {
      if (/\.(css|scss|sass|less|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/i.test(entity.source)) {
        shouldKeep = false;
        reason = 'Asset import (not code dependency)';
      }
    }

    // Descarta membros privados (começam com _ ou #)
    if (config.skipPrivateMembers && entity.isPrivate) {
      score *= 0.3; // Reduz score mas não descarta totalmente
      reason = 'Private member (internal implementation)';
    }

    return { shouldKeep, score, reason };
  }
}
