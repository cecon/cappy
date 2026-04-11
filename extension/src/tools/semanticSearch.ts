import {
  indexCodebase,
  loadIndexMeta,
  searchCodebase,
} from "../agent/codebaseIndex";
import {
  buildDependencyGraph,
  getRelatedFiles,
  loadGraph,
  saveGraph,
} from "../agent/codebaseGraph";
import { loadConfig } from "../config";
import type { ToolDefinition } from "./toolTypes";
import { getWorkspaceRoot } from "./workspacePath";

const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 20;

// ─── SemanticSearch ───────────────────────────────────────────────────

interface SemanticSearchParams {
  /** Natural language query describing the code you're looking for. */
  query: string;
  /** Number of results to return (1–20, default 8). */
  limit?: number;
}

interface SemanticSearchResultItem {
  filePath: string;
  startLine: number;
  endLine: number;
  /** The raw source text of the chunk. */
  text: string;
  /** Cosine similarity score 0-1 (higher is more relevant). */
  score: number;
  /**
   * Files 1-hop away in the dependency graph (imports + importedBy).
   * Consider reading these for full context.
   */
  relatedFiles: string[];
}

interface SemanticSearchResult {
  results: SemanticSearchResultItem[];
  totalIndexedChunks: number;
  indexedAt: string;
  model: string;
}

export const semanticSearchTool: ToolDefinition<SemanticSearchParams, SemanticSearchResult> = {
  name: "SemanticSearch",
  description:
    "Searches the codebase by semantic meaning — finds code by intent, not just keywords. " +
    "Example queries: 'JWT token validation', 'error handling in API calls', 'database connection setup'. " +
    "Requires IndexCodebase to have been run first. " +
    "Results include the relevant code chunk, its file location, a relevance score, " +
    "and related files (imports/importedBy) for additional context.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language description of the code you want to find (min 3 characters).",
      },
      limit: {
        type: "number",
        description: `Number of results to return (1–${MAX_SEARCH_LIMIT}, default ${DEFAULT_SEARCH_LIMIT}).`,
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  readonly: true,
  async execute(params) {
    const query = params.query?.trim() ?? "";
    if (query.length < 3) {
      throw new Error("query must be at least 3 characters.");
    }

    const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT));
    const root = getWorkspaceRoot();
    const config = await loadConfig();
    const apiKey = config.openrouter.apiKey;
    if (!apiKey) {
      throw new Error("OpenRouter API key not configured. Set openrouter.apiKey in ~/.cappy/config.json.");
    }

    const embeddingModel = config.openrouter.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;

    // Load dependency graph for related-file expansion (optional — fail gracefully)
    const graph = await loadGraph(root);
    const relatedFilesFn = graph
      ? (filePath: string) => getRelatedFiles(graph, filePath)
      : undefined;

    const results = await searchCodebase(root, query, apiKey, embeddingModel, limit, relatedFilesFn);
    const meta = await loadIndexMeta(root);

    return {
      results: results.map((r) => ({
        filePath: r.chunk.filePath,
        startLine: r.chunk.startLine,
        endLine: r.chunk.endLine,
        text: r.chunk.text,
        score: r.score,
        relatedFiles: r.relatedFiles,
      })),
      totalIndexedChunks: meta?.chunkCount ?? results.length,
      indexedAt: meta?.indexedAt ?? "",
      model: embeddingModel,
    };
  },
};

// ─── IndexCodebase ────────────────────────────────────────────────────

interface IndexCodebaseParams {
  /**
   * When true, re-indexes all files even if unchanged.
   * Default: false (incremental — only re-embeds modified files).
   */
  force?: boolean;
}

interface IndexCodebaseResult {
  fileCount: number;
  chunkCount: number;
  skippedFiles: number;
  durationSeconds: number;
  indexedAt: string;
  model: string;
  message: string;
}

export const indexCodebaseTool: ToolDefinition<IndexCodebaseParams, IndexCodebaseResult> = {
  name: "IndexCodebase",
  description:
    "Builds or updates the semantic search index for the current workspace. " +
    "Chunks all source files and computes embeddings via the OpenRouter API. " +
    "Only re-embeds files that changed since the last index (incremental by default). " +
    "Run this once before using SemanticSearch, and again after major refactors. " +
    "Large codebases (>1000 files) may take 1-3 minutes.",
  parameters: {
    type: "object",
    properties: {
      force: {
        type: "boolean",
        description:
          "If true, re-indexes all files from scratch (ignores incremental cache). " +
          "Use after changing the embedding model or after major file reorganisations.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const config = await loadConfig();
    const apiKey = config.openrouter.apiKey;
    if (!apiKey) {
      throw new Error("OpenRouter API key not configured. Set openrouter.apiKey in ~/.cappy/config.json.");
    }

    const embeddingModel = config.openrouter.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
    const progressMessages: string[] = [];

    const result = await indexCodebase(root, {
      apiKey,
      model: embeddingModel,
      force: params.force ?? false,
      onProgress: (msg) => {
        progressMessages.push(msg);
      },
    });

    // Build and save the dependency graph alongside the embeddings index
    const { collectFilesForGraph } = await buildGraphAfterIndex(root);
    const graph = await buildDependencyGraph(root, collectFilesForGraph);
    await saveGraph(root, graph);

    const uniqueFiles = graph.imports.size + [...graph.importedBy.keys()].filter(
      (k) => !graph.imports.has(k),
    ).length;

    return {
      fileCount: result.fileCount,
      chunkCount: result.chunkCount,
      skippedFiles: result.skippedFiles,
      durationSeconds: result.durationSeconds,
      indexedAt: result.indexedAt,
      model: embeddingModel,
      message:
        `Indexed ${result.chunkCount} chunks from ${result.fileCount} files ` +
        `(${result.skippedFiles} unchanged, ${uniqueFiles} files in dependency graph). ` +
        `You can now use SemanticSearch to find code by meaning.`,
    };
  },
};

/**
 * Re-collects file paths for graph building after indexing.
 * Returns absolute paths of source files with known import patterns.
 */
async function buildGraphAfterIndex(workspaceRoot: string): Promise<{ collectFilesForGraph: string[] }> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const GRAPH_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs"]);
  const EXCLUDED_DIRS = new Set([
    "node_modules", ".git", "dist", "out", ".next", "build", "coverage",
    ".turbo", ".cache", "__pycache__", ".venv", "venv", ".cappy",
  ]);

  const results: string[] = [];
  const resolved = path.resolve(workspaceRoot);

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile() && GRAPH_EXTS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  await walk(resolved);
  return { collectFilesForGraph: results };
}
