/**
 * @fileoverview Adapter para conectar entity-extraction e entity-filtering
 * @module services/entity-conversion
 * @author Cappy Team
 * @since 3.2.0
 * 
 * Converte ASTEntity[] (output do ASTEntityExtractor) para RawEntity[] (input do EntityFilterPipeline)
 */

import type { ASTEntity } from '../entity-extraction/types/ASTEntity';
import type { RawEntity } from '../entity-filtering/types/FilterTypes';

/**
 * Adapter para conectar os dois sistemas
 * 
 * Pipeline completo:
 * Código → ASTEntityExtractor → ASTEntity[] → ASTEntityAdapter → RawEntity[] → EntityFilterPipeline → EnrichedEntity[]
 */
export class ASTEntityAdapter {
  /**
   * Converte ASTEntity[] para RawEntity[]
   */
  static toRawEntities(astEntities: ASTEntity[]): RawEntity[] {
    return astEntities.map(entity => this.toRawEntity(entity));
  }

  /**
   * Converte uma única ASTEntity para RawEntity
   */
  static toRawEntity(astEntity: ASTEntity): RawEntity {
    const rawEntity: RawEntity = {
      type: this.mapEntityType(astEntity.type),
      name: astEntity.name,
      scope: this.mapScope(astEntity.category),
      line: astEntity.line
    };

    // Adicionar metadados opcionais
    if (astEntity.source) {
      rawEntity.source = astEntity.source;
    }

    // Preservar metadata do AST
    rawEntity.metadata = {
      category: astEntity.category,
      isExported: astEntity.isExported,
      exportType: astEntity.exportType,
      isImported: astEntity.isImported,
      originalModule: astEntity.originalModule,
      column: astEntity.column
    };

    return rawEntity;
  }

  /**
   * Mapeia tipo de entidade AST para tipo de entidade raw
   */
  private static mapEntityType(astType: string): RawEntity['type'] {
    const typeMap: Record<string, RawEntity['type']> = {
      'import': 'import',
      'export': 'export',
      'class': 'class',
      'function': 'function',
      'variable': 'variable',
      'interface': 'typeRef',
      'type': 'typeRef',
      'jsx': 'variable', // JSX components são tratados como variáveis
      'call': 'call'
    };

    return typeMap[astType] || 'variable';
  }

  /**
   * Mapeia categoria AST para escopo de entidade raw
   */
  private static mapScope(category: ASTEntity['category']): RawEntity['scope'] {
    const scopeMap: Record<ASTEntity['category'], RawEntity['scope']> = {
      'internal': 'local',
      'external': 'module',
      'builtin': 'global',
      'jsx': 'local'
    };

    return scopeMap[category] || 'local';
  }
}
