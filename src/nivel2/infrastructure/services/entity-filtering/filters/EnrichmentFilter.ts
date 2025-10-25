import type { NormalizedEntity, EnrichedEntity, FilterPipelineConfig } from '../types/FilterTypes';
import type { DocumentChunk } from '../../../../../shared/types/chunk';
import type { GraphStorePort } from '../../../../../domains/graph/ports/indexing-port';
import { ConfidenceEnricher } from '../enrichers/ConfidenceEnricher';
import { RelationshipInferrer } from '../enrichers/RelationshipInferrer';
import { DocumentationExtractor } from '../enrichers/DocumentationExtractor';
import { EntityDiscoveryService } from '../discovery/EntityDiscoveryService';

/**
 * Filtro de Enriquecimento - Adiciona metadados às entidades
 */
export class EnrichmentFilter {
  /**
   * Aplica enriquecimento
   */
  static async apply(
    entities: NormalizedEntity[],
    config: FilterPipelineConfig,
    chunks?: DocumentChunk[],
    graphStore?: GraphStorePort
  ): Promise<EnrichedEntity[]> {
    const enriched: EnrichedEntity[] = [];

    for (const entity of entities) {
      const enrichedEntity = await this.enrichEntity(entity, config, chunks, graphStore);
      enriched.push(enrichedEntity);
    }

    return enriched;
  }

  /**
   * Enriquece uma entidade
   */
  private static async enrichEntity(
    entity: NormalizedEntity,
    config: FilterPipelineConfig,
    chunks?: DocumentChunk[],
    graphStore?: GraphStorePort
  ): Promise<EnrichedEntity> {
    // Calcula confiança
    const confidence = config.calculateConfidence
      ? ConfidenceEnricher.calculate(entity)
      : entity.relevanceScore;

    // Infere relacionamentos
    const relationships = config.inferRelationships
      ? RelationshipInferrer.infer(entity, confidence)
      : [];

    // Descobre entidades existentes
    if (config.discoverExistingEntities && graphStore) {
      const existingEntityId = await EntityDiscoveryService.discover(entity, graphStore);
      
      if (existingEntityId) {
        console.log(`   🎯 Entity "${entity.name}" already exists in graph: ${existingEntityId}`);
        relationships.push({
          target: existingEntityId,
          type: 'references',
          confidence: 0.85
        });
      }
    }

    // Extrai documentação
    const documentation = config.extractDocumentation
      ? DocumentationExtractor.extract(entity, chunks)
      : undefined;

    return {
      ...entity,
      confidence,
      relationships,
      documentation
    };
  }
}
