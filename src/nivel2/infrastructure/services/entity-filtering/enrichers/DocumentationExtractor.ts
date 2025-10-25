import type { NormalizedEntity } from '../types/FilterTypes';
import type { DocumentChunk } from '../../../../../shared/types/chunk';

/**
 * Extrai documentação de chunks relacionados
 */
export class DocumentationExtractor {
  /**
   * Extrai documentação para uma entidade
   */
  static extract(entity: NormalizedEntity, chunks?: DocumentChunk[]): string | undefined {
    if (!chunks || chunks.length === 0) return undefined;

    const relatedChunk = chunks.find(chunk => 
      chunk.metadata?.symbolName === entity.name &&
      (chunk.metadata?.chunkType === 'jsdoc' || chunk.metadata?.chunkType === 'phpdoc')
    );

    return relatedChunk?.content;
  }
}
