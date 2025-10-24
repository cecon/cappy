import type { DiscoveredEntity } from '../entities/DiscoveredEntity';
import type { DiscoveredRelationship } from '../entities/DiscoveredRelationship';
import type { GraphStorePort } from '../../../../../domains/graph/ports/indexing-port';

export class EntityResolutionService {
  private graphStore: GraphStorePort;
  constructor(graphStore: GraphStorePort) {
    this.graphStore = graphStore;
  }

  async resolveOrCreateEntity(discovered: DiscoveredEntity): Promise<string> {
    const normalizedName = this.normalizeEntityName(discovered.name);
    const existing = await this.findSimilarEntity(normalizedName, discovered.discoveredType);
    if (existing) {
      return existing.id;
    }
    return await this.graphStore.createEntity({
      name: normalizedName,
      type: discovered.discoveredType,
      confidence: discovered.confidence,
      properties: discovered.properties || {}
    });
  }

  private normalizeEntityName(name: string): string {
    return name.toLowerCase()
      .replace(/\.js$/, '')
      .replace(/\s+(framework|library|service|api)$/, '')
      .trim();
  }

  private async findSimilarEntity(name: string, type: string): Promise<{id: string} | null> {
    return await this.graphStore.findEntityByNameAndType(name, type);
  }

  async createRelationshipIfValid(rel: DiscoveredRelationship): Promise<void> {
    const fromId = await this.resolveEntityByName(rel.from);
    const toId = await this.resolveEntityByName(rel.to);
    if (fromId && toId) {
      await this.graphStore.createRelationship({
        from: fromId,
        to: toId,
        type: rel.discoveredType,
        properties: { confidence: rel.confidence, context: rel.context }
      });
    }
  }

  private async resolveEntityByName(name: string): Promise<string | null> {
    // Busca por nome normalizado, tipo pode ser indefinido
    const normalizedName = this.normalizeEntityName(name);
    const found = await this.graphStore.findEntityByNameAndType(normalizedName, undefined);
    return found ? found.id : null;
  }
}
