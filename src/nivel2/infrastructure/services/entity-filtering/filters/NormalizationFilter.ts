import type { DeduplicatedEntity, NormalizedEntity, FilterPipelineConfig } from '../types/FilterTypes';
import { PackageInfoResolver } from '../resolvers/PackageInfoResolver';

/**
 * Filtro de Normalização - Padroniza dados das entidades
 */
export class NormalizationFilter {
  /**
   * Aplica normalização
   */
  static async apply(
    entities: DeduplicatedEntity[],
    filePath: string,
    config: FilterPipelineConfig
  ): Promise<NormalizedEntity[]> {
    const normalized: NormalizedEntity[] = [];

    for (const entity of entities) {
      const normalizedEntity = await this.normalizeEntity(entity, filePath, config);
      normalized.push(normalizedEntity);
    }

    return normalized;
  }

  /**
   * Normaliza uma entidade
   */
  private static async normalizeEntity(
    entity: DeduplicatedEntity,
    filePath: string,
    config: FilterPipelineConfig
  ): Promise<NormalizedEntity> {
    let normalizedName = entity.name;
    let category: 'internal' | 'external' | 'builtin' = 'internal';
    let packageInfo: NormalizedEntity['packageInfo'];

    // Detecta categoria para imports
    if (entity.type === 'import' && entity.source) {
      const categorization = this.categorizeImport(entity.source);
      category = categorization.category;
      normalizedName = categorization.normalizedName;

      // Normaliza path separators
      if (config.normalizePathSeparators && category === 'internal') {
        normalizedName = normalizedName.replaceAll('\\', '/');
      }

      // Resolve package info para externos
      if (config.resolvePackageInfo && category === 'external') {
        packageInfo = await PackageInfoResolver.resolve(entity.source, filePath);
      }
    }

    return {
      ...entity,
      normalizedName,
      category,
      packageInfo
    };
  }

  /**
   * Categoriza import
   */
  private static categorizeImport(source: string): {
    category: 'internal' | 'external' | 'builtin';
    normalizedName: string;
  } {
    const nodeBuiltins = ['fs', 'path', 'crypto', 'http', 'https', 'os', 'util', 'events'];

    // Node builtins
    if (nodeBuiltins.includes(source) || source.startsWith('node:')) {
      return { category: 'builtin', normalizedName: source };
    }

    // Caminhos relativos = internal
    if (source.startsWith('./') || source.startsWith('../')) {
      return { category: 'internal', normalizedName: source };
    }

    // Pacotes externos
    return { category: 'external', normalizedName: source };
  }
}
