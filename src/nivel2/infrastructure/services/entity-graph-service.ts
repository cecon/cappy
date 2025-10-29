/**
 * @fileoverview Entity graph integration service
 * @module services/entity-graph-service
 * @author Cappy Team
 * @since 3.1.0
 */

import type { GraphStorePort } from '../../../domains/dashboard/ports/indexing-port';
import type { ExtractedEntity, EntityRelationship, EntityExtractionResult } from '../../../shared/types/entity';
import type { DocumentChunk } from '../../../shared/types/chunk';

/**
 * Service for integrating extracted entities into the graph
 */
export class EntityGraphService {
  private graphStore: GraphStorePort;
  constructor(graphStore: GraphStorePort) {
    this.graphStore = graphStore;
  }

  /**
   * Processes extraction results and integrates with graph
   */
  async integrateEntities(
    chunks: DocumentChunk[],
    extractionResults: EntityExtractionResult[]
  ): Promise<void> {
    console.log(`🔗 Integrating entities from ${extractionResults.length} extraction results...`);

    const startTime = Date.now();
    const stats = {
      entitiesCreated: 0,
      entitiesLinked: 0,
      relationshipsCreated: 0
    };

    // Process each extraction result
    for (const result of extractionResults) {
      const chunk = chunks.find(c => c.id === result.chunkId);
      if (!chunk) {
        console.warn(`⚠️ Chunk not found for extraction result: ${result.chunkId}`);
        continue;
      }

      // 1. Create or link entities
      for (const entity of result.entities) {
        const created = await this.createOrLinkEntity(entity, chunk);
        if (created) {
          stats.entitiesCreated++;
        } else {
          stats.entitiesLinked++;
        }
      }

      // 2. Create relationships
      for (const relationship of result.relationships) {
        await this.createEntityRelationship(relationship, chunk);
        stats.relationshipsCreated++;
      }

      // 3. Link chunk to entities
      await this.linkChunkToEntities(chunk, result.entities);
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ Entity integration complete (${totalTime}ms):`);
    console.log(`   📦 Entities created: ${stats.entitiesCreated}`);
    console.log(`   🔗 Entities linked: ${stats.entitiesLinked}`);
    console.log(`   ↔️  Relationships created: ${stats.relationshipsCreated}`);
  }

  /**
   * Creates or links an entity in the graph
   * Returns true if created, false if linked to existing
   */
  private async createOrLinkEntity(
    entity: ExtractedEntity,
    chunk: DocumentChunk
  ): Promise<boolean> {
    const entityNodeId = this.generateEntityNodeId(entity.name, entity.type);

    // Check if entity already exists
    const existingChunks = await this.findEntityReferences(entity.name);

    if (existingChunks.length > 0) {
      // Entity exists - just link it
      console.log(`   🔗 Linking existing entity: ${entity.name} (${entity.type})`);
      return false;
    }

    // Create new entity node
    await this.graphStore.createRelationships([
      {
        from: 'entity:' + entityNodeId,
        to: chunk.id,
        type: 'mentioned_in',
        properties: {
          confidence: entity.confidence,
          context: entity.context || '',
          entityType: entity.type
        }
      }
    ]);

    console.log(`   ✨ Created entity: ${entity.name} (${entity.type})`);
    return true;
  }

  /**
   * Creates a relationship between entities
   */
  private async createEntityRelationship(
    relationship: EntityRelationship,
    chunk: DocumentChunk
  ): Promise<void> {
    const fromId = this.generateEntityNodeId(relationship.from, 'entity');
    const toId = this.generateEntityNodeId(relationship.to, 'entity');

    await this.graphStore.createRelationships([
      {
        from: 'entity:' + fromId,
        to: 'entity:' + toId,
        type: relationship.type,
        properties: {
          confidence: relationship.confidence,
          context: relationship.context || '',
          discoveredIn: chunk.id,
          discoveredAt: new Date().toISOString()
        }
      }
    ]);

    console.log(`   ↔️  Created relationship: ${relationship.from} --[${relationship.type}]--> ${relationship.to}`);
  }

  /**
   * Links a chunk to all its mentioned entities
   */
  private async linkChunkToEntities(
    chunk: DocumentChunk,
    entities: ExtractedEntity[]
  ): Promise<void> {
    const relationships = entities.map(entity => ({
      from: chunk.id,
      to: 'entity:' + this.generateEntityNodeId(entity.name, entity.type),
      type: 'mentions',
      properties: {
        entityType: entity.type,
        confidence: entity.confidence,
        context: entity.context || ''
      }
    }));

    if (relationships.length > 0) {
      await this.graphStore.createRelationships(relationships);
    }
  }

  /**
   * Finds existing references to an entity
   */
  private async findEntityReferences(entityName: string): Promise<string[]> {
    // Query graph for existing entity mentions
    // For now, we'll do a simple check via getRelatedChunks
    // In production, this should be a proper entity search
    try {
      const entityNodeId = 'entity:' + this.generateEntityNodeId(entityName, 'entity');
      const related = await this.graphStore.getRelatedChunks([entityNodeId], 1);
      return related;
    } catch {
      return [];
    }
  }

  /**
   * Finds code nodes that match an entity
   * (e.g., find class "UserService" in code when mentioned in docs)
   */
  async linkEntitiesToCode(entities: ExtractedEntity[]): Promise<void> {
    console.log(`🔍 Linking ${entities.length} entities to code...`);

    for (const entity of entities) {
      // Only link class, function, interface, type entities
      if (!['class', 'function', 'interface', 'type', 'component', 'service'].includes(entity.type)) {
        continue;
      }

      // Search for code chunks that define this entity
      const codeChunks = await this.findCodeDefinition(entity.name);

      if (codeChunks.length > 0) {
        const entityNodeId = 'entity:' + this.generateEntityNodeId(entity.name, entity.type);

        // Create relationships from entity to code definitions
        const relationships = codeChunks.map(chunkId => ({
          from: entityNodeId,
          to: chunkId,
          type: 'defined_in',
          properties: {
            entityType: entity.type,
            confidence: 0.9
          }
        }));

        await this.graphStore.createRelationships(relationships);
        console.log(`   🎯 Linked ${entity.name} to ${codeChunks.length} code definition(s)`);
      }
    }
  }

  /**
   * Finds code chunks that define a symbol
   */
  private async findCodeDefinition(symbolName: string): Promise<string[]> {
    // Minimal implementation using available GraphStorePort APIs:
    // - list all files
    // - get their chunk nodes (id, type, label)
    // - match chunks whose label equals the normalized symbol name
    // Note: label is set to symbolName when available (see SQLite adapter)
    try {
      if (!symbolName || !symbolName.trim()) return [];

      const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');
      const base = normalize(symbolName)
        // strip common generic/namespace/noise parts
        .replace(/<.*?>$/, '') // remove trailing generics, e.g., Foo<T>
        .replace(/.*[.#:]/, ''); // keep right-most segment after ., #, :

      const targetLower = base.toLowerCase();

      const files = await this.graphStore.listAllFiles();
      const matches: string[] = [];

      for (const f of files) {
        const chunks = await this.graphStore.getFileChunks(f.path);
        for (const c of chunks) {
          // c.label is either symbolName or a fallback like "code [start-end]"
          if (!c.label) continue;
          const labelLower = String(c.label).toLowerCase();
          if (labelLower === targetLower) {
            matches.push(c.id);
          }
        }
      }

      // de-duplicate and cap results
      const deduped = Array.from(new Set(matches)).slice(0, 50);
      return deduped;
    } catch (err) {
      console.warn(`⚠️ Symbol search failed for ${symbolName}:`, err);
      return [];
    }
  }

  /**
   * Generates a consistent entity node ID
   */
  private generateEntityNodeId(name: string, type: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${type}:${normalized}`;
  }

  /**
   * Gets entity statistics
   */
  async getEntityStats(): Promise<{
    totalEntities: number;
    entitiesByType: Record<string, number>;
    linkedToCode: number;
  }> {
    // Placeholder - would query graph for actual stats
    return {
      totalEntities: 0,
      entitiesByType: {},
      linkedToCode: 0
    };
  }
}

/**
 * Factory function to create entity graph service
 */
export function createEntityGraphService(graphStore: GraphStorePort): EntityGraphService {
  return new EntityGraphService(graphStore);
}
