import type { RawEntity, FilterPipelineResult } from "../../nivel2/infrastructure/services/entity-filtering/types/FilterTypes";
import type { DocumentChunk } from "../../shared/types/chunk";

/**
 * Port: Interface para análise de código
 */
export interface ICodeAnalyzer {
  analyze(filePath: string, content: string): Promise<AnalysisResult>;
  getSupportedExtensions(): string[];
}

export interface AnalysisResult {
  ast?: unknown;
  rawEntities: RawEntity[];
  signatures: unknown[];
  jsdocChunks: DocumentChunk[];
  metadata: {
    lines: number;
    characters: number;
    importsCount: number;
    exportsCount: number;
    callsCount: number;
    typeRefsCount: number;
  };
}

/**
 * Port: Interface para pipeline de filtragem
 */
export interface IEntityPipeline {
  process(
    rawEntities: RawEntity[],
    filePath: string,
    jsdocChunks: DocumentChunk[],
    content?: string
  ): Promise<FilterPipelineResult>;
}
