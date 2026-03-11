/**
 * @fileoverview Hybrid retriever — vector search + graph walk
 * @module infrastructure/notebook/retriever
 */

import type { NotebookData, SearchResult, Chunk } from '../../../domains/notebook/notebook-types';
import { HashEmbedder, cosineSimilarity } from './embedder';

export interface RetrieverOptions {
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Weight for vector score in hybrid ranking (default: 0.7) */
  vectorWeight?: number;
  /** Weight for graph score in hybrid ranking (default: 0.3) */
  graphWeight?: number;
}

const DEFAULT_OPTIONS: Required<RetrieverOptions> = {
  topK: 5,
  vectorWeight: 0.7,
  graphWeight: 0.3,
};

/**
 * Hybrid retriever combining vector similarity and graph proximity.
 */
export class Retriever {
  private readonly embedder: HashEmbedder;

  constructor() {
    this.embedder = new HashEmbedder();
  }

  /**
   * Search a notebook with a text query.
   * Returns top-K results ranked by hybrid score.
   */
  search(notebook: NotebookData, query: string, options?: RetrieverOptions): SearchResult[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (notebook.chunks.length === 0) {
      return [];
    }

    // Step 1: Embed the query
    const queryEmbedding = this.embedder.embed(query);

    // Step 2: Compute vector similarity for all chunks
    const vectorScores = new Map<string, number>();
    for (const chunk of notebook.chunks) {
      const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      // Normalize to 0-1 range (cosine can be negative)
      vectorScores.set(chunk.id, (sim + 1) / 2);
    }

    // Step 3: Find top vector matches to seed graph walk
    const topVectorChunkIds = [...vectorScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, opts.topK * 2) // Take more for graph expansion
      .map(([id]) => id);

    // Step 4: Graph walk — boost chunks connected to top matches
    const graphScores = this.computeGraphScores(notebook, topVectorChunkIds);

    // Step 5: Compute hybrid scores
    const results: SearchResult[] = notebook.chunks.map(chunk => {
      const vScore = vectorScores.get(chunk.id) || 0;
      const gScore = graphScores.get(chunk.id) || 0;
      const score = opts.vectorWeight * vScore + opts.graphWeight * gScore;

      return {
        chunk,
        score: Math.round(score * 1000) / 1000,
        vectorScore: Math.round(vScore * 1000) / 1000,
        graphScore: Math.round(gScore * 1000) / 1000,
      };
    });

    // Step 6: Sort by hybrid score and return top-K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.topK);
  }

  /**
   * Compute graph proximity scores for chunks.
   * Chunks that share graph nodes with seed chunks get boosted.
   */
  private computeGraphScores(
    notebook: NotebookData,
    seedChunkIds: string[]
  ): Map<string, number> {
    const scores = new Map<string, number>();
    const { nodes, edges } = notebook.graph;

    if (nodes.length === 0) return scores;

    // Find which nodes the seed chunks belong to
    const seedNodeIds = new Set<string>();
    for (const node of nodes) {
      if (node.chunkIds.some(id => seedChunkIds.includes(id))) {
        seedNodeIds.add(node.id);
      }
    }

    // Walk edges: find connected nodes
    const connectedNodeIds = new Set<string>(seedNodeIds);
    const edgeWeights = new Map<string, number>();

    for (const edge of edges) {
      if (seedNodeIds.has(edge.source)) {
        connectedNodeIds.add(edge.target);
        edgeWeights.set(edge.target, Math.max(edgeWeights.get(edge.target) || 0, edge.weight));
      }
      if (seedNodeIds.has(edge.target)) {
        connectedNodeIds.add(edge.source);
        edgeWeights.set(edge.source, Math.max(edgeWeights.get(edge.source) || 0, edge.weight));
      }
    }

    // Score chunks based on how many connected nodes they belong to
    for (const node of nodes) {
      if (!connectedNodeIds.has(node.id)) continue;

      const nodeWeight = seedNodeIds.has(node.id)
        ? 1.0 // Direct match
        : (edgeWeights.get(node.id) || 0.5); // Connected via edge

      for (const chunkId of node.chunkIds) {
        const current = scores.get(chunkId) || 0;
        scores.set(chunkId, Math.min(1.0, current + nodeWeight * 0.3));
      }
    }

    return scores;
  }
}
