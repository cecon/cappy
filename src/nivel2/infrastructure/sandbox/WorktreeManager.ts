/**
 * @fileoverview Git worktree lifecycle manager for sandbox runs.
 * @module infrastructure/sandbox/WorktreeManager
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';

/**
 * Promisified git command helper.
 */
function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Handles creation/removal/diff extraction for isolated worktrees.
 */
export class WorktreeManager {
  private readonly sandboxRoot: string;

  constructor(private readonly workspaceRoot: string) {
    this.sandboxRoot = path.join(workspaceRoot, '.cappy', 'sandbox');
    fs.mkdirSync(this.sandboxRoot, { recursive: true });
  }

  /**
   * Creates a detached worktree and returns run metadata.
   */
  async create(preferredRunId?: string): Promise<{ runId: string; worktreePath: string }> {
    const runId = preferredRunId ?? `run-${crypto.randomUUID()}`;
    const worktreePath = path.join(this.sandboxRoot, runId);
    await runGit(['worktree', 'add', '--detach', worktreePath, 'HEAD'], this.workspaceRoot);
    return { runId, worktreePath };
  }

  /**
   * Returns diff for worktree changes against HEAD.
   */
  async getDiff(worktreePath: string): Promise<string> {
    const { stdout } = await runGit(['diff', '--no-ext-diff'], worktreePath);
    return stdout.trim();
  }

  /**
   * Removes a worktree and its directory.
   */
  async dispose(worktreePath: string): Promise<void> {
    try {
      await runGit(['worktree', 'remove', '--force', worktreePath], this.workspaceRoot);
    } catch {
      // Fallback cleanup if git worktree remove fails.
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }
  }
}

