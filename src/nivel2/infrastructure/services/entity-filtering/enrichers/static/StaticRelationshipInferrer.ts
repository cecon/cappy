/**
 * @fileoverview Static relationship inference
 * @module services/entity-filtering/enrichers/static
 * @author Cappy Team
 * @since 3.2.0
 */

import type { NormalizedEntity } from '../../types/FilterTypes';

/**
 * Tipo de relacionamento inferido
 */
export type RelationshipType =
  | 'imports'
  | 'exports'
  | 'uses'
  | 'calls'
  | 'implements'
  | 'extends'
  | 'returns'
  | 'accepts'
  | 'throws'
  | 'depends-on';

/**
 * Relacionamento inferido estaticamente
 */
export interface InferredRelationship {
  target: string;
  type: RelationshipType;
  confidence: number;
  evidence: string[]; // Evidências usadas para inferir
}

/**
 * Static Relationship Inferrer
 * Infere relacionamentos entre entidades usando análise estática
 */
export class StaticRelationshipInferrer {
  /**
   * Infere todos os relacionamentos de uma entidade
   */
  static infer(
    entity: NormalizedEntity,
    allEntities: NormalizedEntity[],
    sourceCode?: string
  ): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];
    
    // 1. Relacionamentos de import/export
    relationships.push(...this.inferImportRelationships(entity));
    
    // 2. Relacionamentos de uso (calls, uses)
    if (sourceCode) {
      relationships.push(...this.inferUsageRelationships(entity, allEntities, sourceCode));
    }
    
    // 3. Relacionamentos de herança (extends, implements)
    if (sourceCode && (entity.type === 'class' || entity.type === 'typeRef')) {
      relationships.push(...this.inferInheritanceRelationships(entity, allEntities, sourceCode));
    }
    
    // 4. Relacionamentos de dependência
    relationships.push(...this.inferDependencyRelationships(entity, allEntities));
    
    return relationships;
  }

  // ==================== Import/Export Relationships ====================
  
  private static inferImportRelationships(entity: NormalizedEntity): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];
    
    if (entity.type === 'import' && entity.source) {
      relationships.push({
        target: entity.source,
        type: 'imports',
        confidence: 1, // Import é explícito
        evidence: ['explicit-import-statement'],
      });
    }
    
    if (entity.type === 'export') {
      // Exports são relacionamentos implícitos com consumidores (não temos info aqui)
      // Mas podemos marcar como "exportado" para outros processamentos
    }
    
    return relationships;
  }

  // ==================== Usage Relationships ====================
  
  private static inferUsageRelationships(
    entity: NormalizedEntity,
    allEntities: NormalizedEntity[],
    sourceCode: string
  ): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];
    
    // Procurar por menções de outras entidades no código desta entidade
    // Extrair a declaração da entidade
    const declaration = this.extractEntityDeclaration(entity, sourceCode);
    if (!declaration) return relationships;
    
    for (const otherEntity of allEntities) {
      if (otherEntity.name === entity.name) continue;
      
      const usageCount = this.countUsages(otherEntity.name, declaration);
      if (usageCount > 0) {
        const evidence: string[] = [];
        
        // Detectar tipo de uso
        let relType: RelationshipType = 'uses';
        
        // Chamada de função
        if (this.isCallExpression(otherEntity.name, declaration)) {
          relType = 'calls';
          evidence.push('call-expression');
        }
        // JSX usage
        else if (this.isJSXUsage(otherEntity.name, declaration)) {
          evidence.push('jsx-element');
        }
        // Tipo/Interface usage
        else if (otherEntity.type === 'typeRef') {
          evidence.push('type-reference');
        }
        // Outro uso genérico
        else {
          evidence.push('identifier-reference');
        }
        
        relationships.push({
          target: otherEntity.name,
          type: relType,
          confidence: Math.min(0.7 + (usageCount * 0.05), 0.95), // Mais usos = mais confiança
          evidence,
        });
      }
    }
    
    return relationships;
  }

  // ==================== Inheritance Relationships ====================
  
  private static inferInheritanceRelationships(
    entity: NormalizedEntity,
    _allEntities: NormalizedEntity[],
    sourceCode: string
  ): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];
    
    // Pattern: class MyClass extends BaseClass
    const extendsPattern = new RegExp(
      `class\\s+${entity.name}\\s+extends\\s+(\\w+)`,
      'g'
    );
    
    const extendsMatch = extendsPattern.exec(sourceCode);
    if (extendsMatch?.[1]) {
      const baseClass = extendsMatch[1];
      relationships.push({
        target: baseClass,
        type: 'extends',
        confidence: 1, // Extends é explícito
        evidence: ['class-declaration'],
      });
    }
    
    // Pattern: class MyClass implements Interface1, Interface2
    const implementsPattern = new RegExp(
      `class\\s+${entity.name}\\s+(?:extends\\s+\\w+\\s+)?implements\\s+([\\w,\\s]+)`,
      'g'
    );
    
    const implementsMatch = implementsPattern.exec(sourceCode);
    if (implementsMatch?.[1]) {
      const interfaces = implementsMatch[1].split(',').map(s => s.trim());
      for (const iface of interfaces) {
        relationships.push({
          target: iface,
          type: 'implements',
          confidence: 1, // Implements é explícito
          evidence: ['class-declaration'],
        });
      }
    }
    
    // Pattern: interface MyInterface extends BaseInterface
    const ifaceExtendsPattern = new RegExp(
      `interface\\s+${entity.name}\\s+extends\\s+([\\w,\\s]+)`,
      'g'
    );
    
    const ifaceExtendsMatch = ifaceExtendsPattern.exec(sourceCode);
    if (ifaceExtendsMatch?.[1]) {
      const baseInterfaces = ifaceExtendsMatch[1].split(',').map(s => s.trim());
      for (const base of baseInterfaces) {
        relationships.push({
          target: base,
          type: 'extends',
          confidence: 1,
          evidence: ['interface-declaration'],
        });
      }
    }
    
    return relationships;
  }

  // ==================== Dependency Relationships ====================
  
  private static inferDependencyRelationships(
    entity: NormalizedEntity,
    allEntities: NormalizedEntity[]
  ): InferredRelationship[] {
    return [
      ...this.inferPackageDependencies(entity),
      ...this.inferImportDependencies(entity, allEntities),
      ...this.inferCategoryDependencies(entity),
    ];
  }

  private static inferPackageDependencies(entity: NormalizedEntity): InferredRelationship[] {
    if (!entity.packageInfo) return [];
    
    return [{
      target: entity.packageInfo.name,
      type: 'depends-on',
      confidence: 1,
      evidence: ['package-json'],
    }];
  }

  private static inferImportDependencies(
    entity: NormalizedEntity,
    allEntities: NormalizedEntity[]
  ): InferredRelationship[] {
    if (entity.type !== 'import' || !entity.source) return [];
    
    const relationships: InferredRelationship[] = [];
    const sourceModule = entity.source;
    
    // Encontrar entidades exportadas do mesmo módulo
    const exportedEntities = allEntities.filter(
      e => e.type === 'export' && e.source === sourceModule
    );
    
    for (const exported of exportedEntities) {
      relationships.push({
        target: exported.name,
        type: 'depends-on',
        confidence: 0.8,
        evidence: ['import-from-same-module'],
      });
    }
    
    // Se há specifiers no import, criar dependência direta com eles
    if (entity.specifiers) {
      for (const specifier of entity.specifiers) {
        const targetEntity = allEntities.find(e => e.name === specifier);
        if (targetEntity) {
          relationships.push({
            target: specifier,
            type: 'depends-on',
            confidence: 0.9,
            evidence: ['import-specifier'],
          });
        }
      }
    }
    
    return relationships;
  }

  private static inferCategoryDependencies(entity: NormalizedEntity): InferredRelationship[] {
    if (entity.category !== 'external' || !entity.source) return [];
    
    // Extrair nome do pacote do source (ex: 'react' de 'react' ou '@mui/material' de '@mui/material')
    const packageName = entity.source.startsWith('@') 
      ? entity.source.split('/').slice(0, 2).join('/')
      : entity.source.split('/')[0];
    
    if (packageName === entity.name) return [];
    
    return [{
      target: packageName,
      type: 'depends-on',
      confidence: 0.85,
      evidence: ['external-package'],
    }];
  }

  // ==================== Helper Methods ====================
  
  private static extractEntityDeclaration(
    entity: NormalizedEntity,
    sourceCode: string
  ): string | null {
    const name = entity.name;
    
    // Patterns para diferentes tipos de declarações
    const patterns = [
      // Function declaration
      new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`, 's'),
      // Arrow function
      new RegExp(`(const|let|var)\\s+${name}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{[^}]*\\}`, 's'),
      // Class declaration
      new RegExp(`class\\s+${name}\\s*(?:extends\\s+\\w+)?\\s*\\{[^}]*\\}`, 's'),
      // Interface declaration
      new RegExp(`interface\\s+${name}\\s*(?:extends\\s+[\\w,\\s]+)?\\s*\\{[^}]*\\}`, 's'),
      // Type alias
      new RegExp(`type\\s+${name}\\s*=\\s*[^;]+;`, 's'),
      // Variable declaration
      new RegExp(`(const|let|var)\\s+${name}\\s*=\\s*[^;]+;`, 's'),
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(sourceCode);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }

  private static countUsages(name: string, code: string): number {
    // Usar word boundary para evitar false positives
    const pattern = new RegExp(`\\b${name}\\b`, 'g');
    const matches = code.match(pattern);
    return matches ? matches.length : 0;
  }

  private static isCallExpression(name: string, code: string): boolean {
    const pattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
    return pattern.test(code);
  }

  private static isJSXUsage(name: string, code: string): boolean {
    const pattern = new RegExp(`<${name}[\\s/>]`, 'g');
    return pattern.test(code);
  }
}
