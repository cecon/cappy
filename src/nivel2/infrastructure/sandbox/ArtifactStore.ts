/**
 * @fileoverview Persists sandbox run artifacts.
 * @module infrastructure/sandbox/ArtifactStore
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes run logs and summaries into .cappy/sandbox-runs.
 */
export class ArtifactStore {
  private readonly runsDir: string;

  constructor(workspaceRoot: string) {
    this.runsDir = path.join(workspaceRoot, '.cappy', 'sandbox-runs');
    fs.mkdirSync(this.runsDir, { recursive: true });
  }

  /**
   * Saves one run report as json artifact.
   */
  saveRun(runId: string, data: Record<string, unknown>): string {
    const target = path.join(this.runsDir, `${runId}.json`);
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf-8');
    return target;
  }
}

