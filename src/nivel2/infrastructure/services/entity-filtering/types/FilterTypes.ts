/**
 * Entidade bruta extraída diretamente do AST
 */
export interface RawEntity {
  type: 'import' | 'export' | 'class' | 'function' | 'variable' | 'typeRef' | 'call';
  name: string;
  source?: string; // Para imports
  specifiers?: string[]; // Para imports
  scope?: 'local' | 'module' | 'global';
  line?: number;
  isPrivate?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Entidade após filtro de relevância
 */
export interface FilteredEntity extends RawEntity {
  relevanceScore: number; // 0-1
  filterReason?: string; // Por que passou/foi descartada
}

/**
 * Entidade após deduplicação
 */
export interface DeduplicatedEntity extends FilteredEntity {
  mergedFrom?: string[]; // IDs de entidades que foram mescladas
  occurrences: number;
}

/**
 * Entidade normalizada
 */
export interface NormalizedEntity extends DeduplicatedEntity {
  normalizedName: string;
  category: 'internal' | 'external' | 'builtin';
  packageInfo?: {
    name: string;
    version?: string;
    manager?: 'npm' | 'yarn' | 'pnpm';
    isDevDependency?: boolean;
  };
}

/**
 * Entidade final pronta para o banco
 */
export interface EnrichedEntity extends NormalizedEntity {
  confidence: number;
  relationships: Array<{
    target: string;
    type: 'imports' | 'exports' | 'calls' | 'extends' | 'implements' | 'uses' | 'references';
    confidence: number;
  }>;
  signature?: string; // Para funções/métodos
  documentation?: string; // JSDoc extraído
}

/**
 * Resultado do pipeline
 */
export interface FilterPipelineResult {
  original: RawEntity[];
  filtered: FilteredEntity[];
  deduplicated: DeduplicatedEntity[];
  normalized: NormalizedEntity[];
  staticEnriched?: unknown[]; // Entidades com enriquecimento estático
  enriched: EnrichedEntity[];
  stats: {
    totalRaw: number;
    totalFiltered: number;
    discardedCount: number;
    deduplicatedCount: number;
    finalCount: number;
    processingTimeMs: number;
  };
}

/**
 * Configuração do pipeline
 */
export interface FilterPipelineConfig {
  // Filtro 1: Relevância
  skipLocalVariables: boolean;
  skipPrimitiveTypes: boolean;
  skipAssetImports: boolean;
  skipPrivateMembers: boolean;
  skipComments: boolean;
  
  // Filtro 2: Deduplicação
  mergeIdenticalEntities: boolean;
  mergeImportsBySource: boolean;
  
  // Filtro 3: Normalização
  resolvePackageInfo: boolean;
  normalizePathSeparators: boolean;
  
  // Filtro 4: Enriquecimento
  extractSignatures: boolean;
  extractDocumentation: boolean;
  inferRelationships: boolean;
  calculateConfidence: boolean;
  
  // Discovery de entidades existentes
  discoverExistingEntities: boolean;
}
