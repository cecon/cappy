/**
 * RAG subsystem types — shared interfaces with zero external dependencies.
 */

/** Configuration block persisted in ~/.cappy/config.json under the "rag" key. */
export interface RagConfig {
  enabled: boolean;
  /** Embedding model served via OpenRouter/OpenAI-compatible endpoint. */
  embeddingModel: string;
  /** Matryoshka dimension reduction (512 = 3× smaller than 1536, ~5% quality loss). */
  dimensions: number;
  /** Maximum characters per chunk (~375 tokens at 4 chars/token). */
  chunkMaxChars: number;
  /** Overlap between consecutive chunks to avoid context boundary loss. */
  chunkOverlapChars: number;
  /** Number of texts sent per embeddings API call. */
  embeddingBatchSize: number;
  /** Glob patterns excluded from indexing. */
  ignorePatterns: string[];
  /** File extensions to index. */
  includeExtensions: string[];
}

/** A symbol extracted from a file via VS Code Language Server or regex heuristics. */
export interface AstSymbol {
  name: string;
  /** Human-readable kind label: "function" | "class" | "method" | "interface" | etc. */
  kindLabel: string;
  startLine: number; // 0-based
  endLine: number;   // 0-based
}

/** Atomic unit of the vector index — one semantic chunk with its embedding. */
export interface IndexedChunk {
  /** SHA-256 of the chunk content (used for deduplication). */
  id: string;
  filePath: string;  // absolute path
  startLine: number; // 0-based
  endLine: number;
  symbolName?: string;
  symbolKind?: string;
  content: string;
  /** L2-normalised embedding vector (cosine = dot product when normalised). */
  embedding: number[];
}

/** Per-file tracking entry for incremental re-indexing. */
export interface IndexedFileEntry {
  contentHash: string; // SHA-256 of the full file content
  indexedAt: number;   // Unix ms timestamp
  chunkIds: string[];  // IDs of chunks produced from this file
}

/** Full index snapshot persisted to .cappy/rag-index.json. */
export interface RagIndexSnapshot {
  version: 1;
  embeddingModel: string;
  dimensions: number;
  files: Record<string, IndexedFileEntry>; // key = absolute filePath
  chunks: IndexedChunk[];
  /** Last git commit SHA that was fully indexed (used for smart git-diff delta). */
  lastIndexedHeadSha?: string;
  /** Branch name at last full index (branch switch triggers full re-index). */
  lastIndexedBranch?: string;
}

/** A single hit returned by the ragSearch tool. */
export interface RagSearchMatch {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  symbolKind?: string;
  content: string;
  /** Cosine similarity score in [0, 1]. */
  score: number;
}
