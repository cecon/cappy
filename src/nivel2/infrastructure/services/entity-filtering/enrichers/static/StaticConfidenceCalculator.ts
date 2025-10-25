/**
 * @fileoverview Static confidence calculator
 * @module services/entity-filtering/enrichers/static
 * @author Cappy Team
 * @since 3.2.0
 */

import type { NormalizedEntity } from '../../types/FilterTypes';
import type { ParsedJSDoc } from './JSDocExtractor';
import type { SemanticType } from './SemanticTypeInferrer';
import type { InferredRelationship } from './StaticRelationshipInferrer';

/**
 * Evidências para cálculo de confiança
 */
export interface ConfidenceEvidence {
  hasJSDoc: boolean;
  hasTypeAnnotations: boolean;
  hasTests: boolean;
  relationshipCount: number;
  usageCount: number;
  isExported: boolean;
  semanticTypeConfidence: number;
}

/**
 * Static Confidence Calculator
 * Calcula confiança baseado em evidências estáticas
 */
export class StaticConfidenceCalculator {
  /**
   * Calcula confiança de uma entidade
   */
  static calculate(
    entity: NormalizedEntity,
    jsdoc: ParsedJSDoc | null,
    semanticType: SemanticType,
    relationships: InferredRelationship[],
    allEntities: NormalizedEntity[]
  ): number {
    const evidence = this.gatherEvidence(
      entity,
      jsdoc,
      semanticType,
      relationships,
      allEntities
    );
    
    return this.computeScore(evidence);
  }

  /**
   * Coleta evidências para cálculo
   */
  private static gatherEvidence(
    entity: NormalizedEntity,
    jsdoc: ParsedJSDoc | null,
    semanticType: SemanticType,
    relationships: InferredRelationship[],
    allEntities: NormalizedEntity[]
  ): ConfidenceEvidence {
    // 1. JSDoc presente e bem documentado
    const hasJSDoc = !!jsdoc && jsdoc.description.length > 10;
    
    // 2. Tem anotações de tipo (params tipados, return type)
    const hasTypeAnnotations = !!jsdoc && (
      (jsdoc.params?.some(p => !!p.type) || false) ||
      !!jsdoc.returns?.type
    );
    
    // 3. Tem testes (verificar se existe entidade com nome similar + test/spec)
    const hasTests = allEntities.some(e => 
      e.name.toLowerCase().includes(entity.name.toLowerCase()) &&
      (e.name.toLowerCase().includes('test') || e.name.toLowerCase().includes('spec'))
    );
    
    // 4. Número de relacionamentos (mais = mais importante)
    const relationshipCount = relationships.length;
    
    // 5. Uso por outras entidades
    const usageCount = allEntities.filter(e => 
      relationships.some(r => r.target === e.name)
    ).length;
    
    // 6. É exportada (pública)
    const isExported = entity.category === 'internal' && entity.type === 'export';
    
    // 7. Confiança do tipo semântico (desconhecido = baixa)
    const semanticTypeConfidence = semanticType === 'unknown' ? 0.5 : 0.9;
    
    return {
      hasJSDoc,
      hasTypeAnnotations,
      hasTests,
      relationshipCount,
      usageCount,
      isExported,
      semanticTypeConfidence,
    };
  }

  /**
   * Computa score final baseado em evidências
   */
  private static computeScore(evidence: ConfidenceEvidence): number {
    let score = 0.5; // Base score
    
    // +0.15 se tem JSDoc
    if (evidence.hasJSDoc) {
      score += 0.15;
    }
    
    // +0.10 se tem type annotations
    if (evidence.hasTypeAnnotations) {
      score += 0.10;
    }
    
    // +0.10 se tem testes
    if (evidence.hasTests) {
      score += 0.10;
    }
    
    // +0.05 por relacionamento (max +0.15)
    score += Math.min(evidence.relationshipCount * 0.05, 0.15);
    
    // +0.03 por uso (max +0.10)
    score += Math.min(evidence.usageCount * 0.03, 0.10);
    
    // +0.05 se é exportada
    if (evidence.isExported) {
      score += 0.05;
    }
    
    // Multiplicar pelo semantic type confidence
    score *= evidence.semanticTypeConfidence;
    
    // Garantir range [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calcula confiança de um relacionamento
   */
  static calculateRelationshipConfidence(
    relationship: InferredRelationship,
    sourceEntity: NormalizedEntity,
    targetEntity?: NormalizedEntity
  ): number {
    let confidence = relationship.confidence;
    
    // Boost se target existe no sistema
    if (targetEntity) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }
    
    // Boost baseado em evidências
    const evidenceBoost = relationship.evidence.length * 0.05;
    confidence = Math.min(confidence + evidenceBoost, 1.0);
    
    // Penalty se é import externo sem package info
    if (relationship.type === 'imports' && 
        !sourceEntity.packageInfo && 
        sourceEntity.category === 'external') {
      confidence -= 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
}
