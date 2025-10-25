/**
 * @fileoverview Pipeline de filtragem de entidades (Hexagonal Architecture)
 * @module services/entity-filtering
 * @author Cappy Team
 * @since 3.2.0
 */

import type { DocumentChunk } from '../../../../../shared/types/chunk';
import type { GraphStorePort } from '../../../../../domains/graph/ports/indexing-port';
import type {
  RawEntity,
  FilterPipelineConfig,
  FilterPipelineResult
} from '../types/FilterTypes';
import { RelevanceFilter } from '../filters/RelevanceFilter';
import { DeduplicationFilter } from '../filters/DeduplicationFilter';
import { NormalizationFilter } from '../filters/NormalizationFilter';
import { StaticEnrichmentFilter } from '../filters/StaticEnrichmentFilter';
import { JSDocEmbeddingFilter } from '../filters/JSDocEmbeddingFilter';
import { EnrichmentFilter } from '../filters/EnrichmentFilter';

/**
 * Pipeline de filtragem de entidades
 * Orquestra os filtros especializados em sequência
 * 
 * Fluxo:
 * RawEntity[] → RelevanceFilter → DeduplicationFilter → NormalizationFilter → EnrichmentFilter → EnrichedEntity[]
 */
export class EntityFilterPipeline {
  private readonly config: FilterPipelineConfig;
  private readonly graphStore?: GraphStorePort;
  private readonly embeddingService?: any;

  constructor(
    config: Partial<FilterPipelineConfig> = {},
    graphStore?: GraphStorePort,
    embeddingService?: any
  ) {
    this.config = {
      skipLocalVariables: config.skipLocalVariables ?? true,
      skipPrimitiveTypes: config.skipPrimitiveTypes ?? true,
      skipAssetImports: config.skipAssetImports ?? true,
      skipPrivateMembers: config.skipPrivateMembers ?? true,
      skipComments: config.skipComments ?? true,
      mergeIdenticalEntities: config.mergeIdenticalEntities ?? true,
      mergeImportsBySource: config.mergeImportsBySource ?? true,
      resolvePackageInfo: config.resolvePackageInfo ?? true,
      normalizePathSeparators: config.normalizePathSeparators ?? true,
      extractSignatures: config.extractSignatures ?? true,
      extractDocumentation: config.extractDocumentation ?? false,
      inferRelationships: config.inferRelationships ?? true,
      calculateConfidence: config.calculateConfidence ?? true,
      discoverExistingEntities: config.discoverExistingEntities ?? true
    };
    this.graphStore = graphStore;
    this.embeddingService = embeddingService;
  }

  /**
   * Processa entidades através de todo o pipeline
   */
  async process(
    rawEntities: RawEntity[],
    filePath: string,
    chunks?: DocumentChunk[],
    sourceCode?: string
  ): Promise<FilterPipelineResult> {
    const startTime = Date.now();

    console.log(`\n🔄 Iniciando pipeline de filtragem para ${filePath}`);
    console.log(`📊 Entidades brutas: ${rawEntities.length}`);

    // Filtro 1: Relevância
    const filtered = RelevanceFilter.apply(rawEntities, this.config);
    console.log(`✅ Filtro 1 (Relevância): ${filtered.length} entidades (descartadas: ${rawEntities.length - filtered.length})`);

    // Filtro 2: Deduplicação
    const deduplicated = DeduplicationFilter.apply(filtered, this.config);
    console.log(`✅ Filtro 2 (Deduplicação): ${deduplicated.length} entidades (mescladas: ${filtered.length - deduplicated.length})`);

    // Filtro 3: Normalização
    const normalized = await NormalizationFilter.apply(deduplicated, filePath, this.config);
    console.log(`✅ Filtro 3 (Normalização): ${normalized.length} entidades`);

    // Filtro 3.5: Enriquecimento Estático (NOVO!)
    const staticEnriched = StaticEnrichmentFilter.apply(normalized, sourceCode, filePath);
    console.log(`✅ Filtro 3.5 (Enriquecimento Estático): ${staticEnriched.length} entidades`);

    // Filtro 4.5: JSDoc Vector Embeddings (NOVO!)
    const jsdocEmbedded = await JSDocEmbeddingFilter.apply(staticEnriched, this.embeddingService);
    console.log(`✅ Filtro 4.5 (JSDoc Embeddings): ${jsdocEmbedded.length} entidades`);

    // Filtro 5: Enriquecimento (LLM-based)
    const enriched = await EnrichmentFilter.apply(jsdocEmbedded, this.config, chunks, this.graphStore);
    console.log(`✅ Filtro 5 (Enriquecimento LLM): ${enriched.length} entidades finais`);

    const processingTimeMs = Date.now() - startTime;

    return {
      original: rawEntities,
      filtered,
      deduplicated,
      normalized,
      staticEnriched, // ← Etapa 3.5
      jsdocEmbedded,  // ← Etapa 4.5 (NOVA!)
      enriched,
      stats: {
        totalRaw: rawEntities.length,
        totalFiltered: filtered.length,
        discardedCount: rawEntities.length - filtered.length,
        deduplicatedCount: filtered.length - deduplicated.length,
        finalCount: enriched.length,
        processingTimeMs
      }
    };
  }
}
