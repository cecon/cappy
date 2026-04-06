/**
 * @fileoverview Process supervisor for external OpenClaude runtime.
 * @module infrastructure/openclaude/OpenClaudeProcessSupervisor
 */

import { execFile } from 'child_process';

/**
 * Runtime health status for OpenClaude process layer.
 */
export interface OpenClaudeHealthStatus {
  /**
   * True when command exists and responds.
   */
  healthy: boolean;
  /**
   * Human-readable status details.
   */
  message: string;
}

/**
 * Supervises command-level availability of OpenClaude CLI runtime.
 */
export class OpenClaudeProcessSupervisor {
  constructor(private readonly command: string) {}

  /**
   * Executes a quick health check using `<command> --version`.
   */
  checkHealth(): Promise<OpenClaudeHealthStatus> {
    return new Promise((resolve) => {
      execFile(this.command, ['--version'], { windowsHide: true, timeout: 6000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            healthy: false,
            message: stderr?.trim() || error.message,
          });
          return;
        }
        resolve({
          healthy: true,
          message: stdout.trim() || 'OpenClaude disponível.',
        });
      });
    });
  }
}

