/**
 * In-memory vector store with cosine similarity search and JSON persistence.
 * Zero external dependencies — pure TypeScript math + Node.js fs.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AstEdge, IndexedChunk, IndexedFileEntry, RagIndexSnapshot, RagSearchMatch } from "./types";

const HYBRID_SEMANTIC_WEIGHT = 0.7;
const HYBRID_LEXICAL_WEIGHT = 0.3;

const INDEX_FILE = ".cappy/rag-index.json";

export class VectorStore {
  private chunks: IndexedChunk[] = [];
  private files: Record<string, IndexedFileEntry> = {};
  private embeddingModel = "";
  private dimensions = 512;
  private _lastIndexedHeadSha: string | undefined = undefined;
  private _lastIndexedBranch: string | undefined = undefined;
  private edges: AstEdge[] = [];

  // Adjacency indexes rebuilt from this.edges for O(1) lookups.
  private outgoing = new Map<string, AstEdge[]>(); // from → edges
  private incoming = new Map<string, AstEdge[]>(); // to   → edges

  // Inverted lexical index: token → Set of chunk positions in this.chunks[].
  // Rebuilt whenever chunks are removed (positions shift); populated on addChunks().
  private lexicalIndex = new Map<string, Set<number>>();

  constructor(private readonly workspaceRoot: string) {}

  get lastIndexedHeadSha(): string | undefined { return this._lastIndexedHeadSha; }
  set lastIndexedHeadSha(sha: string | undefined) { this._lastIndexedHeadSha = sha; }

  get lastIndexedBranch(): string | undefined { return this._lastIndexedBranch; }
  set lastIndexedBranch(branch: string | undefined) { this._lastIndexedBranch = branch; }

  // ── Persistence ────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    const indexPath = path.join(this.workspaceRoot, INDEX_FILE);
    try {
      const raw = await readFile(indexPath, "utf8");
      const snapshot = JSON.parse(raw) as unknown;
      if (isValidSnapshot(snapshot)) {
        this.chunks = snapshot.chunks;
        this.files = snapshot.files;
        this.embeddingModel = snapshot.embeddingModel;
        this.dimensions = snapshot.dimensions;
        this._lastIndexedHeadSha = snapshot.lastIndexedHeadSha;
        this._lastIndexedBranch = snapshot.lastIndexedBranch;
        if (snapshot.edges) this.setEdges(snapshot.edges);

        // Restore lexical index from snapshot or rebuild from lexicalTokens.
        if (snapshot.lexicalIndex) {
          this.lexicalIndex.clear();
          // Snapshot stores token → chunkId[]; translate to token → chunk index set.
          const idToIndex = new Map<string, number>(this.chunks.map((c, i) => [c.id, i]));
          for (const [token, ids] of Object.entries(snapshot.lexicalIndex)) {
            const positions = new Set<number>();
            for (const id of ids) {
              const idx = idToIndex.get(id);
              if (idx !== undefined) positions.add(idx);
            }
            if (positions.size > 0) this.lexicalIndex.set(token, positions);
          }
        } else {
          this.rebuildLexicalIndex();
        }
      }
    } catch {
      // File does not exist yet — start with empty index.
    }
  }

  async save(embeddingModel: string, dimensions: number): Promise<void> {
    const indexPath = path.join(this.workspaceRoot, INDEX_FILE);
    await mkdir(path.dirname(indexPath), { recursive: true });
    // Serialise lexicalIndex as token → chunkId[] (position-independent).
    const lexicalIndexRecord: Record<string, string[]> = {};
    for (const [token, positions] of this.lexicalIndex) {
      const ids: string[] = [];
      for (const pos of positions) {
        const chunk = this.chunks[pos];
        if (chunk !== undefined) ids.push(chunk.id);
      }
      if (ids.length > 0) lexicalIndexRecord[token] = ids;
    }

    const snapshot: RagIndexSnapshot = {
      version: 1,
      embeddingModel,
      dimensions,
      files: this.files,
      chunks: this.chunks,
      ...(this._lastIndexedHeadSha !== undefined ? { lastIndexedHeadSha: this._lastIndexedHeadSha } : {}),
      ...(this._lastIndexedBranch !== undefined ? { lastIndexedBranch: this._lastIndexedBranch } : {}),
      ...(this.edges.length > 0 ? { edges: this.edges } : {}),
      ...(Object.keys(lexicalIndexRecord).length > 0 ? { lexicalIndex: lexicalIndexRecord } : {}),
    };
    await writeFile(indexPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  }

  // ── Mutation ───────────────────────────────────────────────────────────────

  addChunks(chunks: IndexedChunk[]): void {
    for (const chunk of chunks) {
      const idx = this.chunks.length;
      // Normalise embedding at insertion time so search is just dot product.
      this.chunks.push({ ...chunk, embedding: l2Normalize(chunk.embedding) });
      // Populate the inverted lexical index for this chunk.
      if (chunk.lexicalTokens && chunk.lexicalTokens.length > 0) {
        for (const token of chunk.lexicalTokens) {
          const set = this.lexicalIndex.get(token);
          if (set !== undefined) {
            set.add(idx);
          } else {
            this.lexicalIndex.set(token, new Set([idx]));
          }
        }
      }
    }
  }

  removeChunksForFile(filePath: string): void {
    const entry = this.files[filePath];
    if (!entry) return;
    const ids = new Set(entry.chunkIds);
    this.chunks = this.chunks.filter((c) => !ids.has(c.id));
    // Chunk positions shifted — rebuild the inverted index from scratch.
    this.rebuildLexicalIndex();
  }

  setFileEntry(filePath: string, entry: IndexedFileEntry): void {
    this.files[filePath] = entry;
  }

  deleteFileEntry(filePath: string): void {
    this.removeChunksForFile(filePath); // also calls rebuildLexicalIndex()
    delete this.files[filePath];
  }

  getFileEntry(filePath: string): IndexedFileEntry | undefined {
    return this.files[filePath];
  }

  getAllIndexedPaths(): string[] {
    return Object.keys(this.files);
  }

  get chunkCount(): number {
    return this.chunks.length;
  }

  get fileCount(): number {
    return Object.keys(this.files).length;
  }

  get edgeCount(): number {
    return this.edges.length;
  }

  // ── Graph (dependency edges) ────────────────────────────────────────────────

  /**
   * Replaces the entire edge set and rebuilds adjacency indexes.
   */
  setEdges(newEdges: AstEdge[]): void {
    this.edges = newEdges;
    this.rebuildAdjacency();
  }

  /**
   * Appends edges for one file (call `removeEdgesForSource` first when
   * updating a previously indexed file).
   */
  addEdgesForFile(fileEdges: AstEdge[]): void {
    this.edges.push(...fileEdges);
    for (const e of fileEdges) {
      pushToMap(this.outgoing, e.from, e);
      pushToMap(this.incoming, e.to, e);
    }
  }

  /** Removes all edges where `from === filePath`. */
  removeEdgesForSource(filePath: string): void {
    const removed = this.outgoing.get(filePath) ?? [];
    this.edges = this.edges.filter((e) => e.from !== filePath);
    this.outgoing.delete(filePath);
    for (const e of removed) {
      const list = this.incoming.get(e.to);
      if (list) {
        const idx = list.indexOf(e);
        if (idx !== -1) list.splice(idx, 1);
      }
    }
  }

  /**
   * Returns files that `filePath` imports / extends / implements (outgoing).
   * If `kind` is provided, filters to only edges of that kind.
   */
  getNeighborFiles(filePath: string, kind?: AstEdge["kind"]): string[] {
    const edges = this.outgoing.get(filePath) ?? [];
    const filtered = kind ? edges.filter((e) => e.kind === kind) : edges;
    return [...new Set(filtered.map((e) => e.to))];
  }

  /**
   * Returns files that import / extend / implement `filePath` (incoming).
   */
  getImporterFiles(filePath: string, kind?: AstEdge["kind"]): string[] {
    const edges = this.incoming.get(filePath) ?? [];
    const filtered = kind ? edges.filter((e) => e.kind === kind) : edges;
    return [...new Set(filtered.map((e) => e.from))];
  }

  /**
   * Returns the edge kind(s) connecting `from` to `to`, or [] if unrelated.
   */
  getEdgeKinds(from: string, to: string): AstEdge["kind"][] {
    return (this.outgoing.get(from) ?? [])
      .filter((e) => e.to === to)
      .map((e) => e.kind);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  /**
   * Returns the top-K chunks by hybrid score (semantic + lexical).
   *
   * When `queryTokens` is provided:
   *   hybridScore = 0.7 * semanticScore + 0.3 * lexicalScore
   *   lexicalScore = (query tokens found in chunk) / (total query tokens)
   *
   * When `queryTokens` is absent, pure cosine similarity is used (backward compatible).
   * Both stored embeddings and the query are L2-normalised, so cosine = dot product.
   */
  search(
    queryEmbedding: number[],
    topK: number,
    minScore: number,
    queryTokens?: string[],
  ): RagSearchMatch[] {
    const q = l2Normalize(queryEmbedding);
    const queryTokenSet = queryTokens && queryTokens.length > 0 ? new Set(queryTokens) : null;
    const queryTokenCount = queryTokens?.length ?? 0;

    return this.chunks
      .map((chunk) => {
        const semanticScore = dotProduct(q, chunk.embedding);
        let finalScore = semanticScore;

        if (queryTokenSet !== null && queryTokenCount > 0 && chunk.lexicalTokens && chunk.lexicalTokens.length > 0) {
          let matches = 0;
          for (const token of queryTokenSet) {
            // Fast lookup via inverted index is O(1) per token
            if (chunk.lexicalTokens.includes(token)) matches++;
          }
          const lexicalScore = matches / queryTokenCount;
          finalScore = HYBRID_SEMANTIC_WEIGHT * semanticScore + HYBRID_LEXICAL_WEIGHT * lexicalScore;
        }

        return { chunk, score: finalScore };
      })
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((r) => {
        const match: RagSearchMatch = {
          filePath: r.chunk.filePath,
          startLine: r.chunk.startLine,
          endLine: r.chunk.endLine,
          content: r.chunk.content,
          score: Math.round(r.score * 1000) / 1000,
        };
        if (r.chunk.symbolName !== undefined) match.symbolName = r.chunk.symbolName;
        if (r.chunk.symbolKind !== undefined) match.symbolKind = r.chunk.symbolKind;
        return match;
      });
  }

  /**
   * Returns up to `topK` chunks from a specific file, ranked by similarity.
   * Used by graph expansion in ragSearchTool.
   */
  searchInFile(filePath: string, queryEmbedding: number[], topK: number): RagSearchMatch[] {
    const q = l2Normalize(queryEmbedding);
    return this.chunks
      .filter((c) => c.filePath === filePath)
      .map((chunk) => ({ chunk, score: dotProduct(q, chunk.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((r) => {
        const match: RagSearchMatch = {
          filePath: r.chunk.filePath,
          startLine: r.chunk.startLine,
          endLine: r.chunk.endLine,
          content: r.chunk.content,
          score: Math.round(r.score * 1000) / 1000,
        };
        if (r.chunk.symbolName !== undefined) match.symbolName = r.chunk.symbolName;
        if (r.chunk.symbolKind !== undefined) match.symbolKind = r.chunk.symbolKind;
        return match;
      });
  }

  /** Returns true if the stored index was built with a different model. */
  modelChanged(model: string, dims: number): boolean {
    return (
      this.chunks.length > 0 &&
      (this.embeddingModel !== model || this.dimensions !== dims)
    );
  }

  /**
   * Rebuilds the inverted lexical index from scratch.
   * Must be called after any operation that changes chunk positions
   * (i.e. after filtering this.chunks — removeChunksForFile, deleteFileEntry).
   */
  private rebuildLexicalIndex(): void {
    this.lexicalIndex.clear();
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (chunk?.lexicalTokens && chunk.lexicalTokens.length > 0) {
        for (const token of chunk.lexicalTokens) {
          const set = this.lexicalIndex.get(token);
          if (set !== undefined) {
            set.add(i);
          } else {
            this.lexicalIndex.set(token, new Set([i]));
          }
        }
      }
    }
  }

  private rebuildAdjacency(): void {
    this.outgoing.clear();
    this.incoming.clear();
    for (const e of this.edges) {
      pushToMap(this.outgoing, e.from, e);
      pushToMap(this.incoming, e.to, e);
    }
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────

function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

// ── Pure math helpers ──────────────────────────────────────────────────────

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

// ── Snapshot validation ────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isValidSnapshot(v: unknown): v is RagIndexSnapshot {
  return (
    isRecord(v) &&
    v.version === 1 &&
    typeof v.embeddingModel === "string" &&
    typeof v.dimensions === "number" &&
    isRecord(v.files) &&
    Array.isArray(v.chunks)
  );
}
