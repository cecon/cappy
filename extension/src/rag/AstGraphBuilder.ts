/**
 * AstGraphBuilder — extracts inter-file dependency edges via regex.
 * Zero binary dependencies (no Tree-sitter, no Babel).
 *
 * Supports:
 *  - TypeScript / JavaScript: all import forms + class extends/implements
 *  - Python: relative imports (from .module import …)
 *
 * Returns *raw* edges (unresolved import paths). Resolution to absolute
 * file paths happens in RagIndexer where the full indexed-file set is known.
 */

import path from "node:path";

import type { AstEdge } from "./types";

/** Intermediate — import path not yet resolved to an absolute file. */
export interface RawEdge {
  from: string;           // absolute source file path
  rawTo: string;          // raw import string, e.g. '../services/UserService'
  kind: AstEdge["kind"];
}

const TS_JS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cts", ".cjs"]);

/**
 * Extracts dependency edges from `content` (file at `filePath`).
 * Returns raw (unresolved) edges — caller must resolve `rawTo` to an
 * absolute path using `resolveRawEdge()` below.
 */
export function extractRawEdges(filePath: string, content: string): RawEdge[] {
  const ext = path.extname(filePath).toLowerCase();
  if (TS_JS_EXTS.has(ext)) return extractTsJsEdges(filePath, content);
  if (ext === ".py") return extractPythonEdges(filePath, content);
  return [];
}

/**
 * Resolves a raw import path to an absolute file path using the set of
 * already-indexed files. Returns null if the target is not indexed.
 */
export function resolveRawEdge(
  fromFile: string,
  rawTo: string,
  indexedFiles: Set<string>,
  extensions: string[],
): string | null {
  const base = path.resolve(path.dirname(fromFile), rawTo);

  // Exact match (path already has extension).
  if (indexedFiles.has(base)) return base;

  // Try appending each known extension.
  for (const ext of extensions) {
    const candidate = `${base}${ext}`;
    if (indexedFiles.has(candidate)) return candidate;
  }

  // Try directory index file.
  for (const ext of extensions) {
    const candidate = path.join(base, `index${ext}`);
    if (indexedFiles.has(candidate)) return candidate;
  }

  return null;
}

/**
 * Convenience: resolve a full list of RawEdges to AstEdges in one pass.
 */
export function resolveEdges(
  rawEdges: RawEdge[],
  indexedFiles: Set<string>,
  extensions: string[],
): AstEdge[] {
  const result: AstEdge[] = [];
  for (const raw of rawEdges) {
    const to = resolveRawEdge(raw.from, raw.rawTo, indexedFiles, extensions);
    if (to && to !== raw.from) {
      result.push({ from: raw.from, to, kind: raw.kind });
    }
  }
  return result;
}

// ── TypeScript / JavaScript ────────────────────────────────────────────────

function extractTsJsEdges(filePath: string, content: string): RawEdge[] {
  const edges: RawEdge[] = [];

  // Build symbol → rawPath map for extends/implements cross-referencing.
  const importMap = new Map<string, string>(); // symbolName → rawImportPath
  const allImports = new Set<string>();         // all distinct relative import paths

  // Collapse multiline import statements so single-line regexes work.
  const collapsed = collapseMultilineImports(content);

  // ── Named imports: import { A, B as C } from './path' ─────────────────
  const namedRe = /import\s+(?:type\s+)?\{\s*([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gu;
  for (const m of collapsed.matchAll(namedRe)) {
    const symbols = m[1]; const rawPath = m[2];
    if (!rawPath || !symbols || !rawPath.startsWith(".")) continue;
    allImports.add(rawPath);
    for (const sym of symbols.split(",")) {
      const trimmed = sym.trim();
      const parts = trimmed.split(/\s+as\s+/u);
      const localName = (parts[1] ?? parts[0])?.trim();
      if (localName) importMap.set(localName, rawPath);
    }
  }

  // ── Default import: import X from './path' ────────────────────────────
  const defaultRe = /import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/gu;
  for (const m of collapsed.matchAll(defaultRe)) {
    const sym = m[1]; const rawPath = m[2];
    if (!rawPath || !sym || !rawPath.startsWith(".")) continue;
    allImports.add(rawPath);
    importMap.set(sym, rawPath);
  }

  // ── Mixed: import X, { A, B } from './path' ───────────────────────────
  const mixedRe = /import\s+(\w+)\s*,\s*\{\s*([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gu;
  for (const m of collapsed.matchAll(mixedRe)) {
    const def = m[1]; const named = m[2]; const rawPath = m[3];
    if (!rawPath || !def || !named || !rawPath.startsWith(".")) continue;
    allImports.add(rawPath);
    importMap.set(def, rawPath);
    for (const sym of named.split(",")) {
      const local = sym.trim().split(/\s+as\s+/u)[1]?.trim() ?? sym.trim();
      if (local) importMap.set(local, rawPath);
    }
  }

  // ── Namespace: import * as X from './path' ────────────────────────────
  const nsRe = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gu;
  for (const m of collapsed.matchAll(nsRe)) {
    const sym = m[1]; const rawPath = m[2];
    if (!rawPath || !sym || !rawPath.startsWith(".")) continue;
    allImports.add(rawPath);
    importMap.set(sym, rawPath);
  }

  // ── Re-exports: export { X } from './path' ────────────────────────────
  const reexportRe = /export\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/gu;
  for (const m of content.matchAll(reexportRe)) {
    const rawPath = m[1];
    if (rawPath?.startsWith(".")) allImports.add(rawPath);
  }

  // ── Side-effect: import './path' ──────────────────────────────────────
  const sideEffectRe = /(?:^|;|\n)\s*import\s+['"]([^'"]+)['"]/gu;
  for (const m of content.matchAll(sideEffectRe)) {
    const rawPath = m[1];
    if (rawPath?.startsWith(".")) allImports.add(rawPath);
  }

  // Emit one "imports" edge per distinct relative import path.
  for (const rawTo of allImports) {
    edges.push({ from: filePath, rawTo, kind: "imports" });
  }

  // ── Class extends / implements ─────────────────────────────────────────
  // class Foo<T> extends Bar implements Baz, Qux {
  const classRe =
    /class\s+\w+(?:<[^>]*>)?\s+(?:extends\s+(\w+)(?:<[^>]*>)?)?(?:\s+implements\s+([\w,\s<>]+?))?(?:\s*\{|\s+extends|\s+implements)/gu;

  for (const [, extendsName, implementsStr] of content.matchAll(classRe)) {
    if (extendsName) {
      const rawTo = importMap.get(extendsName);
      if (rawTo) edges.push({ from: filePath, rawTo, kind: "extends" });
    }
    if (implementsStr) {
      for (const iface of implementsStr.split(",")) {
        const name = iface.trim().replace(/<[^>]*>/gu, "").trim();
        const rawTo = importMap.get(name);
        if (rawTo) edges.push({ from: filePath, rawTo, kind: "implements" });
      }
    }
  }

  return deduplicateEdges(edges);
}

// ── Python ─────────────────────────────────────────────────────────────────

function extractPythonEdges(filePath: string, content: string): RawEdge[] {
  const edges: RawEdge[] = [];

  // from .module import X  → ./module (relative)
  // from ..pkg.module import X → ../../pkg/module (relative)
  const relRe = /from\s+(\.+)([\w.]*)\s+import\s+/gu;
  for (const m of content.matchAll(relRe)) {
    const dots = m[1]; const modPath = m[2];
    if (!dots) continue;
    const upCount = dots.length - 1;
    const up = upCount > 0 ? "../".repeat(upCount) : "./";
    const sub = modPath ? modPath.replace(/\./gu, "/") : "";
    const rawTo = sub ? `${up}${sub}` : up.slice(0, -1) || ".";
    edges.push({ from: filePath, rawTo, kind: "imports" });
  }

  return deduplicateEdges(edges);
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/**
 * Collapses multi-line import statements to a single line so that
 * single-line regexes can process them.
 */
function collapseMultilineImports(content: string): string {
  // Matches: import ... { ... \n ... } ... from 'path'
  return content.replace(
    /import\b[^;'"]*?\{[^}]*\}[^;'"]*?from\s+['"][^'"]+['"]/gsu,
    (m) => m.replace(/\n\s*/gu, " "),
  );
}

/** Remove duplicate edges (same from+to+kind). */
function deduplicateEdges(edges: RawEdge[]): RawEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.from}|${e.rawTo}|${e.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
