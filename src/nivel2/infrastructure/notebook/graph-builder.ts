/**
 * @fileoverview Knowledge graph builder from document chunks
 * @module infrastructure/notebook/graph-builder
 *
 * Extracts entities from chunks and builds a co-occurrence graph.
 * Entities are identified via pattern matching (PascalCase, file paths,
 * backtick terms, markdown headers).
 */

import type { GraphNode, GraphEdge, KnowledgeGraph, Chunk, GraphNodeType } from '../../../domains/notebook/notebook-types';

interface EntityOccurrence {
  label: string;
  type: GraphNodeType;
  chunkIds: Set<string>;
}

/**
 * Build a knowledge graph from document chunks.
 */
export class GraphBuilder {
  /**
   * Build a knowledge graph from chunks.
   */
  build(chunks: Chunk[]): KnowledgeGraph {
    // Step 1: Extract entities from all chunks
    const entityMap = new Map<string, EntityOccurrence>();

    for (const chunk of chunks) {
      const entities = this.extractEntities(chunk);
      for (const entity of entities) {
        const key = entity.label.toLowerCase();
        if (entityMap.has(key)) {
          entityMap.get(key)!.chunkIds.add(chunk.id);
        } else {
          entityMap.set(key, {
            label: entity.label,
            type: entity.type,
            chunkIds: new Set([chunk.id]),
          });
        }
      }
    }

    // Step 2: Create graph nodes
    const nodes: GraphNode[] = [];
    const nodeIdMap = new Map<string, string>(); // key → node id
    let nodeCounter = 0;

    for (const [key, occurrence] of entityMap) {
      // Skip entities that appear in only 1 chunk (not useful for graph)
      if (occurrence.chunkIds.size < 1) continue;

      const nodeId = `n_${String(++nodeCounter).padStart(3, '0')}`;
      nodeIdMap.set(key, nodeId);
      nodes.push({
        id: nodeId,
        label: occurrence.label,
        type: occurrence.type,
        chunkIds: Array.from(occurrence.chunkIds),
      });
    }

    // Step 3: Build edges based on co-occurrence
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>();
    const nodeKeys = Array.from(nodeIdMap.keys());

    for (let i = 0; i < nodeKeys.length; i++) {
      for (let j = i + 1; j < nodeKeys.length; j++) {
        const keyA = nodeKeys[i];
        const keyB = nodeKeys[j];
        const occA = entityMap.get(keyA)!;
        const occB = entityMap.get(keyB)!;

        // Compute co-occurrence (intersection of chunkIds)
        const intersection = new Set(
          [...occA.chunkIds].filter(id => occB.chunkIds.has(id))
        );

        if (intersection.size > 0) {
          const nodeIdA = nodeIdMap.get(keyA)!;
          const nodeIdB = nodeIdMap.get(keyB)!;
          const edgeKey = `${nodeIdA}-${nodeIdB}`;

          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);

            // Weight = co-occurrence count / max possible
            const maxCooccurrence = Math.min(occA.chunkIds.size, occB.chunkIds.size);
            const weight = intersection.size / maxCooccurrence;

            edges.push({
              source: nodeIdA,
              target: nodeIdB,
              label: 'co-occurs',
              weight: Math.round(weight * 100) / 100,
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Extract entities from a chunk's text.
   */
  private extractEntities(chunk: Chunk): Array<{ label: string; type: GraphNodeType }> {
    const entities: Array<{ label: string; type: GraphNodeType }> = [];
    const seen = new Set<string>();

    const addEntity = (label: string, type: GraphNodeType) => {
      const key = label.toLowerCase();
      if (!seen.has(key) && label.length > 2 && label.length < 80) {
        seen.add(key);
        entities.push({ label, type });
      }
    };

    const text = chunk.text;

    // 1. PascalCase identifiers (classes, types, components)
    const pascalRegex = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;
    let match: RegExpExecArray | null;
    while ((match = pascalRegex.exec(text)) !== null) {
      addEntity(match[1], 'entity');
    }

    // 2. File paths (with extensions)
    const fileRegex = /(?:^|\s)([\w/.@-]+\.(?:ts|js|json|md|tsx|jsx|py|go|rs|css|html|yaml|yml|toml))\b/g;
    while ((match = fileRegex.exec(text)) !== null) {
      addEntity(match[1], 'file');
    }

    // 3. Backtick terms (code references)
    const backtickRegex = /`([^`]+)`/g;
    while ((match = backtickRegex.exec(text)) !== null) {
      const term = match[1].trim();
      if (term.length > 2 && term.length < 60 && !term.includes('\n')) {
        addEntity(term, 'entity');
      }
    }

    // 4. Markdown headers (from section metadata)
    if (chunk.metadata.section) {
      addEntity(chunk.metadata.section, 'heading');
    }

    // 5. UPPER_SNAKE_CASE constants
    const constRegex = /\b([A-Z][A-Z0-9_]{2,})\b/g;
    while ((match = constRegex.exec(text)) !== null) {
      addEntity(match[1], 'entity');
    }

    return entities;
  }
}
