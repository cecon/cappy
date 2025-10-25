import type { NormalizedEntity, EnrichedEntity } from '../types/FilterTypes';

/**
 * Infere relacionamentos entre entidades
 */
export class RelationshipInferrer {
  /**
   * Infere relacionamentos baseado no tipo de entidade
   */
  static infer(
    entity: NormalizedEntity,
    confidence: number
  ): EnrichedEntity['relationships'] {
    const relationships: EnrichedEntity['relationships'] = [];

    // Para imports, cria relacionamento IMPORTS
    if (entity.type === 'import' && entity.name) {
      relationships.push({
        target: entity.name,
        type: 'imports',
        confidence
      });
    }

    // Para exports, cria relacionamento EXPORTS
    if (entity.type === 'export') {
      relationships.push({
        target: entity.name,
        type: 'exports',
        confidence
      });
    }

    // Para calls, cria relacionamento CALLS
    if (entity.type === 'call') {
      relationships.push({
        target: entity.name,
        type: 'calls',
        confidence: confidence * 0.8 // Calls são menos confiáveis
      });
    }

    // Para classes, pode ter relacionamentos EXTENDS/IMPLEMENTS
    if (entity.type === 'class' && entity.metadata) {
      const metadata = entity.metadata as Record<string, unknown>;
      
      if (metadata.extends && typeof metadata.extends === 'string') {
        relationships.push({
          target: metadata.extends,
          type: 'extends',
          confidence: confidence * 0.9
        });
      }

      if (Array.isArray(metadata.implements)) {
        for (const impl of metadata.implements) {
          if (typeof impl === 'string') {
            relationships.push({
              target: impl,
              type: 'implements',
              confidence: confidence * 0.9
            });
          }
        }
      }
    }

    return relationships;
  }
}
