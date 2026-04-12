/**
 * ragSearch tool — semantic codebase search via RAG embeddings.
 * Reads the index built by RagIndexer and returns the top-K most
 * relevant code chunks for a natural-language or identifier query.
 *
 * readOnly: true — available in Ask mode and Plan mode.
 */

import path from "node:path";

import type { ToolDefinition } from "./ToolDefinition";
import type { RagSearchMatch } from "../rag/types";
import { getWorkspaceRoot } from "./workspacePath";

// The RagIndexer singleton is set by CappyCompositionRoot after it creates one.
let _indexer: import("../rag/RagIndexer").RagIndexer | undefined;

/** Called by CappyCompositionRoot to inject the running indexer. */
export function setRagIndexer(indexer: import("../rag/RagIndexer").RagIndexer): void {
  _indexer = indexer;
}

interface RagSearchParams {
  query: string;
  topK?: number;
  minSimilarity?: number;
  filePattern?: string;
}

interface RagSearchResult {
  matches: Array<RagSearchMatch & { relPath: string }>;
  totalIndexed: number;
  indexReady: boolean;
  message?: string;
}

export const ragSearchTool: ToolDefinition<RagSearchParams, RagSearchResult> = {
  name: "ragSearch",
  description:
    "Semantic codebase search using AI embeddings. Finds code, functions, classes, and " +
    "documentation that are conceptually related to the query — even when exact keywords don't match. " +
    "Use this before grep/searchCode when you need to find WHERE something is implemented by meaning, " +
    "not by literal text. Returns ranked code chunks with file path, line numbers, and content.",
  readOnly: true,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Natural language description or identifier to search for. " +
          "Examples: 'user authentication logic', 'database connection handling', 'CompressContextUseCase'.",
      },
      topK: {
        type: "number",
        description: "Maximum number of results to return (default: 5, max: 20).",
        default: 5,
      },
      minSimilarity: {
        type: "number",
        description:
          "Minimum cosine similarity threshold in [0, 1]. Lower values return more results " +
          "but may include less relevant ones (default: 0.3).",
        default: 0.3,
      },
      filePattern: {
        type: "string",
        description:
          "Optional glob pattern to restrict results to specific files, e.g. '**/*.ts' or 'src/rag/**'.",
      },
    },
    required: ["query"],
  },

  async execute(params: RagSearchParams): Promise<RagSearchResult> {
    const topK = Math.min(params.topK ?? 5, 20);
    const minSimilarity = params.minSimilarity ?? 0.3;
    const workspaceRoot = getWorkspaceRoot();

    if (!_indexer) {
      return {
        matches: [],
        totalIndexed: 0,
        indexReady: false,
        message:
          "RAG index not initialised. Enable RAG in settings (rag.enabled = true) " +
          "and reload the window to start indexing.",
      };
    }

    const store = _indexer.getStore();
    const embeddingService = _indexer.getEmbeddingService();

    if (store.chunkCount === 0) {
      return {
        matches: [],
        totalIndexed: 0,
        indexReady: false,
        message: "RAG index is empty. Indexing may still be in progress — try again in a moment.",
      };
    }

    // Retrieve config from indexer to get model/dims for query embedding.
    // We call embedSingle via the shared EmbeddingService.
    let queryEmbedding: number[];
    try {
      // Access config via the process env set by CappyCompositionRoot.
      const model = process.env.CAPPY_RAG_MODEL ?? "text-embedding-3-small";
      const dims = parseInt(process.env.CAPPY_RAG_DIMS ?? "512", 10);
      queryEmbedding = await embeddingService.embedSingle(params.query, model, dims);
    } catch (err) {
      return {
        matches: [],
        totalIndexed: store.chunkCount,
        indexReady: true,
        message: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    let results = store.search(queryEmbedding, topK, minSimilarity);

    // Apply optional file pattern filter.
    if (params.filePattern) {
      const pat = params.filePattern;
      results = results.filter((r) => {
        const rel = path.relative(workspaceRoot, r.filePath);
        return globMatch(rel, pat);
      });
    }

    // ── Graph expansion (1-hop) ──────────────────────────────────────────────
    // For each file in the direct results, find neighbor files connected via
    // import/extends/implements edges and include their best matching chunks.
    const directFiles = new Set(results.map((r) => r.filePath));
    const expandedMatches: Array<RagSearchMatch & { relPath: string }> = [];
    const seenFiles = new Set(directFiles);

    for (const filePath of directFiles) {
      const neighbors = store.getNeighborFiles(filePath);    // outgoing (imports)
      const importers = store.getImporterFiles(filePath);    // incoming (importers)
      const candidates = [...neighbors, ...importers].filter((f) => !seenFiles.has(f));

      // Limit: at most 3 neighbor files per direct-hit file.
      for (const neighborFile of candidates.slice(0, 3)) {
        seenFiles.add(neighborFile);
        const neighborChunks = store.searchInFile(neighborFile, queryEmbedding, 2);
        if (neighborChunks.length === 0) continue;

        // Determine primary edge kind from direct file to this neighbor.
        const kinds = store.getEdgeKinds(filePath, neighborFile);
        const kind = kinds[0] ?? store.getEdgeKinds(neighborFile, filePath)[0];

        for (const chunk of neighborChunks) {
          const match: RagSearchMatch & { relPath: string } = {
            ...chunk,
            relPath: path.relative(workspaceRoot, chunk.filePath),
          };
          if (kind !== undefined) match.graphRelation = kind;
          expandedMatches.push(match);
        }
      }
    }

    return {
      matches: [
        ...results.map((r) => ({ ...r, relPath: path.relative(workspaceRoot, r.filePath) })),
        ...expandedMatches,
      ],
      totalIndexed: store.chunkCount,
      indexReady: true,
    };
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function globMatch(filePath: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, "§§")
    .replace(/\*/gu, "[^/]*")
    .replace(/§§/gu, ".*");
  try {
    return new RegExp(`^${escaped}$`, "u").test(filePath);
  } catch {
    return true; // invalid pattern — don't filter
  }
}
