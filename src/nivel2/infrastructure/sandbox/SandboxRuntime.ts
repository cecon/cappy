/**
 * @fileoverview Sandbox runtime using git worktree and command policy.
 * @module infrastructure/sandbox/SandboxRuntime
 */

import { execFile } from 'child_process';
import type { ISandboxRuntime, SandboxResult, UserTurnInput } from '../../../shared/types/agent';
import { ApprovalGate } from './ApprovalGate';
import { ArtifactStore } from './ArtifactStore';
import { CommandPolicy } from './CommandPolicy';
import { EnvScrubber } from './EnvScrubber';
import { PathGuard } from './PathGuard';
import { WorktreeManager } from './WorktreeManager';

/**
 * Executes sandbox turns with isolation and audit artifacts.
 */
export class SandboxRuntime implements ISandboxRuntime {
  private readonly worktreeManager: WorktreeManager;
  private readonly commandPolicy = new CommandPolicy();
  private readonly envScrubber = new EnvScrubber();
  private readonly artifactStore: ArtifactStore;
  private readonly approvalGate = new ApprovalGate();
  private readonly pathGuard: PathGuard;

  constructor(private readonly workspaceRoot: string) {
    this.worktreeManager = new WorktreeManager(workspaceRoot);
    this.artifactStore = new ArtifactStore(workspaceRoot);
    this.pathGuard = new PathGuard(workspaceRoot, `${workspaceRoot}/.cappy/sandbox`);
  }

  /**
   * Executes one sandbox run from user input.
   */
  async execute(input: UserTurnInput): Promise<SandboxResult> {
    const run = await this.worktreeManager.create();
    const commands: string[] = [];
    const logs: string[] = [];
    let status: 'success' | 'error' = 'success';

    try {
      if (!this.pathGuard.isPathAllowed(run.worktreePath)) {
        throw new Error('Worktree path outside allowed boundaries.');
      }

      const command = this.pickCommand(input.prompt);
      const risk = this.commandPolicy.classify(command);
      if (this.commandPolicy.isBlocked(command)) {
        throw new Error(`Comando bloqueado pela policy: ${command}`);
      }

      const approved = await this.approvalGate.requestApproval({
        action: 'Executar comando no sandbox',
        risk,
        command,
      });
      if (!approved) {
        throw new Error('Execução negada pelo usuário.');
      }

      commands.push(command);
      const output = await this.runShell(command, run.worktreePath);
      logs.push(output.trim() || 'Comando executado sem saída.');

      const diff = await this.worktreeManager.getDiff(run.worktreePath);
      const report = this.buildReport(run.runId, command, logs, diff);

      this.artifactStore.saveRun(run.runId, {
        runId: run.runId,
        command,
        logs,
        diff,
        status,
        sourcePrompt: input.prompt,
      });

      return {
        runId: run.runId,
        worktreePath: run.worktreePath,
        commands,
        logs,
        diff,
        status,
        report,
      };
    } catch (error) {
      status = 'error';
      const message = error instanceof Error ? error.message : String(error);
      logs.push(message);
      const report = [
        '## Resultado Sandbox',
        '',
        `- Run: ${run.runId}`,
        `- Status: erro`,
        `- Motivo: ${message}`,
      ].join('\n');
      this.artifactStore.saveRun(run.runId, {
        runId: run.runId,
        commands,
        logs,
        diff: '',
        status,
        sourcePrompt: input.prompt,
      });
      return {
        runId: run.runId,
        worktreePath: run.worktreePath,
        commands,
        logs,
        diff: '',
        status,
        report,
      };
    } finally {
      await this.worktreeManager.dispose(run.worktreePath);
    }
  }

  /**
   * Maps a natural-language prompt to a safe default command.
   */
  private pickCommand(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('lint')) {
      return 'npm run lint';
    }
    if (lower.includes('test')) {
      return 'npm run test:run';
    }
    if (lower.includes('build') || lower.includes('compile')) {
      return 'npm run compile-extension';
    }
    return 'npm run test:run';
  }

  /**
   * Executes shell command inside worktree directory.
   */
  private runShell(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('powershell', ['-NoProfile', '-Command', command], {
        cwd,
        env: this.envScrubber.sanitize(process.env),
        windowsHide: true,
        timeout: 10 * 60 * 1000,
      }, (error, stdout, stderr) => {
        const merged = `${stdout}\n${stderr}`.trim();
        if (error) {
          reject(new Error(merged || error.message));
          return;
        }
        resolve(merged);
      });
    });
  }

  /**
   * Builds markdown summary for UI.
   */
  private buildReport(runId: string, command: string, logs: string[], diff: string): string {
    const hasDiff = Boolean(diff && diff.trim().length > 0);
    const diffPreview = hasDiff
      ? `\n\`\`\`diff\n${diff.slice(0, 4000)}\n\`\`\``
      : '\nSem diff gerado.';
    return [
      '## Resultado Sandbox',
      '',
      `- Run: ${runId}`,
      `- Comando: \`${command}\``,
      `- Logs: ${logs.length}`,
      '',
      '### Diff',
      diffPreview,
    ].join('\n');
  }
}

