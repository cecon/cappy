/**
 * In-memory vector store with cosine similarity search and JSON persistence.
 * Zero external dependencies — pure TypeScript math + Node.js fs.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { IndexedChunk, IndexedFileEntry, RagIndexSnapshot, RagSearchMatch } from "./types";

const INDEX_FILE = ".cappy/rag-index.json";

export class VectorStore {
  private chunks: IndexedChunk[] = [];
  private files: Record<string, IndexedFileEntry> = {};
  private embeddingModel = "";
  private dimensions = 512;

  constructor(private readonly workspaceRoot: string) {}

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
      }
    } catch {
      // File does not exist yet — start with empty index.
    }
  }

  async save(embeddingModel: string, dimensions: number): Promise<void> {
    const indexPath = path.join(this.workspaceRoot, INDEX_FILE);
    await mkdir(path.dirname(indexPath), { recursive: true });
    const snapshot: RagIndexSnapshot = {
      version: 1,
      embeddingModel,
      dimensions,
      files: this.files,
      chunks: this.chunks,
    };
    await writeFile(indexPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  }

  // ── Mutation ───────────────────────────────────────────────────────────────

  addChunks(chunks: IndexedChunk[]): void {
    for (const chunk of chunks) {
      // Normalise embedding at insertion time so search is just dot product.
      this.chunks.push({ ...chunk, embedding: l2Normalize(chunk.embedding) });
    }
  }

  removeChunksForFile(filePath: string): void {
    const entry = this.files[filePath];
    if (!entry) return;
    const ids = new Set(entry.chunkIds);
    this.chunks = this.chunks.filter((c) => !ids.has(c.id));
  }

  setFileEntry(filePath: string, entry: IndexedFileEntry): void {
    this.files[filePath] = entry;
  }

  deleteFileEntry(filePath: string): void {
    this.removeChunksForFile(filePath);
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

  // ── Search ─────────────────────────────────────────────────────────────────

  /**
   * Returns the top-K chunks by cosine similarity to `queryEmbedding`.
   * Both stored embeddings and the query are L2-normalised, so cosine = dot product.
   */
  search(queryEmbedding: number[], topK: number, minScore: number): RagSearchMatch[] {
    const q = l2Normalize(queryEmbedding);
    return this.chunks
      .map((chunk) => ({ chunk, score: dotProduct(q, chunk.embedding) }))
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

  /** Returns true if the stored index was built with a different model. */
  modelChanged(model: string, dims: number): boolean {
    return (
      this.chunks.length > 0 &&
      (this.embeddingModel !== model || this.dimensions !== dims)
    );
  }
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
