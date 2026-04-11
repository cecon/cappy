import { readdir } from "node:fs/promises";
import path from "node:path";

/** Directories to skip at any level of the tree walk. */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  ".next",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
]);

/** Maximum directory depth to recurse (root = depth 1, first-level children = depth 2, …). */
const MAX_DEPTH = 3;

/** Approximate max characters for the tree block before truncation (~1 500 tokens). */
const MAX_TREE_CHARS = 6_000;

interface TreeNode {
  name: string;
  isDir: boolean;
  children?: TreeNode[];
}

/**
 * Recursively reads the directory tree up to MAX_DEPTH levels.
 * Excluded directory names are silently skipped.
 * Permission errors on any subtree produce an empty children list rather than throwing.
 */
async function readTree(dirPath: string, depth: number): Promise<TreeNode[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // Sort: directories first (alphabetically), then files (alphabetically)
  const dirs = entries
    .filter((e) => e.isDirectory() && !EXCLUDED_DIRS.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = entries
    .filter((e) => !e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const nodes: TreeNode[] = [];
  for (const dir of dirs) {
    nodes.push({
      name: dir.name,
      isDir: true,
      children: await readTree(path.join(dirPath, dir.name), depth + 1),
    });
  }
  for (const file of files) {
    nodes.push({ name: file.name, isDir: false });
  }
  return nodes;
}

/**
 * Renders a list of TreeNodes into indented text lines (classic ASCII tree style).
 * Mutates the `lines` accumulator for efficiency.
 */
function renderTree(nodes: TreeNode[], prefix: string, lines: string[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLast = i === nodes.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    lines.push(`${prefix}${connector}${node.name}${node.isDir ? "/" : ""}`);
    if (node.isDir && node.children && node.children.length > 0) {
      renderTree(node.children, childPrefix, lines);
    }
  }
}

/**
 * Builds a compact ASCII directory tree of `rootDir`.
 * Output is capped at MAX_TREE_CHARS; any excess is replaced with a truncation notice.
 * Returns an empty string if the root directory is unreadable.
 */
export async function buildWorkspaceTree(rootDir: string): Promise<string> {
  const nodes = await readTree(rootDir, 1);
  const lines: string[] = [`${path.basename(rootDir)}/`];
  renderTree(nodes, "", lines);
  let text = lines.join("\n");
  if (text.length > MAX_TREE_CHARS) {
    text = text.slice(0, MAX_TREE_CHARS) + "\n… (tree truncated)";
  }
  return text;
}

/**
 * Builds the workspace tree and wraps it in a system-prompt block.
 * Returns an empty string when the workspace root is unreadable or empty,
 * so the caller can safely skip injection.
 *
 * Only call this for non-silent (interactive) agent runs — subagents
 * do not need it and it would waste tokens.
 */
export async function buildWorkspaceTreePromptBlock(rootDir: string): Promise<string> {
  const tree = await buildWorkspaceTree(rootDir);
  if (!tree.trim()) {
    return "";
  }
  return [
    "## Workspace directory tree (auto-generated)",
    "```",
    tree,
    "```",
    "Use this to understand existing structure before suggesting file paths or directory reorganizations.",
  ].join("\n");
}
