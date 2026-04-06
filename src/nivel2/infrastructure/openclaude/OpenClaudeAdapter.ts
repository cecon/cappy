/**
 * @fileoverview Adapter for external OpenClaude process integration.
 * @module infrastructure/openclaude/OpenClaudeAdapter
 */

import { execFile } from 'child_process';
import type { IOpenClaudeAdapter } from '../../../shared/types/agent';
import { OpenClaudeProcessSupervisor } from './OpenClaudeProcessSupervisor';

/**
 * Connects orchestration layer to OpenClaude external command.
 */
export class OpenClaudeAdapter implements IOpenClaudeAdapter {
  private readonly supervisor: OpenClaudeProcessSupervisor;

  constructor(private readonly command = 'openclaude') {
    this.supervisor = new OpenClaudeProcessSupervisor(command);
  }

  /**
   * Returns true if command responds to healthcheck.
   */
  async isAvailable(): Promise<boolean> {
    const status = await this.supervisor.checkHealth();
    return status.healthy;
  }

  /**
   * Sends prompt through CLI non-interactive mode.
   */
  send(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.command,
        ['-p', prompt],
        { windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }
          resolve(stdout.trim() || 'OpenClaude não retornou conteúdo.');
        },
      );
    });
  }
}

