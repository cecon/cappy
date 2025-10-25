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

  /**
   * Converte entidades agrupadas por tipo (para compatibilidade com ASTRelationshipExtractor.analyze)
   */
  static toAnalysisFormat(astEntities: ASTEntity[]): {
    imports: Array<{ source: string; specifiers: string[]; isExternal: boolean }>;
    exports: string[];
    calls: string[];
    typeRefs: string[];
  } {
    console.log(`🔄 [ASTEntityAdapter] Converting ${astEntities.length} AST entities to analysis format`);
    
    const imports: Array<{ source: string; specifiers: string[]; isExternal: boolean }> = [];
    const exports: string[] = [];
    const calls: string[] = [];
    const typeRefs: string[] = [];

    for (const entity of astEntities) {
      // Use 'kind' field (AST node kind) for correct categorization
      const kind = entity.kind;
      
      if (kind === 'import' && entity.originalModule) {
        // Agrupar imports pela source
        const existing = imports.find(imp => imp.source === entity.originalModule);
        if (existing) {
          existing.specifiers.push(entity.name);
        } else {
          imports.push({
            source: entity.originalModule,
            specifiers: [entity.name],
            isExternal: entity.category === 'external' || entity.category === 'builtin'
          });
        }
      } else if (kind === 'export' && entity.isExported) {
        exports.push(entity.name);
      } else if (kind === 'call') {
        calls.push(entity.name);
      } else if (entity.type === 'interface' || entity.type === 'type') {
        typeRefs.push(entity.name);
      }
    }

    console.log(`✨ [ASTEntityAdapter] Converted to: ${imports.length} imports, ${exports.length} exports, ${calls.length} calls, ${typeRefs.length} typeRefs`);
    
    return { imports, exports, calls, typeRefs };
  }

  /**
   * Cria RawEntity[] no formato esperado pelo EntityFilterPipeline
   * A partir do formato de análise do ASTRelationshipExtractor
   */
  static fromAnalysisFormat(analysis: {
    imports: Array<{ source: string; specifiers: string[]; isExternal: boolean; packageResolution?: unknown }>;
    exports: string[];
    calls: string[];
    typeRefs: string[];
  }): RawEntity[] {
    const rawEntities: RawEntity[] = [];

    // Converter imports
    for (const imp of analysis.imports) {
      rawEntities.push({
        type: 'import',
        name: imp.specifiers[0] || imp.source,
        source: imp.source,
        specifiers: imp.specifiers,
        scope: 'module',
        metadata: {
          isExternal: imp.isExternal,
          packageResolution: imp.packageResolution
        }
      });
    }

    // Converter exports
    for (const exp of analysis.exports) {
      rawEntities.push({
        type: 'export',
        name: exp,
        scope: 'module'
      });
    }

    // Converter calls
    for (const call of analysis.calls) {
      rawEntities.push({
        type: 'call',
        name: call,
        scope: 'local'
      });
    }

    // Converter type refs
    for (const ref of analysis.typeRefs) {
      rawEntities.push({
        type: 'typeRef',
        name: ref,
        scope: 'global'
      });
    }

    return rawEntities;
  }
}
