/**
 * @fileoverview Pipeline de filtragem de entidades extraídas do AST
 * @module services/entity-filtering/entity-filter-pipeline
 * @author Cappy Team
 * @since 3.2.0
 * 
 * Este módulo implementa o fluxo completo de filtragem:
 * AST → Entidades Brutas → Filtro de Relevância → Deduplicação → Normalização → Enriquecimento → Banco de Dados
 */

import type { DocumentChunk } from '../../../../shared/types/chunk';
import type { GraphStorePort } from '../../../../domains/graph/ports/indexing-port';

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

/**
 * Pipeline de filtragem de entidades
 * 
 * @example
 * ```typescript
 * const pipeline = new EntityFilterPipeline({
 *   skipLocalVariables: true,
 *   skipPrimitiveTypes: true,
 *   mergeIdenticalEntities: true
 * });
 * 
 * const rawEntities = extractFromAST(code);
 * const result = await pipeline.process(rawEntities, filePath);
 * 
 * console.log(`Processadas: ${result.stats.finalCount} entidades`);
 * console.log(`Descartadas: ${result.stats.discardedCount} entidades`);
 * ```
 */
export class EntityFilterPipeline {
  private config: FilterPipelineConfig;
  
  private graphStore?: GraphStorePort;
  
  constructor(
    config: Partial<FilterPipelineConfig> = {},
    graphStore?: GraphStorePort
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
  }
  
  /**
   * Processa entidades através de todo o pipeline
   */
  async process(
    rawEntities: RawEntity[],
    filePath: string,
    chunks?: DocumentChunk[]
  ): Promise<FilterPipelineResult> {
    const startTime = Date.now();
    
    console.log(`\n🔄 Iniciando pipeline de filtragem para ${filePath}`);
    console.log(`📊 Entidades brutas: ${rawEntities.length}`);
    
    // Filtro 1: Relevância
    const filtered = this.applyRelevanceFilter(rawEntities);
    console.log(`✅ Filtro 1 (Relevância): ${filtered.length} entidades (descartadas: ${rawEntities.length - filtered.length})`);
    
    // Filtro 2: Deduplicação
    const deduplicated = this.applyDeduplication(filtered);
    console.log(`✅ Filtro 2 (Deduplicação): ${deduplicated.length} entidades (mescladas: ${filtered.length - deduplicated.length})`);
    
    // Filtro 3: Normalização
    const normalized = await this.applyNormalization(deduplicated, filePath);
    console.log(`✅ Filtro 3 (Normalização): ${normalized.length} entidades`);
    
    // Filtro 4: Enriquecimento
    const enriched = await this.applyEnrichment(normalized, chunks);
    console.log(`✅ Filtro 4 (Enriquecimento): ${enriched.length} entidades finais`);
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      original: rawEntities,
      filtered,
      deduplicated,
      normalized,
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
  
  /**
   * FILTRO 1: Relevância - Remove ruído
   */
  private applyRelevanceFilter(entities: RawEntity[]): FilteredEntity[] {
    const filtered: FilteredEntity[] = [];
    
    for (const entity of entities) {
      let relevanceScore = 1.0;
      let filterReason: string | undefined;
      let shouldKeep = true;
      
      // Descarta variáveis locais
      if (this.config.skipLocalVariables && entity.scope === 'local') {
        shouldKeep = false;
        filterReason = 'Local variable (implementation detail)';
      }
      
      // Descarta tipos primitivos
      if (this.config.skipPrimitiveTypes && entity.type === 'typeRef') {
        const primitives = ['string', 'number', 'boolean', 'any', 'void', 'null', 'undefined', 'unknown'];
        if (primitives.includes(entity.name.toLowerCase())) {
          shouldKeep = false;
          filterReason = 'Primitive type (noise)';
        }
      }
      
      // Descarta imports de assets (CSS, imagens, etc)
      if (this.config.skipAssetImports && entity.type === 'import' && entity.source) {
        if (/\.(css|scss|sass|less|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/i.test(entity.source)) {
          shouldKeep = false;
          filterReason = 'Asset import (not code dependency)';
        }
      }
      
      // Descarta membros privados (começam com _ ou #)
      if (this.config.skipPrivateMembers && entity.isPrivate) {
        relevanceScore *= 0.3; // Reduz score mas não descarta totalmente
        filterReason = 'Private member (internal implementation)';
      }
      
      // Mantém apenas se relevante
      if (shouldKeep) {
        filtered.push({
          ...entity,
          relevanceScore,
          filterReason
        });
      }
    }
    
    return filtered;
  }
  
  /**
   * FILTRO 2: Deduplicação - Mescla duplicatas
   */
  private applyDeduplication(entities: FilteredEntity[]): DeduplicatedEntity[] {
    const deduped = new Map<string, DeduplicatedEntity>();
    
    for (const entity of entities) {
      // Gera chave única baseada em tipo + nome + source (para imports)
      const key = `${entity.type}:${entity.name}${entity.source ? `:${entity.source}` : ''}`;
      
      const existing = deduped.get(key);
      
      if (existing) {
        // Mescla entidade duplicada
        if (this.config.mergeIdenticalEntities) {
          existing.occurrences++;
          existing.mergedFrom = existing.mergedFrom || [];
          existing.mergedFrom.push(`line-${entity.line || 'unknown'}`);
          
          // Mescla specifiers para imports
          if (entity.type === 'import' && entity.specifiers) {
            const currentSpecifiers = new Set(existing.specifiers || []);
            entity.specifiers.forEach(spec => currentSpecifiers.add(spec));
            existing.specifiers = Array.from(currentSpecifiers).sort();
          }
        }
      } else {
        // Nova entidade
        deduped.set(key, {
          ...entity,
          occurrences: 1
        });
      }
    }
    
    return Array.from(deduped.values());
  }
  
  /**
   * FILTRO 3: Normalização - Padroniza dados
   */
  private async applyNormalization(
    entities: DeduplicatedEntity[],
    filePath: string
  ): Promise<NormalizedEntity[]> {
    const normalized: NormalizedEntity[] = [];
    
    for (const entity of entities) {
      let normalizedName = entity.name;
      let category: 'internal' | 'external' | 'builtin' = 'internal';
      let packageInfo: NormalizedEntity['packageInfo'];
      
      // Detecta categoria (internal vs external vs builtin)
      if (entity.type === 'import' && entity.source) {
        const source = entity.source;
        
        // Node builtins
        const nodeBuiltins = ['fs', 'path', 'crypto', 'http', 'https', 'os', 'util', 'events'];
        if (nodeBuiltins.includes(source) || source.startsWith('node:')) {
          category = 'builtin';
        }
        // Caminhos relativos = internal
        else if (source.startsWith('./') || source.startsWith('../')) {
          category = 'internal';
          
          // Normaliza path separators
          if (this.config.normalizePathSeparators) {
            normalizedName = source.replace(/\\/g, '/');
          }
        }
        // Pacotes externos
        else {
          category = 'external';
          
          // Resolve package info se configurado
          if (this.config.resolvePackageInfo) {
            packageInfo = await this.resolvePackageInfo(source, filePath);
          }
        }
      }
      
      normalized.push({
        ...entity,
        normalizedName,
        category,
        packageInfo
      });
    }
    
    return normalized;
  }
  
  /**
   * FILTRO 4: Enriquecimento - Adiciona metadados
   */
  private async applyEnrichment(
    entities: NormalizedEntity[],
    chunks?: DocumentChunk[]
  ): Promise<EnrichedEntity[]> {
    const enriched: EnrichedEntity[] = [];
    
    for (const entity of entities) {
      // Calcula confiança
      let confidence = entity.relevanceScore;
      
      if (this.config.calculateConfidence) {
        // Aumenta confiança para exports (interface pública)
        if (entity.type === 'export') {
          confidence = Math.min(1.0, confidence * 1.2);
        }
        
        // Aumenta confiança para entidades com múltiplas ocorrências
        if (entity.occurrences > 1) {
          confidence = Math.min(1.0, confidence * (1 + Math.log10(entity.occurrences) * 0.1));
        }
      }
      
      // Infere relacionamentos
      const relationships: EnrichedEntity['relationships'] = [];
      
      if (this.config.inferRelationships) {
        // Para imports, cria relacionamento IMPORTS
        if (entity.type === 'import' && entity.name) {
          relationships.push({
            target: entity.name, // Nome do pacote/módulo importado
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
      }
      
      // 🔍 DISCOVERY: Busca entidades existentes no grafo
      let existingEntityId: string | undefined;
      if (this.config.discoverExistingEntities && this.graphStore) {
        existingEntityId = await this.discoverExistingEntity(entity);
        
        if (existingEntityId) {
          console.log(`   🎯 Entity "${entity.name}" already exists in graph: ${existingEntityId}`);
          
          // Adiciona relacionamento com entidade existente
          relationships.push({
            target: existingEntityId,
            type: 'references',
            confidence: 0.85
          });
        }
      }
      
      // Extrai documentação se disponível
      let documentation: string | undefined;
      
      if (this.config.extractDocumentation && chunks) {
        const relatedChunk = chunks.find(chunk => 
          chunk.metadata?.symbolName === entity.name &&
          (chunk.metadata?.chunkType === 'jsdoc' || chunk.metadata?.chunkType === 'phpdoc')
        );
        
        if (relatedChunk) {
          documentation = relatedChunk.content;
        }
      }
      
      enriched.push({
        ...entity,
        confidence,
        relationships,
        documentation
      });
    }
    
    return enriched;
  }
  
  /**
   * Resolve informações de pacote externo
   */
  private async resolvePackageInfo(
    packageName: string,
    filePath: string
  ): Promise<NormalizedEntity['packageInfo']> {
    try {
      const path = await import('path');
      const fs = await import('fs');
      
      // Navega até encontrar package.json
      let currentDir = path.dirname(filePath);
      const maxDepth = 10;
      let depth = 0;
      
      while (depth < maxDepth) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          
          // Verifica se é dependência ou devDependency
          const deps = packageJson.dependencies || {};
          const devDeps = packageJson.devDependencies || {};
          
          const version = deps[packageName] || devDeps[packageName];
          
          if (version) {
            return {
              name: packageName,
              version: version.replace(/^[\^~]/, ''), // Remove ^ e ~
              manager: await this.detectPackageManager(currentDir),
              isDevDependency: !!devDeps[packageName]
            };
          }
        }
        
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break; // Chegou na raiz
        currentDir = parentDir;
        depth++;
      }
    } catch {
      // Ignora erros silenciosamente
    }
    
    return {
      name: packageName
    };
  }
  
  /**
   * Detecta gerenciador de pacotes
   */
  private async detectPackageManager(projectRoot: string): Promise<'npm' | 'yarn' | 'pnpm'> {
    const fs = await import('fs');
    const path = await import('path');
    
    if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }
  
  /**
   * Busca entidade existente no grafo
   * 
   * Consulta o banco para verificar se uma entidade com o mesmo nome já existe.
   * Retorna o ID da entidade se encontrada, ou undefined se não existir.
   */
  private async discoverExistingEntity(
    entity: NormalizedEntity
  ): Promise<string | undefined> {
    if (!this.graphStore) {
      console.log(`   ⚠️ GraphStore not available - skipping discovery for ${entity.name}`);
      return undefined;
    }

    try {
      // Busca por chunks de código que definem essa entidade
      const entityNodeId = `entity:${entity.name}:${entity.type}`;
      
      console.log(`   🔍 Searching for existing entity: ${entityNodeId}`);
      
      // Tenta encontrar relacionamentos existentes
      const relatedChunks = await this.graphStore.getRelatedChunks([entityNodeId], 1);
      
      if (relatedChunks.length > 0) {
        console.log(`   ✅ FOUND! ${relatedChunks.length} related chunks for "${entity.name}"`);
        console.log(`      Related chunks:`, relatedChunks);
        return entityNodeId;
      }
      
      console.log(`   ❌ Not found in graph: ${entity.name}`);
      return undefined;
    } catch (error) {
      console.log(`   ⚠️ Discovery error for ${entity.name}:`, error);
      return undefined;
    }
  }
}
