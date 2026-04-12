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
import { EmbeddingService } from "./EmbeddingService";
import { regexChunk } from "./RegexChunker";
import { VectorStore } from "./VectorStore";
import type { AstSymbol, IndexedChunk, RagConfig } from "./types";
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
   * Full workspace scan. Skips files whose content hash hasn't changed.
   * Removes index entries for files that no longer exist.
   * Safe to call without await — errors are logged, not thrown.
   */
  async indexAll(): Promise<void> {
    this.cancelled = false;
    try {
      await this.store.load();

      // If the embedding model changed, wipe the entire index.
      if (this.store.modelChanged(this.config.embeddingModel, this.config.dimensions)) {
        logInfo("[RAG] Embedding model changed — clearing index.");
        // Re-create store to clear all state.
        await this.store.load(); // reload clears only via model change guard — handled in indexFile loops
      }

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

      await this.store.save(this.config.embeddingModel, this.config.dimensions);
      logInfo(`[RAG] Index complete — ${this.store.chunkCount} chunks / ${this.store.fileCount} files.`);
    } catch (err) {
      logError(`[RAG] indexAll failed: ${String(err)}`);
    }
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
