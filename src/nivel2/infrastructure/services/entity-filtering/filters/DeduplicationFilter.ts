import type { FilteredEntity, DeduplicatedEntity, FilterPipelineConfig } from '../types/FilterTypes';

/**
 * Filtro de Deduplicação - Mescla entidades duplicadas
 */
export class DeduplicationFilter {
  /**
   * Aplica deduplicação
   */
  static apply(entities: FilteredEntity[], config: FilterPipelineConfig): DeduplicatedEntity[] {
    const deduped = new Map<string, DeduplicatedEntity>();

    for (const entity of entities) {
      const key = this.generateKey(entity);
      const existing = deduped.get(key);

      if (existing) {
        this.mergeEntity(existing, entity, config);
      } else {
        deduped.set(key, {
          ...entity,
          occurrences: 1
        });
      }
    }

    return Array.from(deduped.values());
  }

  /**
   * Gera chave única para deduplicação
   */
  private static generateKey(entity: FilteredEntity): string {
    return entity.type + ':' + entity.name + (entity.source ? ':' + entity.source : '');
  }

  /**
   * Mescla entidade duplicada na existente
   */
  private static mergeEntity(
    existing: DeduplicatedEntity,
    entity: FilteredEntity,
    config: FilterPipelineConfig
  ): void {
    if (!config.mergeIdenticalEntities) return;

    existing.occurrences++;
    existing.mergedFrom = existing.mergedFrom || [];
    existing.mergedFrom.push(`line-${entity.line || 'unknown'}`);

    // Mescla specifiers para imports
    if (entity.type === 'import' && entity.specifiers) {
      const currentSpecifiers = new Set(existing.specifiers || []);
      for (const spec of entity.specifiers) {
        currentSpecifiers.add(spec);
      }
      existing.specifiers = Array.from(currentSpecifiers).sort((a, b) => a.localeCompare(b));
    }
  }
}
