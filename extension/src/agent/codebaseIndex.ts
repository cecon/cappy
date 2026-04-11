import * as fs from "node:fs/promises";
import * as path from "node:path";

// ─── Constants ────────────────────────────────────────────────────────

const INDEX_DIR_SEGMENTS = [".cappy", "index"] as const;
const META_FILE = "meta.json";
const CHUNKS_FILE = "chunks.json";
const EMBEDDINGS_FILE = "embeddings.bin";

const MAX_CHUNK_CHARS = 1_500;
const MAX_FILE_CHARS = 60_000;
const MAX_INDEX_FILES = 5_000;
const EMBEDDING_BATCH_SIZE = 32;
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "out", ".next", "build", "coverage",
  ".turbo", ".cache", "__pycache__", ".venv", "venv", ".cappy",
]);

const EXCLUDED_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".bin", ".exe", ".dll", ".so", ".dylib",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
  ".lock", ".DS_Store",
]);

// ─── Types ────────────────────────────────────────────────────────────

export interface ChunkRecord {
  /** Sequential index (position in embeddings.bin). */
  id: number;
  /** File path relative to workspaceRoot (forward slashes). */
  filePath: string;
  startLine: number;
  endLine: number;
  /** Raw text content of the chunk. */
  text: string;
  /** File mtime in ms at index time (for incremental re-indexing). */
  mtime: number;
}

export interface IndexMeta {
  model: string;
  dims: number;
  indexedAt: string;
  fileCount: number;
  chunkCount: number;
}

export interface SearchResult {
  chunk: ChunkRecord;
  /** Cosine similarity score 0-1. */
  score: number;
  /** File paths 1-hop away in the dependency graph (imports + importedBy). */
  relatedFiles: string[];
}

export interface LoadedIndex {
  chunks: ChunkRecord[];
  embeddings: Float32Array;
  meta: IndexMeta;
}

// ─── Path helpers ─────────────────────────────────────────────────────

function getIndexDir(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), ...INDEX_DIR_SEGMENTS);
}

// ─── Chunking ─────────────────────────────────────────────────────────

/**
 * Splits file content into overlapping chunks by blank-line boundaries.
 * Never cuts a line in the middle.
 */
function chunkContent(content: string, filePath: string, mtime: number, startId: number): ChunkRecord[] {
  const truncated = content.length > MAX_FILE_CHARS ? content.slice(0, MAX_FILE_CHARS) : content;
  const lines = truncated.split("\n");
  const records: ChunkRecord[] = [];

  let currentLines: string[] = [];
  let currentChars = 0;
  let startLine = 0;
  let id = startId;

  const flush = (endLine: number): void => {
    const text = currentLines.join("\n").trim();
    if (text.length > 0) {
      records.push({ id: id++, filePath, startLine, endLine, text, mtime });
    }
    currentLines = [];
    currentChars = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (currentChars > 0 && currentChars + line.length + 1 > MAX_CHUNK_CHARS) {
      flush(i - 1);
      startLine = i;
    }

    currentLines.push(line);
    currentChars += line.length + 1;
  }

  if (currentLines.length > 0) {
    flush(lines.length - 1);
  }

  return records;
}

// ─── File collection ──────────────────────────────────────────────────

async function collectFiles(workspaceRoot: string): Promise<string[]> {
  const resolved = path.resolve(workspaceRoot);
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (results.length >= MAX_INDEX_FILES) {
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= MAX_INDEX_FILES) {
        return;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!EXCLUDED_EXTS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(resolved);
  return results.sort();
}

// ─── Embeddings API ───────────────────────────────────────────────────

interface EmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

async function embedBatch(texts: string[], apiKey: string, model: string): Promise<number[][]> {
  const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/cecon/cappy",
      "X-Title": "Cappy VS Code Extension",
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Embeddings API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as EmbeddingsResponse;
  // Preserve original order (OpenRouter returns sorted by index)
  const sorted = [...data.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

// ─── Cosine similarity ────────────────────────────────────────────────

function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ─── Index persistence ────────────────────────────────────────────────

async function saveIndex(
  workspaceRoot: string,
  chunks: ChunkRecord[],
  embeddingMatrix: Float32Array,
  meta: IndexMeta,
): Promise<void> {
  const indexDir = getIndexDir(workspaceRoot);
  await fs.mkdir(indexDir, { recursive: true });
  await fs.writeFile(path.join(indexDir, META_FILE), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(indexDir, CHUNKS_FILE), `${JSON.stringify(chunks, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(indexDir, EMBEDDINGS_FILE), Buffer.from(embeddingMatrix.buffer));
}

/**
 * Loads the index from disk. Returns null if the index does not exist or is corrupted.
 */
export async function loadIndex(workspaceRoot: string): Promise<LoadedIndex | null> {
  const indexDir = getIndexDir(workspaceRoot);
  try {
    const [metaRaw, chunksRaw, embeddingsBuf] = await Promise.all([
      fs.readFile(path.join(indexDir, META_FILE), "utf8"),
      fs.readFile(path.join(indexDir, CHUNKS_FILE), "utf8"),
      fs.readFile(path.join(indexDir, EMBEDDINGS_FILE)),
    ]);
    const meta = JSON.parse(metaRaw) as IndexMeta;
    const chunks = JSON.parse(chunksRaw) as ChunkRecord[];
    const expectedBytes = meta.chunkCount * meta.dims * 4;
    if (embeddingsBuf.length !== expectedBytes) {
      return null; // corrupted
    }
    const embeddings = new Float32Array(embeddingsBuf.buffer, embeddingsBuf.byteOffset, meta.chunkCount * meta.dims);
    return { chunks, embeddings, meta };
  } catch {
    return null;
  }
}

/**
 * Reads the index metadata without loading the full embedding matrix.
 */
export async function loadIndexMeta(workspaceRoot: string): Promise<IndexMeta | null> {
  try {
    const raw = await fs.readFile(path.join(getIndexDir(workspaceRoot), META_FILE), "utf8");
    return JSON.parse(raw) as IndexMeta;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export interface IndexCodebaseOptions {
  apiKey: string;
  model?: string;
  force?: boolean;
  onProgress?: (message: string) => void;
}

export interface IndexCodebaseResult extends IndexMeta {
  skippedFiles: number;
  durationSeconds: number;
}

/**
 * Indexes the codebase by chunking all source files and computing embeddings.
 * Supports incremental updates: files with unchanged mtime reuse existing embeddings.
 */
export async function indexCodebase(
  workspaceRoot: string,
  options: IndexCodebaseOptions,
): Promise<IndexCodebaseResult> {
  const { apiKey, model = DEFAULT_EMBEDDING_MODEL, force = false, onProgress } = options;
  const started = Date.now();
  const log = onProgress ?? (() => undefined);

  log("Collecting files…");
  const filePaths = await collectFiles(workspaceRoot);
  log(`Found ${filePaths.length} files to analyse.`);

  // Load existing index for incremental updates
  const existingIndex = force ? null : await loadIndex(workspaceRoot);
  const existingMtimeMap = new Map<string, number>(); // relPath → mtime
  const existingEmbeddingsByChunkId = new Map<number, Float32Array>();

  if (existingIndex) {
    for (const chunk of existingIndex.chunks) {
      existingMtimeMap.set(chunk.filePath, chunk.mtime);
    }
    for (const chunk of existingIndex.chunks) {
      const offset = chunk.id * existingIndex.meta.dims;
      existingEmbeddingsByChunkId.set(
        chunk.id,
        existingIndex.embeddings.slice(offset, offset + existingIndex.meta.dims),
      );
    }
  }

  // Chunk all files, detecting unchanged ones
  const allChunks: ChunkRecord[] = [];
  const chunksNeedingEmbedding: Array<{ chunkIdx: number; text: string }> = [];
  // Reused embeddings keyed by chunkIdx in allChunks
  const reusedEmbeddings = new Map<number, Float32Array>();

  let skippedFiles = 0;
  let processedFiles = 0;
  let idCounter = 0;

  for (const absolutePath of filePaths) {
    const relPath = path.relative(path.resolve(workspaceRoot), absolutePath).replace(/\\/gu, "/");
    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch {
      skippedFiles++;
      continue;
    }

    const mtime = stat.mtimeMs;
    const existingMtime = existingMtimeMap.get(relPath);

    if (!force && existingMtime !== undefined && existingMtime === mtime && existingIndex) {
      // Reuse chunks from existing index for this file
      const fileChunks = existingIndex.chunks.filter((c) => c.filePath === relPath);
      for (const oldChunk of fileChunks) {
        const newChunkIdx = allChunks.length;
        const newChunk: ChunkRecord = { ...oldChunk, id: idCounter++ };
        allChunks.push(newChunk);
        const oldEmb = existingEmbeddingsByChunkId.get(oldChunk.id);
        if (oldEmb) {
          reusedEmbeddings.set(newChunkIdx, oldEmb);
        } else {
          chunksNeedingEmbedding.push({ chunkIdx: newChunkIdx, text: newChunk.text });
        }
      }
      skippedFiles++;
      continue;
    }

    let content: string;
    try {
      content = await fs.readFile(absolutePath, "utf8");
    } catch {
      skippedFiles++;
      continue;
    }

    const fileChunks = chunkContent(content, relPath, mtime, idCounter);
    for (const chunk of fileChunks) {
      const chunkIdx = allChunks.length;
      allChunks.push({ ...chunk, id: idCounter++ });
      chunksNeedingEmbedding.push({ chunkIdx, text: chunk.text });
    }
    processedFiles++;

    if (processedFiles % 50 === 0) {
      log(`Processed ${processedFiles} files, ${allChunks.length} chunks so far…`);
    }
  }

  log(
    `Chunking complete: ${allChunks.length} chunks total ` +
    `(${chunksNeedingEmbedding.length} to embed, ${skippedFiles} files reused/skipped).`,
  );

  if (allChunks.length === 0) {
    throw new Error("No indexable files found in workspace.");
  }

  // Determine embedding dimensions from a test call if needed
  let dims = existingIndex?.meta.dims ?? 0;

  // Embed in batches
  const newEmbeddingMap = new Map<number, number[]>(); // chunkIdx → vector
  for (let i = 0; i < chunksNeedingEmbedding.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunksNeedingEmbedding.slice(i, i + EMBEDDING_BATCH_SIZE);
    const texts = batch.map((b) => b.text);
    const vectors = await embedBatch(texts, apiKey, model);
    if (dims === 0 && vectors.length > 0) {
      dims = vectors[0]!.length;
    }
    for (let j = 0; j < batch.length; j++) {
      newEmbeddingMap.set(batch[j]!.chunkIdx, vectors[j]!);
    }
    const done = Math.min(i + EMBEDDING_BATCH_SIZE, chunksNeedingEmbedding.length);
    log(`Embedding: ${done}/${chunksNeedingEmbedding.length} chunks…`);
  }

  if (dims === 0) {
    throw new Error("Could not determine embedding dimensions. Check the embedding model and API key.");
  }

  // Build flat Float32Array: one row per chunk
  const embeddingMatrix = new Float32Array(allChunks.length * dims);
  for (let i = 0; i < allChunks.length; i++) {
    const offset = i * dims;
    const reused = reusedEmbeddings.get(i);
    if (reused) {
      embeddingMatrix.set(reused, offset);
    } else {
      const newVec = newEmbeddingMap.get(i);
      if (newVec) {
        embeddingMatrix.set(newVec, offset);
      }
    }
  }

  const meta: IndexMeta = {
    model,
    dims,
    indexedAt: new Date().toISOString(),
    fileCount: filePaths.length - skippedFiles + processedFiles,
    chunkCount: allChunks.length,
  };

  log("Saving index to disk…");
  await saveIndex(workspaceRoot, allChunks, embeddingMatrix, meta);

  const durationSeconds = (Date.now() - started) / 1000;
  log(`Index complete: ${allChunks.length} chunks in ${durationSeconds.toFixed(1)}s.`);

  return { ...meta, skippedFiles, durationSeconds };
}

/**
 * Searches the codebase index by semantic similarity.
 * Returns the top-K most relevant chunks with optional graph expansion.
 */
export async function searchCodebase(
  workspaceRoot: string,
  query: string,
  apiKey: string,
  model: string = DEFAULT_EMBEDDING_MODEL,
  topK: number = 8,
  getRelatedFiles?: (filePath: string) => string[],
): Promise<SearchResult[]> {
  const index = await loadIndex(workspaceRoot);
  if (!index) {
    throw new Error(
      "Codebase index not found. Use IndexCodebase to build the index first.",
    );
  }

  const { chunks, embeddings, meta } = index;

  // Embed the query
  const queryVectors = await embedBatch([query], apiKey, model);
  const queryVec = queryVectors[0]!;

  // Score all chunks
  const scored: Array<{ chunk: ChunkRecord; score: number }> = chunks.map((chunk, i) => {
    const offset = i * meta.dims;
    const chunkVec = embeddings.subarray(offset, offset + meta.dims);
    return { chunk, score: cosineSimilarity(queryVec, chunkVec) };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, Math.min(topK, scored.length));

  return topResults.map(({ chunk, score }) => ({
    chunk,
    score: Math.round(score * 1000) / 1000,
    relatedFiles: getRelatedFiles ? getRelatedFiles(chunk.filePath) : [],
  }));
}
