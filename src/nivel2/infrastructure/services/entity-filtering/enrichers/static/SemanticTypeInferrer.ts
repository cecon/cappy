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
 */
export class SemanticTypeInferrer {
  /**
   * Infere o tipo semântico de uma entidade
   */
  static infer(
    entity: NormalizedEntity,
    jsdoc?: ParsedJSDoc | null,
    sourceCode?: string
  ): SemanticType {
    const name = entity.name.toLowerCase();
    const normalizedName = entity.normalizedName.toLowerCase();
    
    // 1. Verificar tags JSDoc primeiro
    if (jsdoc?.tags) {
      const tagNames = jsdoc.tags.map(t => t.tag.toLowerCase());
      
      if (tagNames.includes('component') || tagNames.includes('react')) {
        return 'react-component';
      }
      if (tagNames.includes('hook')) {
        return 'react-hook';
      }
      if (tagNames.includes('api') || tagNames.includes('endpoint')) {
        return 'api-handler';
      }
      if (tagNames.includes('service')) {
        return 'service';
      }
      if (tagNames.includes('repository') || tagNames.includes('repo')) {
        return 'repository';
      }
      if (tagNames.includes('model') || tagNames.includes('entity')) {
        return 'entity';
      }
      if (tagNames.includes('dto')) {
        return 'dto';
      }
      if (tagNames.includes('util') || tagNames.includes('utility')) {
        return 'utility';
      }
      if (tagNames.includes('helper')) {
        return 'helper';
      }
      if (tagNames.includes('config') || tagNames.includes('configuration')) {
        return 'config';
      }
      if (tagNames.includes('test') || tagNames.includes('spec')) {
        return 'test-suite';
      }
    }
    
    // 2. Padrões de nome (React)
    if (this.isReactComponent(entity, sourceCode)) {
      return 'react-component';
    }
    if (this.isReactHook(entity)) {
      return 'react-hook';
    }
    if (this.isReactContext(entity)) {
      return 'react-context';
    }
    
    // 3. Padrões de nome (API)
    if (this.isAPIHandler(entity)) {
      return 'api-handler';
    }
    if (this.isAPIRoute(entity)) {
      return 'api-route';
    }
    if (this.isMiddleware(entity)) {
      return 'api-middleware';
    }
    
    // 4. Padrões de nome (Arquitetura)
    if (this.isService(entity)) {
      return 'service';
    }
    if (this.isRepository(entity)) {
      return 'repository';
    }
    if (this.isModel(entity)) {
      return 'model';
    }
    if (this.isDTO(entity)) {
      return 'dto';
    }
    if (this.isEntity(entity)) {
      return 'entity';
    }
    
    // 5. Padrões de nome (Utilitários)
    if (this.isUtility(entity)) {
      return 'utility';
    }
    if (this.isHelper(entity)) {
      return 'helper';
    }
    if (this.isConfig(entity)) {
      return 'config';
    }
    if (this.isConstant(entity)) {
      return 'constant';
    }
    if (this.isEnum(entity)) {
      return 'enum';
    }
    
    // 6. Padrões de nome (Testes)
    if (this.isTestSuite(entity)) {
      return 'test-suite';
    }
    if (this.isTestHelper(entity)) {
      return 'test-helper';
    }
    
    // 7. Built-in APIs (console, document, window, etc)
    if (this.isBuiltInAPI(entity)) {
      return 'utility';
    }
    
    // 8. Tipo definição
    if (entity.type === 'interface' || entity.type === 'type') {
      return 'type-definition';
    }
    
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
