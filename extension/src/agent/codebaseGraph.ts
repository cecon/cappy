import * as fs from "node:fs/promises";
import * as path from "node:path";

// ─── Constants ────────────────────────────────────────────────────────

const INDEX_DIR_SEGMENTS = [".cappy", "index"] as const;
const GRAPH_FILE = "graph.json";

/**
 * Import-pattern regexes keyed by file extension.
 * Each regex must have a capturing group (index 1) for the import path.
 */
const IMPORT_PATTERNS: Readonly<Record<string, RegExp[]>> = {
  ".ts":   [/from\s+['"]([^'"]+)['"]/gu, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu],
  ".tsx":  [/from\s+['"]([^'"]+)['"]/gu, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu],
  ".js":   [/from\s+['"]([^'"]+)['"]/gu, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu],
  ".jsx":  [/from\s+['"]([^'"]+)['"]/gu, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu],
  ".mjs":  [/from\s+['"]([^'"]+)['"]/gu, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu],
  ".cjs":  [/require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu],
  ".py":   [/^(?:from\s+([\w./]+)\s+import|import\s+([\w./]+))/gmu],
  ".go":   [/"([^"]+)"/gu],          // simplified — Go imports are quoted paths
  ".rs":   [/(?:use|mod)\s+([\w:]+)/gu],
};

/** Extensions to try when resolving a relative import without extension. */
const RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];

// ─── Types ────────────────────────────────────────────────────────────

/**
 * Lightweight file-level dependency graph.
 * All paths are relative to workspaceRoot (forward slashes).
 */
export interface DependencyGraph {
  /** file → Set of files it imports */
  imports: Map<string, Set<string>>;
  /** file → Set of files that import it */
  importedBy: Map<string, Set<string>>;
}

/** Serialised representation stored in `graph.json`. */
interface GraphJson {
  imports: Record<string, string[]>;
  importedBy: Record<string, string[]>;
}

// ─── Path helpers ─────────────────────────────────────────────────────

function getIndexDir(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), ...INDEX_DIR_SEGMENTS);
}

/**
 * Attempts to resolve a relative import path to an existing file.
 * Returns the relative path from workspaceRoot on success, null otherwise.
 */
async function resolveRelativeImport(
  fromFile: string,   // absolute
  importPath: string,
  workspaceRoot: string,
): Promise<string | null> {
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    return null; // node_modules or bare module — skip
  }

  const dir = path.dirname(fromFile);
  const candidate = path.resolve(dir, importPath);

  // Try exact path first
  try {
    await fs.access(candidate);
    return path.relative(workspaceRoot, candidate).replace(/\\/gu, "/");
  } catch { /* continue */ }

  // Try with common extensions
  for (const ext of RESOLVE_EXTS) {
    try {
      await fs.access(candidate + ext);
      return path.relative(workspaceRoot, candidate + ext).replace(/\\/gu, "/");
    } catch { /* continue */ }
  }

  // Try index files
  for (const ext of RESOLVE_EXTS) {
    try {
      const indexPath = path.join(candidate, `index${ext}`);
      await fs.access(indexPath);
      return path.relative(workspaceRoot, indexPath).replace(/\\/gu, "/");
    } catch { /* continue */ }
  }

  return null;
}

/**
 * Extracts import paths from a file's content using extension-specific regex patterns.
 */
function extractImportPaths(content: string, ext: string): string[] {
  const patterns = IMPORT_PATTERNS[ext];
  if (!patterns) {
    return [];
  }

  const found = new Set<string>();
  for (const pattern of patterns) {
    // Reset lastIndex before use (regex with /g flag are stateful)
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      // Pick first non-undefined capturing group
      const imported = match[1] ?? match[2];
      if (imported && imported.trim().length > 0) {
        found.add(imported.trim());
      }
    }
  }
  return [...found];
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Builds a file-level dependency graph by parsing import statements.
 * Only processes files with known import patterns (TypeScript, JavaScript, Python, Go, Rust).
 * Skips node_modules and external packages.
 */
export async function buildDependencyGraph(
  workspaceRoot: string,
  filePaths: string[], // absolute paths of all indexed files
): Promise<DependencyGraph> {
  const resolved = path.resolve(workspaceRoot);
  const graph: DependencyGraph = {
    imports: new Map(),
    importedBy: new Map(),
  };

  for (const absolutePath of filePaths) {
    const ext = path.extname(absolutePath).toLowerCase();
    if (!IMPORT_PATTERNS[ext]) {
      continue;
    }

    const relPath = path.relative(resolved, absolutePath).replace(/\\/gu, "/");

    let content: string;
    try {
      content = await fs.readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    const importPaths = extractImportPaths(content, ext);

    for (const importPath of importPaths) {
      const resolvedRel = await resolveRelativeImport(absolutePath, importPath, resolved);
      if (!resolvedRel) {
        continue;
      }

      // Add to imports
      const importsSet = graph.imports.get(relPath) ?? new Set<string>();
      importsSet.add(resolvedRel);
      graph.imports.set(relPath, importsSet);

      // Add to importedBy (reverse edge)
      const importedBySet = graph.importedBy.get(resolvedRel) ?? new Set<string>();
      importedBySet.add(relPath);
      graph.importedBy.set(resolvedRel, importedBySet);
    }
  }

  return graph;
}

/**
 * Returns 1-hop neighbours of `filePath` in the graph:
 * files it imports + files that import it.
 */
export function getRelatedFiles(graph: DependencyGraph, filePath: string): string[] {
  const related = new Set<string>();
  const imports = graph.imports.get(filePath);
  const importedBy = graph.importedBy.get(filePath);
  if (imports) {
    for (const f of imports) {
      related.add(f);
    }
  }
  if (importedBy) {
    for (const f of importedBy) {
      related.add(f);
    }
  }
  return [...related].sort();
}

// ─── Persistence ──────────────────────────────────────────────────────

/**
 * Serialises and saves the dependency graph to `.cappy/index/graph.json`.
 */
export async function saveGraph(workspaceRoot: string, graph: DependencyGraph): Promise<void> {
  const indexDir = getIndexDir(workspaceRoot);
  await fs.mkdir(indexDir, { recursive: true });

  const json: GraphJson = {
    imports: {},
    importedBy: {},
  };

  for (const [k, v] of graph.imports) {
    json.imports[k] = [...v].sort();
  }
  for (const [k, v] of graph.importedBy) {
    json.importedBy[k] = [...v].sort();
  }

  await fs.writeFile(
    path.join(indexDir, GRAPH_FILE),
    `${JSON.stringify(json, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Loads the dependency graph from disk. Returns null if it does not exist.
 */
export async function loadGraph(workspaceRoot: string): Promise<DependencyGraph | null> {
  try {
    const raw = await fs.readFile(path.join(getIndexDir(workspaceRoot), GRAPH_FILE), "utf8");
    const json = JSON.parse(raw) as GraphJson;
    const graph: DependencyGraph = {
      imports: new Map(),
      importedBy: new Map(),
    };
    for (const [k, v] of Object.entries(json.imports)) {
      graph.imports.set(k, new Set(v));
    }
    for (const [k, v] of Object.entries(json.importedBy)) {
      graph.importedBy.set(k, new Set(v));
    }
    return graph;
  } catch {
    return null;
  }
}
