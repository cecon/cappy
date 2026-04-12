/**
 * Regex-based file chunker — fallback for files without an active Language Server
 * (e.g. Markdown, plain text, config files).
 * Zero external dependencies.
 */

import type { AstSymbol } from "./types";

/**
 * Splits `content` into symbol-like chunks using heading markers (Markdown)
 * or a fixed sliding window for plain text.
 *
 * @param content     Full file text.
 * @param filePath    Used only to choose strategy by extension.
 * @param maxChars    Maximum characters per chunk.
 * @param overlapChars  Characters repeated at the start of the next chunk.
 */
export function regexChunk(
  content: string,
  filePath: string,
  maxChars: number,
  overlapChars: number,
): AstSymbol[] {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "md" || ext === "mdx") {
    return chunkMarkdown(content, maxChars);
  }
  return chunkSlidingWindow(content, maxChars, overlapChars);
}

// ── Markdown chunker ───────────────────────────────────────────────────────

const HEADING_RE = /^#{1,4}\s+(.+)$/mu;

function chunkMarkdown(content: string, maxChars: number): AstSymbol[] {
  const lines = content.split("\n");
  const sections: Array<{ name: string; startLine: number; lines: string[] }> = [];
  let current: { name: string; startLine: number; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = HEADING_RE.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { name: m[1]?.trim() ?? line.trim(), startLine: i, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  // If no headings found, fall back to sliding window.
  if (sections.length === 0) return chunkSlidingWindow(content, maxChars, Math.floor(maxChars * 0.1));

  const symbols: AstSymbol[] = [];
  for (const sec of sections) {
    const body = sec.lines.join("\n");
    if (body.length <= maxChars) {
      symbols.push({
        name: sec.name,
        kindLabel: "section",
        startLine: sec.startLine,
        endLine: sec.startLine + sec.lines.length,
      });
    } else {
      // Section too large — sub-chunk with sliding window, prefixing with heading.
      const subChunks = chunkSlidingWindow(body, maxChars, Math.floor(maxChars * 0.1));
      for (const sub of subChunks) {
        symbols.push({
          name: `${sec.name} (part ${symbols.length + 1})`,
          kindLabel: "section",
          startLine: sec.startLine + sub.startLine,
          endLine: sec.startLine + sub.endLine,
        });
      }
    }
  }
  return symbols;
}

// ── Sliding-window chunker ─────────────────────────────────────────────────

function chunkSlidingWindow(content: string, maxChars: number, overlapChars: number): AstSymbol[] {
  if (content.length === 0) return [];

  const lines = content.split("\n");
  const symbols: AstSymbol[] = [];
  let startLine = 0;
  let charCount = 0;
  let chunkStart = 0;

  for (let i = 0; i < lines.length; i++) {
    charCount += (lines[i]?.length ?? 0) + 1; // +1 for the newline
    if (charCount >= maxChars) {
      symbols.push({
        name: `chunk-${symbols.length + 1}`,
        kindLabel: "chunk",
        startLine: chunkStart,
        endLine: i,
      });
      // Roll back by overlapChars to compute the new start line.
      let rollback = 0;
      let newStart = i;
      while (newStart > chunkStart && rollback < overlapChars) {
        rollback += (lines[newStart]?.length ?? 0) + 1;
        newStart--;
      }
      chunkStart = newStart;
      startLine = newStart;
      charCount = rollback;
    }
  }

  // Emit the last chunk if it has content.
  if (chunkStart < lines.length - 1) {
    symbols.push({
      name: `chunk-${symbols.length + 1}`,
      kindLabel: "chunk",
      startLine: chunkStart,
      endLine: lines.length - 1,
    });
  }

  // Suppress unused variable warning.
  void startLine;

  return symbols;
}
