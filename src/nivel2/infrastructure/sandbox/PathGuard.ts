/**
 * @fileoverview Path scope guard for sandbox boundaries.
 * @module infrastructure/sandbox/PathGuard
 */

import * as path from 'path';

/**
 * Validates if paths stay inside approved roots.
 */
export class PathGuard {
  constructor(
    private readonly workspaceRoot: string,
    private readonly sandboxRoot: string,
  ) {}

  /**
   * Returns true when target path is inside workspace or sandbox roots.
   */
  isPathAllowed(targetPath: string): boolean {
    const normalized = path.resolve(targetPath);
    const workspace = path.resolve(this.workspaceRoot);
    const sandbox = path.resolve(this.sandboxRoot);
    return normalized.startsWith(workspace) || normalized.startsWith(sandbox);
  }
}

