/**
 * @fileoverview Types for the Cappy Notebook — portable RAG system
 * @module domains/notebook/notebook-types
 */

// ─── Chunk ────────────────────────────────────────────────

export interface ChunkMetadata {
  /** Source section/heading (extracted from markdown headers) */
  section?: string;
  /** Start line in the original document */
  startLine: number;
  /** End line in the original document */
  endLine: number;
}

export interface Chunk {
  /** Unique chunk ID (e.g. "c_001") */
  id: string;
  /** Source file path (relative to workspace) */
  source: string;
  /** Raw text content of the chunk */
  text: string;
  /** Embedding vector (fixed-dimension float array) */
  embedding: number[];
  /** Metadata about the chunk's position */
  metadata: ChunkMetadata;
}

// ─── Knowledge Graph ──────────────────────────────────────

export type GraphNodeType = 'entity' | 'file' | 'heading';

export interface GraphNode {
  /** Unique node ID (e.g. "n_001") */
  id: string;
  /** Display label */
  label: string;
  /** Node type */
  type: GraphNodeType;
  /** IDs of chunks where this entity appears */
  chunkIds: string[];
}

export interface GraphEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Relationship label */
  label: string;
  /** Edge weight (0-1), based on co-occurrence frequency */
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Notebook ─────────────────────────────────────────────

export interface NotebookMeta {
  /** Notebook display name */
  name: string;
  /** ISO timestamp of creation */
  created: string;
  /** ISO timestamp of last update */
  updated: string;
  /** List of source file paths (relative to workspace) */
  sources: string[];
  /** Embedding dimension used */
  embeddingDim: number;
}

export interface NotebookData {
  meta: NotebookMeta;
  chunks: Chunk[];
  graph: KnowledgeGraph;
}

// ─── Search ───────────────────────────────────────────────

export interface SearchResult {
  /** The matched chunk */
  chunk: Chunk;
  /** Combined relevance score (0-1) */
  score: number;
  /** Vector similarity score (0-1) */
  vectorScore: number;
  /** Graph proximity score (0-1) */
  graphScore: number;
}
