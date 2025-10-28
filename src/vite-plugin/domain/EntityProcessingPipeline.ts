import path from "node:path";
import type { IEntityPipeline } from "../ports/IAnalyzer";
import type { RawEntity, FilterPipelineResult } from "../../nivel2/infrastructure/services/entity-filtering/types/FilterTypes";
import type { DocumentChunk } from "../../shared/types/chunk";

/**
 * Domain Service: Pipeline de processamento de entidades
 */
export class EntityProcessingPipeline implements IEntityPipeline {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async process(
    rawEntities: RawEntity[],
    filePath: string,
    jsdocChunks: DocumentChunk[],
    content?: string
  ): Promise<FilterPipelineResult> {
    const { EntityFilterPipeline } = await import(
      "../../nivel2/infrastructure/services/entity-filtering/entity-filter-pipeline.js"
    );
    const { SQLiteAdapter } = await import(
      "../../nivel2/infrastructure/database/sqlite-adapter.js"
    );
    const { EmbeddingService } = await import(
      "../../nivel2/infrastructure/services/embedding-service.js"
    );

    const dbPath = path.join(this.workspaceRoot, ".cappy", "knowledge-graph.db");
    const graphStore = new SQLiteAdapter(dbPath);
    const embeddingService = new EmbeddingService();

    const pipeline = new EntityFilterPipeline(
      {
        skipLocalVariables: true,
        skipPrimitiveTypes: true,
        skipAssetImports: true,
        discoverExistingEntities: true,
        extractDocumentation: true,
      },
      graphStore,
      embeddingService
    );

    const result = await pipeline.process(rawEntities, filePath, jsdocChunks, content);

    console.log(`✅ [EntityPipeline] Completed:
    - Original: ${result.original.length}
    - Filtered: ${result.filtered.length}
    - Deduplicated: ${result.deduplicated.length}
    - Normalized: ${result.normalized.length}
    - Enriched: ${result.enriched.length}`);

    return result;
  }
}
