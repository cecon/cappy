/**
 * RAG Indexer — orchestrates file discovery, incremental hashing,
 * symbol extraction, embedding generation and vector store updates.
 *
 * Design goals:
 *  - Zero binary dependencies (uses AstSymbolExtractor → VS Code LS API)
 *  - Incremental: re-embeds only files whose SHA-256 hash changed
 *  - Cancellable: dispose() stops in-flight indexAll() gracefully
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";

import { extractSymbols } from "./AstSymbolExtractor";
import { extractRawEdges, resolveEdges } from "./AstGraphBuilder";
import { EmbeddingService } from "./EmbeddingService";
import { getCurrentBranch, getChangedFiles, readHeadSha } from "./GitHeadTracker";
import { regexChunk } from "./RegexChunker";
import { VectorStore } from "./VectorStore";
import type { AstEdge, AstSymbol, IndexedChunk, RagConfig } from "./types";
import { logInfo, logError } from "../utils/logger";

/** Extensions that typically have an active Language Server in VS Code. */
const LS_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx",
  ".py", ".go", ".cs", ".rs", ".java",
  ".cpp", ".c", ".h", ".hpp",
  ".rb", ".php", ".swift", ".kt",
]);

export class RagIndexer {
  private readonly store: VectorStore;
  private readonly embedding: EmbeddingService;
  private cancelled = false;
  /** Raw (unresolved) edges accumulated during indexing, keyed by file path. */
  private readonly rawEdgesCache = new Map<string, ReturnType<typeof extractRawEdges>>();

  constructor(
    private readonly workspaceRoot: string,
    private readonly config: RagConfig,
    apiKey: string,
  ) {
    this.store = new VectorStore(workspaceRoot);
    this.embedding = new EmbeddingService(apiKey);
  }

  /** Update the API key (called when config is reloaded). */
  updateApiKey(apiKey: string): void {
    this.embedding.updateApiKey(apiKey);
  }

  /** Expose store for the ragSearch tool (lazy-load pattern). */
  getStore(): VectorStore { return this.store; }

  /** Expose EmbeddingService for the ragSearch tool. */
  getEmbeddingService(): EmbeddingService { return this.embedding; }

  /** Signal running indexAll() to stop between files. */
  dispose(): void { this.cancelled = true; }

  // ── Public indexing API ────────────────────────────────────────────────────

  /**
   * Smart workspace scan triggered by the git watcher (HEAD/index changes).
   *
   * Strategy:
   *  1. Read current HEAD SHA and branch name.
   *  2. If the branch changed OR oldSha is unknown → full scan (O(workspace)).
   *  3. If same branch and oldSha is known → git diff delta (O(changed files only)).
   *  4. Always prune stale entries and persist the new HEAD SHA.
   *
   * Safe to call without await — errors are logged, not thrown.
   */
  async indexAll(): Promise<void> {
    this.cancelled = false;
    try {
      await this.store.load();

      // If the embedding model changed, wipe the entire index.
      if (this.store.modelChanged(this.config.embeddingModel, this.config.dimensions)) {
        logInfo("[RAG] Embedding model changed — full re-index.");
        await this.fullScan();
        return;
      }

      const currentSha = await readHeadSha(this.workspaceRoot);
      const currentBranch = await getCurrentBranch(this.workspaceRoot);
      const previousSha = this.store.lastIndexedHeadSha;
      const previousBranch = this.store.lastIndexedBranch;

      // Same commit as last index — nothing to do.
      if (currentSha !== null && currentSha === previousSha) {
        logInfo("[RAG] HEAD unchanged — skipping re-index.");
        return;
      }

      // Branch switch or no prior SHA → full scan to handle file additions/deletions.
      const branchChanged = currentBranch !== previousBranch;
      if (branchChanged || previousSha === undefined || currentSha === null) {
        logInfo(`[RAG] ${branchChanged ? "Branch changed" : "No prior SHA"} — full scan.`);
        await this.fullScan(currentSha ?? undefined, currentBranch ?? undefined);
        return;
      }

      // Same branch, known previous SHA → delta via git diff.
      const changedFiles = await getChangedFiles(
        this.workspaceRoot,
        previousSha,
        this.config.includeExtensions,
      );

      if (changedFiles.length === 0) {
        // git diff returned nothing (e.g. only non-indexed files changed).
        logInfo("[RAG] Git delta — no indexed files changed.");
        this.store.lastIndexedHeadSha = currentSha;
        await this.store.save(this.config.embeddingModel, this.config.dimensions);
        return;
      }

      logInfo(`[RAG] Git delta — re-indexing ${changedFiles.length} changed file(s).`);
      for (const filePath of changedFiles) {
        if (this.cancelled) break;
        try {
          await this.indexFileIfChanged(filePath);
        } catch (err) {
          logError(`[RAG] Failed to index ${filePath}: ${String(err)}`);
        }
      }

      this.updateGraphEdgesFor(changedFiles);
      this.store.lastIndexedHeadSha = currentSha;
      if (currentBranch !== null) this.store.lastIndexedBranch = currentBranch;
      await this.store.save(this.config.embeddingModel, this.config.dimensions);
      logInfo(`[RAG] Delta complete — ${this.store.chunkCount} chunks / ${this.store.fileCount} files / ${this.store.edgeCount} edges.`);
    } catch (err) {
      logError(`[RAG] indexAll failed: ${String(err)}`);
    }
  }

  /**
   * Full workspace scan (O(workspace)). Re-indexes every file whose hash
   * has changed; removes stale entries for deleted files.
   */
  private async fullScan(headSha?: string, branch?: string): Promise<void> {
    const files = await this.discoverFiles();
    const existingPaths = new Set(this.store.getAllIndexedPaths());

    for (const filePath of files) {
      if (this.cancelled) break;
      try {
        await this.indexFileIfChanged(filePath);
      } catch (err) {
        logError(`[RAG] Failed to index ${filePath}: ${String(err)}`);
      }
      existingPaths.delete(filePath);
    }

    // Remove entries for deleted files.
    for (const stale of existingPaths) {
      this.store.deleteFileEntry(stale);
    }

    this.buildGraphEdges();
    if (headSha !== undefined) this.store.lastIndexedHeadSha = headSha;
    if (branch !== undefined) this.store.lastIndexedBranch = branch;
    await this.store.save(this.config.embeddingModel, this.config.dimensions);
    logInfo(`[RAG] Full scan complete — ${this.store.chunkCount} chunks / ${this.store.fileCount} files / ${this.store.edgeCount} edges.`);
  }

  /**
   * Indexes (or re-indexes) a single file.
   * Called by the file system watcher on save/create events.
   */
  async indexFile(filePath: string): Promise<void> {
    if (!this.shouldIndex(filePath)) return;
    try {
      await this.store.load(); // ensure store is in memory
      await this.indexFileIfChanged(filePath);
      this.updateGraphEdgesFor([filePath]);
      await this.store.save(this.config.embeddingModel, this.config.dimensions);
    } catch (err) {
      logError(`[RAG] indexFile(${filePath}) failed: ${String(err)}`);
    }
  }

  /**
   * Removes all index entries for a deleted file.
   */
  async removeFile(filePath: string): Promise<void> {
    try {
      await this.store.load();
      this.store.deleteFileEntry(filePath);
      await this.store.save(this.config.embeddingModel, this.config.dimensions);
    } catch (err) {
      logError(`[RAG] removeFile(${filePath}) failed: ${String(err)}`);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async indexFileIfChanged(filePath: string): Promise<void> {
    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch {
      return; // unreadable / binary — skip
    }

    const hash = sha256(content);
    const existing = this.store.getFileEntry(filePath);
    if (existing?.contentHash === hash) return; // unchanged

    const symbols = await this.extractChunkSymbols(filePath, content);
    if (symbols.length === 0) return;

    const texts = symbols.map((s) => buildChunkText(s, content, filePath));
    let embeddings: number[][];
    try {
      embeddings = await this.embedding.embedBatch(
        texts,
        this.config.embeddingModel,
        this.config.dimensions,
        this.config.embeddingBatchSize,
      );
    } catch (err) {
      logError(`[RAG] Embedding failed for ${filePath}: ${String(err)}`);
      return;
    }

    // Remove old chunks before adding new ones.
    this.store.removeChunksForFile(filePath);

    const chunks: IndexedChunk[] = symbols.map((sym, i) => ({
      id: sha256(`${filePath}:${sym.startLine}:${texts[i] ?? ""}`),
      filePath,
      startLine: sym.startLine,
      endLine: sym.endLine,
      symbolName: sym.name,
      symbolKind: sym.kindLabel,
      content: texts[i] ?? "",
      embedding: embeddings[i] ?? [],
    }));

    this.store.addChunks(chunks);
    this.store.setFileEntry(filePath, {
      contentHash: hash,
      indexedAt: Date.now(),
      chunkIds: chunks.map((c) => c.id),
    });

    // Cache raw dependency edges for later graph resolution.
    this.rawEdgesCache.set(filePath, extractRawEdges(filePath, content));
  }

  // ── Graph helpers ──────────────────────────────────────────────────────────

  /**
   * Rebuilds the full dependency graph for ALL indexed files.
   * Called after fullScan() so the complete file set is available.
   */
  private buildGraphEdges(): void {
    const indexedFiles = new Set(this.store.getAllIndexedPaths());
    const allEdges: AstEdge[] = [];

    for (const [filePath, rawEdges] of this.rawEdgesCache) {
      const resolved = resolveEdges(rawEdges, indexedFiles, this.config.includeExtensions);
      allEdges.push(...resolved);
    }

    this.store.setEdges(allEdges);
    logInfo(`[RAG] Graph: ${allEdges.length} edges across ${this.rawEdgesCache.size} files.`);
  }

  /**
   * Updates dependency edges for a subset of files (delta scan).
   * Preserves edges for unchanged files.
   */
  private updateGraphEdgesFor(changedFiles: string[]): void {
    const indexedFiles = new Set(this.store.getAllIndexedPaths());
    for (const filePath of changedFiles) {
      this.store.removeEdgesForSource(filePath);
      const rawEdges = this.rawEdgesCache.get(filePath) ?? [];
      const resolved = resolveEdges(rawEdges, indexedFiles, this.config.includeExtensions);
      if (resolved.length > 0) this.store.addEdgesForFile(resolved);
    }
  }

  private async extractChunkSymbols(filePath: string, content: string): Promise<AstSymbol[]> {
    const ext = path.extname(filePath).toLowerCase();
    if (LS_EXTENSIONS.has(ext)) {
      const symbols = await extractSymbols(filePath, this.config.chunkMaxChars);
      if (symbols.length > 0) return symbols;
    }
    // Fallback to regex chunker.
    return regexChunk(content, filePath, this.config.chunkMaxChars, this.config.chunkOverlapChars);
  }

  private shouldIndex(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.config.includeExtensions.includes(ext)) return false;
    return !this.config.ignorePatterns.some((p) => minimatch(filePath, p));
  }

  private async discoverFiles(): Promise<string[]> {
    const exts = this.config.includeExtensions.map((e) => e.replace(/^\./u, "")).join(",");
    const pattern = new vscode.RelativePattern(this.workspaceRoot, `**/*.{${exts}}`);
    const uris = await vscode.workspace.findFiles(
      pattern,
      `{${this.config.ignorePatterns.join(",")}}`,
    );
    return uris.map((u) => u.fsPath);
  }
}

// ── Pure helpers ───────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Builds the text that will be embedded for a symbol.
 * Format: `{kindLabel} {name}\n{code lines}`
 */
function buildChunkText(sym: AstSymbol, fileContent: string, _filePath: string): string {
  const lines = fileContent.split("\n");
  const codeLines = lines.slice(sym.startLine, sym.endLine + 1).join("\n");
  const header = sym.name ? `${sym.kindLabel} ${sym.name}\n` : "";
  return `${header}${codeLines}`.slice(0, 6000); // hard cap to avoid token overflows
}

/**
 * Minimal glob-like pattern matching for ignore patterns.
 * Supports `**` (any path segment), `*` (any chars in segment), and exact paths.
 */
function minimatch(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex.
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, "§§") // placeholder
    .replace(/\*/gu, "[^/]*")
    .replace(/§§/gu, ".*");
  try {
    return new RegExp(escaped, "u").test(filePath);
  } catch {
    return false;
  }
}
