/**
 * @fileoverview Static enrichment filter - main orchestrator
 * @module services/entity-filtering/filters
 * @author Cappy Team
 * @since 3.2.0
 */

import type { NormalizedEntity } from '../types/FilterTypes';
import { JSDocExtractor, type ParsedJSDoc } from '../enrichers/static/JSDocExtractor';
import { SemanticTypeInferrer, type SemanticType } from '../enrichers/static/SemanticTypeInferrer';
import { StaticRelationshipInferrer, type InferredRelationship } from '../enrichers/static/StaticRelationshipInferrer';
import { StaticConfidenceCalculator } from '../enrichers/static/StaticConfidenceCalculator';

/**
 * Entidade estaticamente enriquecida
 */
export interface StaticallyEnrichedEntity extends NormalizedEntity {
  semanticType: SemanticType;
  jsdoc?: ParsedJSDoc;
  staticRelationships: InferredRelationship[];
  staticConfidence: number;
  location?: {
    file: string;
    line: number;
  };
}

/**
 * Static Enrichment Filter
 * Orquestra o enriquecimento estático de entidades
 */
export class StaticEnrichmentFilter {
  /**
   * Aplica enriquecimento estático em lote
   */
  static apply(
    entities: NormalizedEntity[],
    sourceCode?: string,
    filePath?: string
  ): StaticallyEnrichedEntity[] {
    console.log(`🔬 [StaticEnrichment] Enriching ${entities.length} entities...`);
    console.log(`   📄 Source code provided: ${!!sourceCode}, length: ${sourceCode?.length || 0}`);
    console.log(`   📍 File path: ${filePath || 'none'}`);
    
    // Log first 3 entities to check if they have line numbers
    console.log(`   📊 First 3 entities:`, entities.slice(0, 3).map(e => ({
      name: e.name,
      type: e.type,
      line: e.line,
      hasLine: !!e.line
    })));
    
    const enriched: StaticallyEnrichedEntity[] = [];
    
    // 1. Extrair JSDoc em batch (se temos código-fonte)
    let jsdocMap = new Map<string, ParsedJSDoc>();
    if (sourceCode) {
      const entitiesWithLines = entities
        .filter(e => e.line !== undefined)
        .map(e => ({ name: e.name, line: e.line! }));
      
      jsdocMap = JSDocExtractor.extractBatch(sourceCode, entitiesWithLines);
      console.log(`   📝 Extracted JSDoc for ${jsdocMap.size} entities`);
    }
    
    // 2. Processar cada entidade
    for (const entity of entities) {
      const jsdoc = jsdocMap.get(entity.name) || null;
      
      // 2.1 Inferir tipo semântico
      const semanticType = SemanticTypeInferrer.infer(entity, jsdoc, sourceCode);
      
      // 2.2 Inferir relacionamentos
      const staticRelationships = StaticRelationshipInferrer.infer(
        entity,
        entities,
        sourceCode
      );
      
      // 2.3 Calcular confiança
      const staticConfidence = StaticConfidenceCalculator.calculate(
        entity,
        jsdoc,
        semanticType,
        staticRelationships,
        entities
      );
      
      // 2.4 Adicionar location info
      const location = entity.line ? {
        file: filePath || entity.source || 'unknown',
        line: entity.line,
      } : undefined;
      
      enriched.push({
        ...entity,
        semanticType,
        jsdoc: jsdoc || undefined,
        staticRelationships,
        staticConfidence,
        location,
      });
    }
    
    // 3. Log summary
    const semanticTypeCounts = enriched.reduce((acc, e) => {
      acc[e.semanticType] = (acc[e.semanticType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const avgConfidence = enriched.reduce((sum, e) => sum + e.staticConfidence, 0) / enriched.length;
    const totalRelationships = enriched.reduce((sum, e) => sum + e.staticRelationships.length, 0);
    const withJSDoc = enriched.filter(e => e.jsdoc).length;
    
    console.log(`   ✨ Semantic types:`, semanticTypeCounts);
    console.log(`   📊 Average confidence: ${avgConfidence.toFixed(2)}`);
    console.log(`   🕸️ Total relationships: ${totalRelationships}`);
    console.log(`   📝 With JSDoc: ${withJSDoc}/${enriched.length}`);
    
    return enriched;
  }

  /**
   * Enriquece uma única entidade
   */
  static enrichOne(
    entity: NormalizedEntity,
    allEntities: NormalizedEntity[],
    sourceCode?: string,
    filePath?: string
  ): StaticallyEnrichedEntity {
    console.log(`   🔍 [StaticEnrich] Checking entity: ${entity.name}, line: ${entity.line}, hasSourceCode: ${!!sourceCode}`);
    const jsdoc = sourceCode && entity.line
      ? JSDocExtractor.extractFromSource(sourceCode, entity.line)
      : null;
    if (jsdoc) {
      console.log(`   📝 [StaticEnrich] Found JSDoc for ${entity.name}!`);
    }
    
    const semanticType = SemanticTypeInferrer.infer(entity, jsdoc, sourceCode);
    
    const staticRelationships = StaticRelationshipInferrer.infer(
      entity,
      allEntities,
      sourceCode
    );
    
    const staticConfidence = StaticConfidenceCalculator.calculate(
      entity,
      jsdoc,
      semanticType,
      staticRelationships,
      allEntities
    );
    
    const location = entity.line ? {
      file: filePath || entity.source || 'unknown',
      line: entity.line,
    } : undefined;
    
    return {
      ...entity,
      semanticType,
      jsdoc: jsdoc || undefined,
      staticRelationships,
      staticConfidence,
      location,
    };
  }
}
