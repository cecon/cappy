import type { NormalizedEntity } from '../types/FilterTypes';
import type { GraphStorePort } from '../../../../../domains/graph/ports/indexing-port';

/**
 * Serviço de descoberta de entidades existentes no grafo
 */
export class EntityDiscoveryService {
  /**
   * Busca entidade existente no grafo
   * 
   * Consulta o banco para verificar se uma entidade com o mesmo nome já existe.
   * Retorna o ID da entidade se encontrada, ou undefined se não existir.
   */
  static async discover(
    entity: NormalizedEntity,
    graphStore: GraphStorePort
  ): Promise<string | undefined> {
    try {
      const entityNodeId = `entity:${entity.name}:${entity.type}`;
      
      console.log(`   🔍 Searching for existing entity: ${entityNodeId}`);
      
      // Tenta encontrar relacionamentos existentes
      const relatedChunks = await graphStore.getRelatedChunks([entityNodeId], 1);
      
      if (relatedChunks.length > 0) {
        console.log(`   ✅ FOUND! ${relatedChunks.length} related chunks for "${entity.name}"`);
        return entityNodeId;
      }
      
      console.log(`   ❌ Not found in graph: ${entity.name}`);
      return undefined;
    } catch (error) {
      console.log(`   ⚠️ Discovery error for ${entity.name}:`, error);
      return undefined;
    }
  }
}
