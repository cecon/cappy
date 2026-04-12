/**
 * GitHeadTracker — reads .git/HEAD and uses `git diff --name-only` to
 * return exactly which files changed between two commits.
 *
 * Zero binary dependencies beyond the git CLI that ships with any dev machine.
 * All file I/O uses node:fs/promises; git invocation uses node:child_process.
 */

import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Reads the current HEAD commit SHA of the repository at `workspaceRoot`.
 * Handles both branch refs and detached HEAD.
 * Returns null when the git dir does not exist or HEAD cannot be resolved.
 */
export async function readHeadSha(workspaceRoot: string): Promise<string | null> {
  try {
    const headFile = path.join(workspaceRoot, ".git", "HEAD");
    const raw = (await readFile(headFile, "utf8")).trim();

    // Symbolic ref: "ref: refs/heads/<branch>"
    if (raw.startsWith("ref: ")) {
      const ref = raw.slice(5).trim(); // e.g. "refs/heads/main"
      return await resolveRef(workspaceRoot, ref);
    }

    // Detached HEAD — raw is already the SHA.
    if (/^[0-9a-f]{40}$/iu.test(raw)) return raw;

    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the current branch name, or null when in detached-HEAD state.
 */
export async function getCurrentBranch(workspaceRoot: string): Promise<string | null> {
  try {
    const headFile = path.join(workspaceRoot, ".git", "HEAD");
    const raw = (await readFile(headFile, "utf8")).trim();
    if (!raw.startsWith("ref: refs/heads/")) return null;
    return raw.slice("ref: refs/heads/".length).trim();
  } catch {
    return null;
  }
}

/**
 * Returns absolute paths of files that changed between `oldSha` and the
 * current HEAD, filtered to only those matching `includeExtensions`.
 *
 * Uses `git diff --name-only <oldSha> HEAD` — fast O(diff) rather than
 * O(workspace) full scan.
 *
 * Returns an empty array when git is unavailable or oldSha is unknown.
 */
export async function getChangedFiles(
  workspaceRoot: string,
  oldSha: string,
  includeExtensions: string[],
): Promise<string[]> {
  // Normalise extensions to lowercase with leading dot.
  const exts = new Set(
    includeExtensions.map((e) => (e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`)),
  );

  try {
    const { stdout } = await execAsync(
      `git diff --name-only ${oldSha} HEAD`,
      { cwd: workspaceRoot, timeout: 10_000 },
    );

    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        const ext = path.extname(line).toLowerCase();
        return exts.has(ext);
      })
      .map((relative) => path.join(workspaceRoot, relative));
  } catch {
    // git not available, oldSha unknown, or diff failed — caller falls back to full scan.
    return [];
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Resolves a git ref (e.g. "refs/heads/main") to its commit SHA.
 * Checks the loose ref file first, then falls back to packed-refs.
 */
async function resolveRef(workspaceRoot: string, ref: string): Promise<string | null> {
  // 1. Loose ref file: .git/<ref>
  const loosePath = path.join(workspaceRoot, ".git", ...ref.split("/"));
  try {
    const sha = (await readFile(loosePath, "utf8")).trim();
    if (/^[0-9a-f]{40}$/iu.test(sha)) return sha;
  } catch {
    // Not found as a loose ref — try packed-refs.
  }

  // 2. packed-refs file
  try {
    const packedPath = path.join(workspaceRoot, ".git", "packed-refs");
    const content = await readFile(packedPath, "utf8");
    for (const line of content.split("\n")) {
      if (line.startsWith("#")) continue;
      const parts = line.trim().split(/\s+/u);
      if (parts.length >= 2 && parts[1] === ref) {
        const sha = parts[0];
        if (sha !== undefined && /^[0-9a-f]{40}$/iu.test(sha)) return sha;
      }
    }
  } catch {
    // packed-refs does not exist.
  }

  return null;
}
