/**
 * @fileoverview JSDoc extractor for static enrichment
 * @module services/entity-filtering/enrichers/static
 * @author Cappy Team
 * @since 3.2.0
 */

import { parse as parseJSDoc } from 'comment-parser';

/**
 * Estrutura de JSDoc parseado
 */
export interface ParsedJSDoc {
  description: string;
  summary: string;
  params: Array<{
    name: string;
    type?: string;
    description?: string;
    optional?: boolean;
    defaultValue?: string;
  }>;
  returns?: {
    type?: string;
    description?: string;
  };
  throws?: Array<{
    type?: string;
    description?: string;
  }>;
  tags: Array<{
    tag: string;
    name?: string;
    type?: string;
    description?: string;
  }>;
  examples?: string[];
  deprecated?: string;
  since?: string;
  author?: string;
  async?: boolean;
}

/**
 * JSDoc Static Extractor
 * Extrai e parseia comentários JSDoc do código-fonte
 */
export class JSDocExtractor {
  /**
   * Extrai JSDoc de um bloco de código dado o índice da linha da declaração
   */
  static extractFromSource(
    sourceCode: string,
    entityLine: number
  ): ParsedJSDoc | null {
    const lines = sourceCode.split('\n');
    
    // Procurar comentário JSDoc antes da linha da entidade
    let commentEndLine = entityLine - 1;
    let commentStartLine = -1;
    
    // Encontrar fim do comentário (pode ter linhas vazias entre comentário e declaração)
    while (commentEndLine >= 0 && lines[commentEndLine].trim() === '') {
      commentEndLine--;
    }
    
    if (commentEndLine < 0) return null;
    
    // Verificar se termina com */
    if (!lines[commentEndLine].trim().endsWith('*/')) {
      return null;
    }
    
    // Encontrar início do comentário
    commentStartLine = commentEndLine;
    while (commentStartLine > 0 && !lines[commentStartLine].trim().startsWith('/**')) {
      commentStartLine--;
    }
    
    if (!lines[commentStartLine].trim().startsWith('/**')) {
      return null;
    }
    
    // Extrair bloco de comentário
    const commentBlock = lines.slice(commentStartLine, commentEndLine + 1).join('\n');
    
    return this.parseJSDoc(commentBlock);
  }

  /**
   * Parseia um bloco JSDoc usando comment-parser
   */
  static parseJSDoc(commentBlock: string): ParsedJSDoc | null {
    try {
      const parsed = parseJSDoc(commentBlock, {
        spacing: 'preserve',
      });
      
      if (parsed.length === 0) return null;
      
      const block = parsed[0];
      
      // Extrair params
      const params = block.tags
        .filter((t: any) => t.tag === 'param' || t.tag === 'arg' || t.tag === 'argument')
        .map((t: any) => ({
          name: t.name,
          type: t.type,
          description: t.description,
          optional: t.optional,
          defaultValue: t.default,
        }));
      
      // Extrair returns
      const returnTag = block.tags.find((t: any) => t.tag === 'returns' || t.tag === 'return');
      const returns = returnTag ? {
        type: returnTag.type,
        description: returnTag.description,
      } : undefined;
      
      // Extrair throws
      const throws = block.tags
        .filter((t: any) => t.tag === 'throws' || t.tag === 'throw' || t.tag === 'exception')
        .map((t: any) => ({
          type: t.type,
          description: t.description,
        }));
      
      // Extrair examples
      const examples = block.tags
        .filter((t: any) => t.tag === 'example')
        .map((t: any) => t.description);
      
      // Extrair outros metadados
      const deprecatedTag = block.tags.find((t: any) => t.tag === 'deprecated');
      const sinceTag = block.tags.find((t: any) => t.tag === 'since');
      const authorTag = block.tags.find((t: any) => t.tag === 'author');
      const asyncTag = block.tags.find((t: any) => t.tag === 'async');
      
      // Outros tags genéricos
      const genericTags = block.tags
        .filter((t: any) => !['param', 'returns', 'return', 'throws', 'throw', 'exception', 
                       'example', 'deprecated', 'since', 'author', 'async'].includes(t.tag))
        .map((t: any) => ({
          tag: t.tag,
          name: t.name,
          type: t.type,
          description: t.description,
        }));
      
      return {
        description: block.description,
        summary: block.description.split('\n')[0] || '', // Primeira linha como summary
        params,
        returns,
        throws: throws.length > 0 ? throws : undefined,
        tags: genericTags,
        examples: examples.length > 0 ? examples : undefined,
        deprecated: deprecatedTag?.description,
        since: sinceTag?.description,
        author: authorTag?.description,
        async: !!asyncTag,
      };
    } catch (error) {
      console.warn('⚠️ [JSDocExtractor] Failed to parse JSDoc:', error);
      return null;
    }
  }

  /**
   * Extrai JSDoc de múltiplas entidades em um arquivo
   */
  static extractBatch(
    sourceCode: string,
    entities: Array<{ name: string; line: number }>
  ): Map<string, ParsedJSDoc> {
    const results = new Map<string, ParsedJSDoc>();
    
    for (const entity of entities) {
      const jsdoc = this.extractFromSource(sourceCode, entity.line);
      if (jsdoc) {
        results.set(entity.name, jsdoc);
      }
    }
    
    return results;
  }

  /**
   * Verifica se uma entidade tem JSDoc documentado
   */
  static hasDocumentation(sourceCode: string, entityLine: number): boolean {
    return this.extractFromSource(sourceCode, entityLine) !== null;
  }
}
