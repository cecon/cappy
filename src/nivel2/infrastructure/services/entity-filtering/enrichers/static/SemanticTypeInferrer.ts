/**
 * @fileoverview Semantic type inference for entities
 * @module services/entity-filtering/enrichers/static
 * @author Cappy Team
 * @since 3.2.0
 */

import type { NormalizedEntity } from '../../types/FilterTypes';
import type { ParsedJSDoc } from './JSDocExtractor';

/**
 * Tipos semânticos inferidos
 */
export type SemanticType =
  | 'react-component'
  | 'react-hook'
  | 'react-context'
  | 'api-handler'
  | 'api-route'
  | 'api-middleware'
  | 'service'
  | 'repository'
  | 'model'
  | 'dto'
  | 'entity'
  | 'utility'
  | 'helper'
  | 'config'
  | 'constant'
  | 'enum'
  | 'type-definition'
  | 'test-suite'
  | 'test-helper'
  | 'unknown';

/**
 * Semantic Type Inferrer
 * Infere o tipo semântico de uma entidade baseado em padrões estáticos
 * 
 * Este inferidor usa uma abordagem em cascata, verificando em ordem de prioridade:
 * 1. Tags JSDoc explícitas (mais confiável)
 * 2. Análise de código-fonte (segunda mais confiável)
 * 3. Convenções de nomenclatura (menos confiável, mas útil)
 */
export class SemanticTypeInferrer {
  /**
   * Infere o tipo semântico de uma entidade usando análise estática em cascata
   * 
   * @param entity - Entidade normalizada a ser analisada
   * @param jsdoc - Documentação JSDoc parseada (opcional, mas aumenta precisão)
   * @param sourceCode - Código-fonte completo do arquivo (opcional, para análise profunda)
   * @returns Tipo semântico inferido da entidade
   * 
   * @description
   * Este método executa uma análise em cascata com 8 níveis de inferência:
   * 
   * **Nível 1 - Tags JSDoc (Prioridade Máxima)**
   * - Verifica tags explícitas como @component, @hook, @service, etc.
   * - Confiabilidade: 100% (desenvolvedor declarou explicitamente)
   * 
   * **Nível 2-6 - Análise de Padrões (Prioridade Alta)**
   * - React: Componentes (PascalCase + JSX), Hooks (use*), Context
   * - API: Handlers, Routes, Middleware
   * - Arquitetura: Services, Repositories, Models, DTOs, Entities
   * - Utilitários: Utils, Helpers, Config, Constants, Enums
   * - Testes: Suites, Helpers, Mocks
   * 
   * **Nível 7 - Built-in APIs (Prioridade Média)**
   * - Identifica APIs nativas do navegador/Node.js
   * 
   * **Nível 8 - Tipo TypeScript (Prioridade Baixa)**
   * - Entidades do tipo 'typeRef' são classificadas como 'type-definition'
   * 
   * **Fallback - Unknown**
   * - Se nenhum padrão for identificado, retorna 'unknown'
   * 
   * @example
   * ```typescript
   * // Componente React detectado por JSDoc
   * const entity1 = { name: 'MyButton', type: 'function' };
   * const jsdoc1 = { tags: [{ tag: 'component' }] };
   * infer(entity1, jsdoc1); // 'react-component'
   * 
   * // Hook detectado por nomenclatura
   * const entity2 = { name: 'useAuth', type: 'function' };
   * infer(entity2); // 'react-hook'
   * 
   * // Service detectado por sufixo
   * const entity3 = { name: 'UserService', type: 'class' };
   * infer(entity3); // 'service'
   * 
   * // Constante detectada por UPPER_CASE
   * const entity4 = { name: 'API_URL', type: 'variable' };
   * infer(entity4); // 'constant'
   * ```
   */
  static infer(
    entity: NormalizedEntity,
    jsdoc?: ParsedJSDoc | null,
    sourceCode?: string
  ): SemanticType {
    // ========================================
    // Nível 1: VERIFICAÇÃO DE TAGS JSDOC (PRIORIDADE MÁXIMA)
    // ========================================
    // Tags JSDoc são a fonte mais confiável, pois são declarações explícitas
    const jsdocType = this.inferFromJSDocTags(jsdoc);
    if (jsdocType !== 'unknown') {
      return jsdocType;
    }
    
    // ========================================
    // Nível 2: PADRÕES REACT (PRIORIDADE ALTA)
    // ========================================
    // React tem convenções fortes e bem definidas
    const reactType = this.inferReactType(entity, sourceCode);
    if (reactType !== 'unknown') {
      return reactType;
    }
    
    // ========================================
    // Nível 3: PADRÕES API (PRIORIDADE ALTA)
    // ========================================
    // Handlers, rotas e middleware de API
    const apiType = this.inferAPIType(entity);
    if (apiType !== 'unknown') {
      return apiType;
    }
    
    // ========================================
    // Nível 4: PADRÕES ARQUITETURAIS (PRIORIDADE MÉDIA)
    // ========================================
    // Services, Repositories, Models, DTOs, Entities
    const archType = this.inferArchitecturalType(entity);
    if (archType !== 'unknown') {
      return archType;
    }
    
    // ========================================
    // Nível 5: UTILITÁRIOS (PRIORIDADE MÉDIA)
    // ========================================
    // Utils, Helpers, Config, Constants, Enums
    const utilType = this.inferUtilityType(entity);
    if (utilType !== 'unknown') {
      return utilType;
    }
    
    // ========================================
    // Nível 6: TESTES (PRIORIDADE MÉDIA)
    // ========================================
    // Test suites, mocks, fixtures
    const testType = this.inferTestType(entity);
    if (testType !== 'unknown') {
      return testType;
    }
    
    // ========================================
    // Nível 7: BUILT-IN APIs (PRIORIDADE BAIXA)
    // ========================================
    // APIs nativas do navegador/Node.js
    if (this.isBuiltInAPI(entity)) {
      return 'utility';
    }
    
    // ========================================
    // Nível 8: TIPO TYPESCRIPT (PRIORIDADE BAIXA)
    // ========================================
    // TypeScript types/interfaces
    if (entity.type === 'typeRef') {
      return 'type-definition';
    }
    
    // ========================================
    // FALLBACK: UNKNOWN
    // ========================================
    // Nenhum padrão identificado
    return 'unknown';
  }

  /**
   * Infere tipo a partir de tags JSDoc
   */
  private static inferFromJSDocTags(jsdoc?: ParsedJSDoc | null): SemanticType {
    if (!jsdoc?.tags) return 'unknown';
    
    const tagNames = new Set(jsdoc.tags.map(t => t.tag.toLowerCase()));
    
    // Mapeamento direto de tags para tipos semânticos
    const tagToType: Record<string, SemanticType> = {
      'component': 'react-component',
      'react': 'react-component',
      'hook': 'react-hook',
      'api': 'api-handler',
      'endpoint': 'api-handler',
      'service': 'service',
      'repository': 'repository',
      'repo': 'repository',
      'model': 'entity',
      'entity': 'entity',
      'dto': 'dto',
      'util': 'utility',
      'utility': 'utility',
      'helper': 'helper',
      'config': 'config',
      'configuration': 'config',
      'test': 'test-suite',
      'spec': 'test-suite',
    };
    
    for (const [tag, type] of Object.entries(tagToType)) {
      if (tagNames.has(tag)) return type;
    }
    
    return 'unknown';
  }

  /**
   * Infere tipo relacionado ao React
   */
  private static inferReactType(entity: NormalizedEntity, sourceCode?: string): SemanticType {
    if (this.isReactComponent(entity, sourceCode)) return 'react-component';
    if (this.isReactHook(entity)) return 'react-hook';
    if (this.isReactContext(entity)) return 'react-context';
    return 'unknown';
  }

  /**
   * Infere tipo relacionado a APIs
   */
  private static inferAPIType(entity: NormalizedEntity): SemanticType {
    if (this.isAPIHandler(entity)) return 'api-handler';
    if (this.isAPIRoute(entity)) return 'api-route';
    if (this.isMiddleware(entity)) return 'api-middleware';
    return 'unknown';
  }

  /**
   * Infere tipo arquitetural (DDD, Clean Architecture, etc)
   */
  private static inferArchitecturalType(entity: NormalizedEntity): SemanticType {
    if (this.isService(entity)) return 'service';
    if (this.isRepository(entity)) return 'repository';
    if (this.isModel(entity)) return 'model';
    if (this.isDTO(entity)) return 'dto';
    if (this.isEntity(entity)) return 'entity';
    return 'unknown';
  }

  /**
   * Infere tipo utilitário
   */
  private static inferUtilityType(entity: NormalizedEntity): SemanticType {
    if (this.isUtility(entity)) return 'utility';
    if (this.isHelper(entity)) return 'helper';
    if (this.isConfig(entity)) return 'config';
    if (this.isConstant(entity)) return 'constant';
    if (this.isEnum(entity)) return 'enum';
    return 'unknown';
  }

  /**
   * Infere tipo relacionado a testes
   */
  private static inferTestType(entity: NormalizedEntity): SemanticType {
    if (this.isTestSuite(entity)) return 'test-suite';
    if (this.isTestHelper(entity)) return 'test-helper';
    return 'unknown';
  }

  // ==================== React Patterns ====================
  
  private static isReactComponent(entity: NormalizedEntity, sourceCode?: string): boolean {
    const name = entity.name;
    
    // Nome começa com letra maiúscula (convenção React)
    if (!/^[A-Z]/.test(name)) return false;
    
    // Padrões comuns
    if (name.endsWith('Component') || name.endsWith('Page') || name.endsWith('View')) {
      return true;
    }
    
    // Verificar se retorna JSX (se temos código-fonte)
    if (sourceCode && entity.type === 'function') {
      const funcPattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[^}]*return\\s+<`, 's');
      const arrowPattern = new RegExp(`(const|let|var)\\s+${name}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*[^{]*<`, 's');
      
      if (funcPattern.test(sourceCode) || arrowPattern.test(sourceCode)) {
        return true;
      }
    }
    
    return false;
  }

  private static isReactHook(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.startsWith('use') && /^use[A-Z]/.test(entity.name);
  }

  private static isReactContext(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.includes('context') || name.endsWith('provider');
  }

  // ==================== API Patterns ====================
  
  private static isAPIHandler(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.includes('handler') || 
           name.includes('controller') ||
           name.startsWith('handle') ||
           name.startsWith('on') && entity.type === 'function';
  }

  private static isAPIRoute(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.includes('route') || name.includes('endpoint');
  }

  private static isMiddleware(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.includes('middleware') || 
           name.endsWith('mw') ||
           name.startsWith('auth') && entity.type === 'function';
  }

  // ==================== Architecture Patterns ====================
  
  private static isService(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('service') || 
           name.includes('service') ||
           name.endsWith('svc');
  }

  private static isRepository(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('repository') || 
           name.endsWith('repo') ||
           name.includes('repository');
  }

  private static isModel(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('model') || name.includes('model');
  }

  private static isDTO(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('dto') || 
           name.includes('dto') ||
           name.endsWith('request') ||
           name.endsWith('response');
  }

  private static isEntity(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('entity') || 
           (entity.type === 'class' && !name.includes('service') && !name.includes('controller'));
  }

  // ==================== Utility Patterns ====================
  
  private static isUtility(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('util') || 
           name.endsWith('utils') ||
           name.includes('utility');
  }

  private static isHelper(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('helper') || 
           name.endsWith('helpers') ||
           name.includes('helper');
  }

  private static isConfig(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.includes('config') || 
           name.endsWith('configuration') ||
           name === 'settings' ||
           name === 'options';
  }

  private static isConstant(entity: NormalizedEntity): boolean {
    const name = entity.name;
    // Convenção: UPPER_CASE
    return /^[A-Z_][A-Z0-9_]*$/.test(name) && entity.type === 'variable';
  }

  private static isEnum(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('enum') || 
           name.endsWith('type') && entity.category === 'internal';
  }

  // ==================== Test Patterns ====================
  
  private static isTestSuite(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.endsWith('test') || 
           name.endsWith('spec') ||
           name.includes('.test') ||
           name.includes('.spec');
  }

  private static isTestHelper(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    return name.includes('mock') || 
           name.includes('fixture') ||
           name.includes('stub') ||
           name.startsWith('create') && name.includes('test');
  }

  // ==================== Built-in API Patterns ====================
  
  private static isBuiltInAPI(entity: NormalizedEntity): boolean {
    const name = entity.name.toLowerCase();
    
    // Browser APIs
    const browserAPIs = [
      'console', 'document', 'window', 'navigator', 'location',
      'localstorage', 'sessionstorage', 'fetch', 'xmlhttprequest',
      'getelementbyid', 'queryselector', 'addeventlistener'
    ];
    
    // Node APIs
    const nodeAPIs = [
      'process', 'buffer', 'require', 'module', 'exports',
      '__dirname', '__filename'
    ];
    
    // Verifica se o nome começa com alguma dessas APIs
    return browserAPIs.some(api => name.startsWith(api)) ||
           nodeAPIs.some(api => name.startsWith(api));
  }
}
