/**
 * @fileoverview JSDoc Vector Embedding Filter
 * @module services/entity-filtering/filters
 * @author Cappy Team
 * @since 3.2.0
 */

import type { StaticallyEnrichedEntity } from './StaticEnrichmentFilter';

/**
 * Entidade com embedding de JSDoc
 */
export interface JSDocEmbeddedEntity extends StaticallyEnrichedEntity {
  jsdocEmbedding?: {
    vector: number[];
    text: string; // Texto usado para gerar o embedding
    dimensions: number;
    model: string;
  };
}

/**
 * JSDoc Vector Embedding Filter
 * Gera embeddings vetoriais para documentação JSDoc
 */
export class JSDocEmbeddingFilter {
  /**
   * Aplica geração de embeddings em lote
   */
  static async apply(
    entities: StaticallyEnrichedEntity[],
    embeddingService?: { initialize: () => Promise<void>; embed: (text: string) => Promise<number[]> }
  ): Promise<JSDocEmbeddedEntity[]> {
    console.log(`\n🔮 [JSDocEmbedding] Processing ${entities.length} entities...`);
    
    const embedded: JSDocEmbeddedEntity[] = [];
    
    // Filtrar entidades que têm JSDoc
    const entitiesWithJSDoc = entities.filter(e => e.jsdoc);
    console.log(`   📝 Found ${entitiesWithJSDoc.length} entities with JSDoc`);
    
    if (!embeddingService) {
      console.log(`   ⚠️ No embedding service provided, skipping embeddings`);
      // Retornar entidades sem embeddings
      return entities.map(e => ({ ...e }));
    }
    
    // Inicializar embedding service se necessário
    try {
      await embeddingService.initialize();
    } catch (error) {
      console.error(`   ❌ Failed to initialize embedding service:`, error);
      return entities.map(e => ({ ...e }));
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Processar cada entidade
    for (const entity of entities) {
      if (!entity.jsdoc) {
        // Entidade sem JSDoc, apenas copiar
        embedded.push({ ...entity });
        continue;
      }
      
      try {
        // Construir texto para embedding
        const docText = this.buildDocumentationText(entity);
        
        if (!docText.trim()) {
          embedded.push({ ...entity });
          continue;
        }
        
        // Gerar embedding
        const vector = await embeddingService.embed(docText);
        
        embedded.push({
          ...entity,
          jsdocEmbedding: {
            vector,
            text: docText,
            dimensions: vector.length,
            model: 'Xenova/all-MiniLM-L6-v2'
          }
        });
        
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed to embed JSDoc for "${entity.name}":`, error);
        embedded.push({ ...entity });
        errorCount++;
      }
    }
    
    console.log(`   ✅ Generated ${successCount} embeddings`);
    if (errorCount > 0) {
      console.log(`   ⚠️ Failed: ${errorCount} embeddings`);
    }
    
    // Estatísticas
    const avgVectorSize = embedded
      .filter(e => e.jsdocEmbedding)
      .reduce((sum, e) => sum + (e.jsdocEmbedding?.dimensions || 0), 0) / successCount;
    
    console.log(`   📊 Average vector size: ${avgVectorSize.toFixed(0)} dimensions`);
    
    return embedded;
  }
  
  /**
   * Constrói texto para embedding a partir do JSDoc
   */
  private static buildDocumentationText(entity: StaticallyEnrichedEntity): string {
    if (!entity.jsdoc) return '';

    const parts: string[] = [];

    // Nome da entidade
    parts.push(`Entity: ${entity.name}`);

    // Tipo semântico
    if (entity.semanticType && entity.semanticType !== 'unknown') {
      parts.push(`Type: ${entity.semanticType}`);
    }

    // Descrição principal
    if (entity.jsdoc.description) {
      parts.push(entity.jsdoc.description);
    }

    // Parâmetros
    parts.push(...this.buildParamsText(entity));

    // Retorno
    const returnsText = this.buildReturnsText(entity);
    if (returnsText) parts.push(returnsText);

    // Throws
    parts.push(...this.buildThrowsText(entity));

    // Tags importantes
    if (entity.jsdoc.deprecated) {
      parts.push(`@deprecated ${entity.jsdoc.deprecated}`);
    }

    if (entity.jsdoc.since) {
      parts.push(`@since ${entity.jsdoc.since}`);
    }

    // Examples
    parts.push(...this.buildExamplesText(entity));

    return parts.join('\n').trim();
  }

  private static buildParamsText(entity: StaticallyEnrichedEntity): string[] {
    if (!entity.jsdoc?.params || entity.jsdoc.params.length === 0) return [];
    return entity.jsdoc.params.map(p => {
      const paramParts = [`@param ${p.name}`];
      if (p.type) paramParts.push(`{${p.type}}`);
      if (p.description) paramParts.push(p.description);
      return paramParts.join(' ');
    });
  }

  private static buildReturnsText(entity: StaticallyEnrichedEntity): string {
    if (!entity.jsdoc?.returns) return '';
    const returnParts = ['@returns'];
    if (entity.jsdoc.returns.type) returnParts.push(`{${entity.jsdoc.returns.type}}`);
    if (entity.jsdoc.returns.description) returnParts.push(entity.jsdoc.returns.description);
    return returnParts.join(' ');
  }

  private static buildThrowsText(entity: StaticallyEnrichedEntity): string[] {
    if (!entity.jsdoc?.throws || entity.jsdoc.throws.length === 0) return [];
    return entity.jsdoc.throws.map(t => {
      const throwParts = ['@throws'];
      if (t.type) throwParts.push(`{${t.type}}`);
      if (t.description) throwParts.push(t.description);
      return throwParts.join(' ');
    });
  }

  private static buildExamplesText(entity: StaticallyEnrichedEntity): string[] {
    if (!entity.jsdoc?.examples || entity.jsdoc.examples.length === 0) return [];
    return entity.jsdoc.examples.map(ex => `Example: ${ex}`);
  }
  
  /**
   * Enriquece uma única entidade
   */
  static async enrichOne(
    entity: StaticallyEnrichedEntity,
    embeddingService?: { initialize: () => Promise<void>; embed: (text: string) => Promise<number[]> }
  ): Promise<JSDocEmbeddedEntity> {
    if (!entity.jsdoc || !embeddingService) {
      return { ...entity };
    }
    
    try {
      await embeddingService.initialize();
      
      const docText = this.buildDocumentationText(entity);
      if (!docText.trim()) {
        return { ...entity };
      }
      
      const vector = await embeddingService.embed(docText);
      
      return {
        ...entity,
        jsdocEmbedding: {
          vector,
          text: docText,
          dimensions: vector.length,
          model: 'Xenova/all-MiniLM-L6-v2'
        }
      };
    } catch (error) {
      console.error(`Failed to embed JSDoc for "${entity.name}":`, error);
      return { ...entity };
    }
  }
}
