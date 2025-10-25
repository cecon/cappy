/**
 * @fileoverview AST-based entity extraction service
 * @module services/entity-extraction/core
 * @author Cappy Team
 * @since 3.2.0
 */

import { parse } from '@typescript-eslint/parser';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ExtractedEntity,
  EntityRelationship,
  EntityExtractionResult,
  EntityType,
  RelationshipType
} from '../../../../../shared/types/entity';
import type { DocumentChunk } from '../../../../../shared/types/chunk';

/**
 * Enhanced entity with detailed metadata
 */
export interface ASTEntity extends ExtractedEntity {
  /** Entity category: internal | external | builtin | jsx */
  category: 'internal' | 'external' | 'builtin' | 'jsx';
  
  /** Source file or module */
  source: string;
  
  /** Line number in source */
  line: number;
  
  /** Column number in source */
  column: number;
  
  /** Whether this entity is exported */
  isExported?: boolean;
  
  /** Function parameters (for functions) */
  parameters?: Array<{ name: string; type?: string }>;
  
  /** Return type (for functions) */
  returnType?: string;
  
  /** Variable type (for variables) */
  variableType?: string;
  
  /** Initial value (for variables) */
  initialValue?: string;
  
  /** Props (for React components) */
  props?: string[];
  
  /** Call target (for function calls) */
  callTarget?: string;
  
  /** Import specifiers */
  specifiers?: string[];
  
  /** Relationships to other entities */
  relationships?: Array<{
    target: string;
    type: string;
    confidence: number;
  }>;
}

/**
 * AST-based entity extractor for TypeScript/JavaScript code
 */
export class ASTEntityExtractor {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Extract entities from a file using AST analysis
   */
  async extractFromFile(filePath: string): Promise<ASTEntity[]> {
    const absFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);

    if (!fs.existsSync(absFilePath)) {
      console.warn(`⚠️ File not found: ${absFilePath}`);
      return [];
    }

    try {
      const content = fs.readFileSync(absFilePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
        tokens: false,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      });

      const entities: ASTEntity[] = [];
      const exportedNames = new Set<string>();

      // First pass: collect exported names
      this.collectExportedNames(ast, exportedNames);

      // Second pass: extract all entities
      this.extractEntities(ast, filePath, entities, exportedNames, content);

      console.log(`📊 Extracted ${entities.length} entities from ${filePath}`);
      return entities;
    } catch (error) {
      console.error(`❌ AST entity extraction error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extract entities from a chunk
   */
  async extractFromChunk(chunk: DocumentChunk): Promise<EntityExtractionResult> {
    const startTime = Date.now();
    const entities = await this.extractFromFile(chunk.metadata.filePath);
    
    // Filter entities to only those in the chunk's line range
    const chunkEntities = entities.filter(
      e => e.line >= chunk.metadata.lineStart && e.line <= chunk.metadata.lineEnd
    );

    // Convert to standard ExtractedEntity format
    const standardEntities: ExtractedEntity[] = chunkEntities.map(e => ({
      name: e.name,
      type: e.type,
      confidence: e.confidence,
      context: this.buildContext(e),
      metadata: {
        category: e.category,
        source: e.source,
        line: e.line,
        column: e.column,
        isExported: e.isExported,
        parameters: e.parameters,
        returnType: e.returnType,
        variableType: e.variableType,
        initialValue: e.initialValue,
        props: e.props,
        callTarget: e.callTarget,
        specifiers: e.specifiers
      }
    }));

    // Build relationships
    const relationships: EntityRelationship[] = [];
    for (const entity of chunkEntities) {
      if (entity.relationships) {
        for (const rel of entity.relationships) {
          relationships.push({
            from: entity.name,
            to: rel.target,
            type: rel.type as RelationshipType,
            confidence: rel.confidence,
            context: `${entity.source}:${entity.line}`
          });
        }
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      entities: standardEntities,
      relationships,
      chunkId: chunk.id,
      metadata: {
        timestamp: new Date().toISOString(),
        model: 'ast-extractor',
        processingTime
      }
    };
  }

  /**
   * First pass: collect all exported names
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private collectExportedNames(node: any, exportedNames: Set<string>): void {
    if (!node) return;

    // Export default declaration
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration?.id?.name) {
        exportedNames.add(node.declaration.id.name);
      }
    }

    // Export named declaration
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        // export const x = ...
        if (node.declaration.declarations) {
          for (const decl of node.declaration.declarations) {
            if (decl.id?.name) {
              exportedNames.add(decl.id.name);
            }
          }
        }
        // export function x() {}
        if (node.declaration.id?.name) {
          exportedNames.add(node.declaration.id.name);
        }
      }
      // export { x, y }
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          if (spec.exported?.name) {
            exportedNames.add(spec.exported.name);
          }
        }
      }
    }

    // Recursively visit children
    for (const key in node) {
      if (key !== 'parent' && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.collectExportedNames(child, exportedNames);
          }
        } else {
          this.collectExportedNames(node[key], exportedNames);
        }
      }
    }
  }

  /**
   * Second pass: extract all entities
   */
  private extractEntities(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: any,
    filePath: string,
    entities: ASTEntity[],
    exportedNames: Set<string>,
    content: string
  ): void {
    if (!node) return;

    const relFilePath = path.relative(this.workspaceRoot, filePath);

    // 1. Import declarations
    if (node.type === 'ImportDeclaration') {
      const source = node.source?.value;
      const specifiers: string[] = [];
      
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          const name = spec.imported?.name || spec.local?.name;
          if (name) specifiers.push(name);
        }
      }

      if (source) {
        const isExternal = this.isExternalImport(source);
        entities.push({
          name: source,
          type: 'package',
          category: isExternal ? 'external' : 'internal',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          specifiers,
          context: `import from '${source}'`
        });

        // Create entities for each imported specifier
        for (const spec of specifiers) {
          entities.push({
            name: spec,
            type: this.inferTypeFromName(spec),
            category: isExternal ? 'external' : 'internal',
            source: relFilePath,
            line: node.loc?.start?.line || 0,
            column: node.loc?.start?.column || 0,
            confidence: 0.9,
            relationships: [{
              target: source,
              type: 'imports',
              confidence: 1.0
            }]
          });
        }
      }
    }

    // 2. Function declarations
    if (node.type === 'FunctionDeclaration') {
      const name = node.id?.name;
      if (name) {
        const params = this.extractParameters(node.params);
        const returnType = this.extractTypeAnnotation(node.returnType);

        entities.push({
          name,
          type: 'function',
          category: 'internal',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          isExported: exportedNames.has(name),
          parameters: params,
          returnType
        });
      }
    }

    // 3. Arrow function expressions (as variable declarators)
    if (node.type === 'VariableDeclarator') {
      const name = node.id?.name;
      if (name && (node.init?.type === 'ArrowFunctionExpression' || node.init?.type === 'FunctionExpression')) {
        const params = this.extractParameters(node.init.params);
        const returnType = this.extractTypeAnnotation(node.init.returnType);

        entities.push({
          name,
          type: 'function',
          category: 'internal',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          isExported: exportedNames.has(name),
          parameters: params,
          returnType
        });
      } else if (name) {
        // 4. Variable declarations
        const varType = this.extractTypeAnnotation(node.id.typeAnnotation);
        const initialValue = this.extractInitialValue(node.init);

        entities.push({
          name,
          type: 'variable',
          category: 'internal',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          isExported: exportedNames.has(name),
          variableType: varType,
          initialValue
        });
      }
    }

    // 5. JSX Elements (React components)
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
      const componentName = node.openingElement?.name?.name;
      if (componentName && /^[A-Z]/.test(componentName)) {
        const props = this.extractJSXProps(node.openingElement);
        
        entities.push({
          name: componentName,
          type: 'component',
          category: 'jsx',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          props
        });
      }
    }

    // 6. Call expressions
    if (node.type === 'CallExpression') {
      const callName = this.extractCallName(node.callee);
      if (callName) {
        // Check if it's a logging/error call
        const isLogCall = ['console.log', 'console.error', 'console.warn', 'console.info', 'console.debug'].includes(callName);
        
        if (isLogCall && node.arguments?.length > 0) {
          // Extract literal strings from log calls
          const arg = node.arguments[0];
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            entities.push({
              name: arg.value.substring(0, 50), // Truncate long strings
              type: 'other',
              category: 'builtin',
              source: relFilePath,
              line: node.loc?.start?.line || 0,
              column: node.loc?.start?.column || 0,
              confidence: 0.7,
              callTarget: callName,
              context: `Log message in ${callName}`
            });
          }
        }

        entities.push({
          name: callName,
          type: 'function',
          category: this.inferCallCategory(callName),
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 0.8,
          context: `Called in ${relFilePath}`
        });
      }
    }

    // 7. Class declarations
    if (node.type === 'ClassDeclaration') {
      const name = node.id?.name;
      if (name) {
        entities.push({
          name,
          type: 'class',
          category: 'internal',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          isExported: exportedNames.has(name)
        });
      }
    }

    // 8. Interface declarations
    if (node.type === 'TSInterfaceDeclaration') {
      const name = node.id?.name;
      if (name) {
        entities.push({
          name,
          type: 'interface',
          category: 'internal',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          isExported: exportedNames.has(name)
        });
      }
    }

    // 9. Type alias declarations
    if (node.type === 'TSTypeAliasDeclaration') {
      const name = node.id?.name;
      if (name) {
        entities.push({
          name,
          type: 'type',
          category: 'internal',
          source: relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          confidence: 1.0,
          isExported: exportedNames.has(name)
        });
      }
    }

    // Recursively visit children
    for (const key in node) {
      if (key !== 'parent' && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.extractEntities(child, filePath, entities, exportedNames, content);
          }
        } else {
          this.extractEntities(node[key], filePath, entities, exportedNames, content);
        }
      }
    }
  }

  /**
   * Helper: Check if import is external
   */
  private isExternalImport(source: string): boolean {
    return !source.startsWith('.') && !source.startsWith('/');
  }

  /**
   * Helper: Infer entity type from name
   */
  private inferTypeFromName(name: string): EntityType {
    if (/^use[A-Z]/.test(name)) return 'function'; // React hooks
    if (/^[A-Z]/.test(name)) return 'component'; // Components or classes
    return 'other';
  }

  /**
   * Helper: Extract parameters from function
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractParameters(params: any[]): Array<{ name: string; type?: string }> {
    if (!params) return [];
    
    return params.map(param => ({
      name: param.name || 'unknown',
      type: this.extractTypeAnnotation(param.typeAnnotation)
    }));
  }

  /**
   * Helper: Extract type annotation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTypeAnnotation(typeAnnotation: any): string | undefined {
    if (!typeAnnotation) return undefined;
    
    const annotation = typeAnnotation.typeAnnotation || typeAnnotation;
    
    if (annotation.type === 'TSStringKeyword') return 'string';
    if (annotation.type === 'TSNumberKeyword') return 'number';
    if (annotation.type === 'TSBooleanKeyword') return 'boolean';
    if (annotation.type === 'TSTypeReference' && annotation.typeName?.name) {
      return annotation.typeName.name;
    }
    
    return 'any';
  }

  /**
   * Helper: Extract initial value
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractInitialValue(init: any): string | undefined {
    if (!init) return undefined;
    
    if (init.type === 'Literal') return String(init.value);
    if (init.type === 'ArrowFunctionExpression') return '(arrow function)';
    if (init.type === 'FunctionExpression') return '(function)';
    if (init.type === 'CallExpression') return '(function call)';
    if (init.type === 'ObjectExpression') return '(object)';
    if (init.type === 'ArrayExpression') return '(array)';
    
    return undefined;
  }

  /**
   * Helper: Extract JSX props
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractJSXProps(openingElement: any): string[] {
    if (!openingElement?.attributes) return [];
    
    return openingElement.attributes
      .filter((attr: any) => attr.type === 'JSXAttribute' && attr.name?.name)
      .map((attr: any) => attr.name.name);
  }

  /**
   * Helper: Extract call name
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractCallName(callee: any): string | undefined {
    if (!callee) return undefined;
    
    if (callee.type === 'Identifier') return callee.name;
    if (callee.type === 'MemberExpression') {
      const object = this.extractCallName(callee.object);
      const property = callee.property?.name;
      return object && property ? `${object}.${property}` : property;
    }
    
    return undefined;
  }

  /**
   * Helper: Infer call category
   */
  private inferCallCategory(callName: string): 'internal' | 'external' | 'builtin' | 'jsx' {
    if (callName.startsWith('console.')) return 'builtin';
    if (/^[A-Z]/.test(callName)) return 'jsx'; // Likely a component
    // For now, assume internal unless we have more context
    return 'internal';
  }

  /**
   * Helper: Build context string
   */
  private buildContext(entity: ASTEntity): string {
    const parts: string[] = [];
    
    if (entity.isExported) parts.push('exported');
    if (entity.parameters) parts.push(`params: ${entity.parameters.map(p => p.name).join(', ')}`);
    if (entity.returnType) parts.push(`returns: ${entity.returnType}`);
    if (entity.variableType) parts.push(`type: ${entity.variableType}`);
    if (entity.props) parts.push(`props: ${entity.props.join(', ')}`);
    
    return parts.length > 0 ? parts.join('; ') : `${entity.type} at ${entity.source}:${entity.line}`;
  }
}
