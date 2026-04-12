/**
 * AST symbol extractor — uses VS Code's built-in Language Server Protocol
 * (DocumentSymbolProvider) to extract semantic code units without any
 * native binary (no Tree-sitter addon, no Babel parser).
 *
 * Works for every language that has a VS Code extension with a symbol provider
 * (TypeScript, JavaScript, Python, Go, C#, Rust, Java, …).
 */

import * as vscode from "vscode";

import type { AstSymbol } from "./types";

/** VS Code SymbolKind numbers that are worth indexing as independent chunks. */
const INDEXABLE_KINDS = new Set([
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Class,
  vscode.SymbolKind.Interface,
  vscode.SymbolKind.Enum,
  vscode.SymbolKind.Module,
  vscode.SymbolKind.Namespace,
  vscode.SymbolKind.Constructor,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Property,
  vscode.SymbolKind.Variable,
  vscode.SymbolKind.Constant,
  vscode.SymbolKind.TypeParameter,
]);

const KIND_LABEL: Partial<Record<vscode.SymbolKind, string>> = {
  [vscode.SymbolKind.Function]: "function",
  [vscode.SymbolKind.Class]: "class",
  [vscode.SymbolKind.Interface]: "interface",
  [vscode.SymbolKind.Enum]: "enum",
  [vscode.SymbolKind.Module]: "module",
  [vscode.SymbolKind.Namespace]: "namespace",
  [vscode.SymbolKind.Constructor]: "constructor",
  [vscode.SymbolKind.Method]: "method",
  [vscode.SymbolKind.Property]: "property",
  [vscode.SymbolKind.Variable]: "variable",
  [vscode.SymbolKind.Constant]: "constant",
  [vscode.SymbolKind.TypeParameter]: "type",
};

/**
 * Attempts to extract semantic symbols from `filePath` using the active
 * Language Server. Returns an empty array if no provider is registered or
 * if the language server times out (callers should use RegexChunker as fallback).
 */
export async function extractSymbols(
  filePath: string,
  chunkMaxChars: number,
): Promise<AstSymbol[]> {
  try {
    const uri = vscode.Uri.file(filePath);
    // openTextDocument loads the file into VS Code's model without opening a tab.
    const doc = await vscode.workspace.openTextDocument(uri);
    const raw = await withTimeout(
      Promise.resolve(
        vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
          "vscode.executeDocumentSymbolProvider",
          doc.uri,
        ),
      ),
      5000,
    );
    if (!raw || raw.length === 0) return [];
    return flattenSymbols(raw, doc, chunkMaxChars, "");
  } catch {
    return [];
  }
}

// ── Flattening helpers ─────────────────────────────────────────────────────

function flattenSymbols(
  symbols: vscode.DocumentSymbol[],
  doc: vscode.TextDocument,
  chunkMaxChars: number,
  parentName: string,
): AstSymbol[] {
  const result: AstSymbol[] = [];
  for (const sym of symbols) {
    if (!INDEXABLE_KINDS.has(sym.kind)) continue;
    const qualifiedName = parentName ? `${parentName}.${sym.name}` : sym.name;
    const startLine = sym.range.start.line;
    const endLine = sym.range.end.line;
    const charCount = doc.getText(sym.range).length;

    if (charCount <= chunkMaxChars) {
      // Fits in one chunk — emit as single symbol (including children).
      result.push({
        name: qualifiedName,
        kindLabel: KIND_LABEL[sym.kind] ?? "symbol",
        startLine,
        endLine,
      });
    } else if (sym.children.length > 0) {
      // Too large — recurse into children instead.
      result.push(...flattenSymbols(sym.children, doc, chunkMaxChars, qualifiedName));
    } else {
      // Leaf too large with no children — emit anyway (will be truncated by indexer).
      result.push({
        name: qualifiedName,
        kindLabel: KIND_LABEL[sym.kind] ?? "symbol",
        startLine,
        endLine,
      });
    }
  }
  return result;
}

// ── Timeout helper ─────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("LS timeout")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
