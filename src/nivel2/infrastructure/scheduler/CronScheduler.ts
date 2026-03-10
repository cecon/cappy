/**
 * @fileoverview CronScheduler — Manages scheduled workflow execution
 * @module scheduler/CronScheduler
 *
 * Uses native setInterval to run workflows at configurable intervals.
 * Persists task configuration to .cappy/scheduled-tasks.json in the workspace.
 * Dispatches workflows via antigravity.sendPromptToAgentPanel.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ScheduledTask, ScheduledTasksConfig, SchedulerEvents, ExecutionMode, RunMode } from './types';
import type { CappyBridge } from '../bridge/cappy-bridge';

/**
 * Manages scheduled tasks that execute workflows at configured intervals.
 */
export class CronScheduler {
  private tasks: ScheduledTask[] = [];
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private configPath: string;
  private bridge: CappyBridge | null = null;

  // Event callbacks
  private onTasksChangedCallback: SchedulerEvents['onTasksChanged'] | null = null;
  private onTaskRunningCallback: SchedulerEvents['onTaskRunning'] | null = null;
  private onTaskCompleteCallback: SchedulerEvents['onTaskComplete'] | null = null;

  constructor(private readonly workspaceRoot: string) {
    const cappyDir = path.join(workspaceRoot, '.cappy');
    if (!fs.existsSync(cappyDir)) {
      fs.mkdirSync(cappyDir, { recursive: true });
    }
    this.configPath = path.join(cappyDir, 'scheduled-tasks.json');
  }

  // ── Event Registration ──────────────────────────────────────────

  onTasksChanged(callback: SchedulerEvents['onTasksChanged']): void {
    this.onTasksChangedCallback = callback;
  }

  onTaskRunning(callback: SchedulerEvents['onTaskRunning']): void {
    this.onTaskRunningCallback = callback;
  }

  onTaskComplete(callback: SchedulerEvents['onTaskComplete']): void {
    this.onTaskCompleteCallback = callback;
  }

  /**
   * Set bridge reference for WhatsApp notifications
   */
  setBridge(bridge: CappyBridge): void {
    this.bridge = bridge;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /**
   * Initialize the scheduler: load tasks from disk and start all enabled timers
   */
  start(): void {
    this.loadTasks();
    console.log(`[CronScheduler] Loaded ${this.tasks.length} task(s) from config`);

    for (const task of this.tasks) {
      if (task.enabled) {
        this.startTimer(task);
      }
    }

    console.log(`[CronScheduler] Started with ${this.timers.size} active timer(s)`);
  }

  /**
   * Stop all timers and clean up
   */
  stop(): void {
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
      console.log(`[CronScheduler] Stopped timer for task: ${id}`);
    }
    this.timers.clear();
    console.log('[CronScheduler] All timers stopped');
  }

  // ── Task CRUD ───────────────────────────────────────────────────

  /**
   * Get all tasks
   */
  getTasks(): ScheduledTask[] {
    return [...this.tasks];
  }

  /**
   * Add a new scheduled task
   */
  addTask(params: {
    name: string;
    workflow: string;
    intervalMinutes: number;
    notifyWhatsApp?: boolean;
    executionMode?: ExecutionMode;
    runMode?: RunMode;
    delayMinutes?: number;
  }): ScheduledTask {
    const runMode = params.runMode ?? 'recurring';
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      name: params.name,
      workflow: params.workflow,
      intervalMinutes: params.intervalMinutes,
      enabled: true,
      notifyWhatsApp: params.notifyWhatsApp ?? true,
      executionMode: params.executionMode ?? 'new_chat',
      runMode,
      delayMinutes: runMode === 'once' ? (params.delayMinutes ?? params.intervalMinutes) : undefined,
      lastRun: null,
      lastStatus: null,
      createdAt: new Date().toISOString(),
    };

    this.tasks.push(task);
    this.saveTasks();
    this.startTimer(task);
    this.emitTasksChanged();

    const label = runMode === 'once'
      ? `in ${task.delayMinutes}min (once)`
      : `every ${task.intervalMinutes}min`;
    console.log(`[CronScheduler] Added task: ${task.name} (${label})`);
    return task;
  }

  /**
   * Remove a scheduled task
   */
  removeTask(taskId: string): boolean {
    const idx = this.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return false;

    this.stopTimer(taskId);
    this.tasks.splice(idx, 1);
    this.saveTasks();
    this.emitTasksChanged();

    console.log(`[CronScheduler] Removed task: ${taskId}`);
    return true;
  }

  /**
   * Toggle a task's enabled state
   */
  toggleTask(taskId: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.enabled = !task.enabled;

    if (task.enabled) {
      this.startTimer(task);
    } else {
      this.stopTimer(taskId);
    }

    this.saveTasks();
    this.emitTasksChanged();

    console.log(`[CronScheduler] Task ${task.name} is now ${task.enabled ? 'enabled' : 'paused'}`);
    return true;
  }

  // ── Timer Management ────────────────────────────────────────────

  private startTimer(task: ScheduledTask): void {
    // Clear existing timer if any
    this.stopTimer(task.id);

    if (task.runMode === 'once') {
      // One-shot: use setTimeout, then auto-remove after execution
      const delayMs = (task.delayMinutes ?? task.intervalMinutes) * 60 * 1000;
      const timer = setTimeout(async () => {
        await this.executeTask(task);
        // Auto-remove after execution
        console.log(`[CronScheduler] One-shot task "${task.name}" completed — auto-removing`);
        this.removeTask(task.id);
      }, delayMs);
      this.timers.set(task.id, timer);
      console.log(`[CronScheduler] Timer started for "${task.name}" (once in ${task.delayMinutes ?? task.intervalMinutes}min)`);
    } else {
      // Recurring: use setInterval
      const intervalMs = task.intervalMinutes * 60 * 1000;
      const timer = setInterval(() => {
        this.executeTask(task);
      }, intervalMs);
      this.timers.set(task.id, timer);
      console.log(`[CronScheduler] Timer started for "${task.name}" (every ${task.intervalMinutes}min)`);
    }
  }

  private stopTimer(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) {
      // clearTimeout works for both setTimeout and setInterval handles
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
  }

  // ── Task Execution ──────────────────────────────────────────────

  /**
   * Execute a scheduled task by dispatching its workflow
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    console.log(`[CronScheduler] Executing task: ${task.name} (workflow: ${task.workflow})`);

    // Update status to running
    task.lastRun = new Date().toISOString();
    task.lastStatus = 'running';
    this.saveTasks();
    this.onTaskRunningCallback?.(task.id);
    this.emitTasksChanged();

    try {
      // ── Special: WhatsApp reminder tasks ──
      // Workflows prefixed with "whatsapp:" send a message directly to WhatsApp
      // instead of dispatching to the agent panel.
      if (task.workflow.startsWith('whatsapp:')) {
        const reminderMessage = task.workflow.slice('whatsapp:'.length).trim();
        if (this.bridge && reminderMessage) {
          await this.bridge.replyToWhatsApp(`⏰ ${reminderMessage}`);
          task.lastStatus = 'success';
          console.log(`[CronScheduler] WhatsApp reminder sent: "${reminderMessage}"`);
        } else {
          throw new Error('Bridge not available or empty reminder message');
        }
      } else {
      // ── Normal workflow dispatch ──
      // Read the workflow file to get the prompt content
      const workflowPath = path.join(
        this.workspaceRoot,
        '.agents',
        'workflows',
        `${task.workflow.replace(/^\//, '')}.md`,
      );

      let prompt: string;
      if (fs.existsSync(workflowPath)) {
        prompt = `Execute o workflow ${task.workflow} — tarefa agendada "${task.name}"`;
      } else {
        prompt = `Execute o workflow ${task.workflow}`;
      }

      // Dispatch based on execution mode
      const mode = task.executionMode || 'new_chat';

      if (mode === 'terminal') {
        // Execute in VS Code terminal
        const terminal = vscode.window.createTerminal({ name: `Cappy Cron: ${task.name}` });
        const workflowFile = task.workflow.replace(/^\//, '') + '.md';
        const scriptPath = path.join(this.workspaceRoot, '.agents', 'workflows', workflowFile);
        if (fs.existsSync(scriptPath)) {
          terminal.sendText(`cat "${scriptPath}"`);
        } else {
          terminal.sendText(`echo "Workflow ${task.workflow} não encontrado"`);
        }
        terminal.show(false);
      } else {
        // new_chat: dispatch to Antigravity agent panel (opens new conversation)
        await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', prompt);
      }

      task.lastStatus = 'success';
      console.log(`[CronScheduler] Task "${task.name}" dispatched successfully (mode: ${mode})`);

      // Notify via WhatsApp
      if (task.notifyWhatsApp && this.bridge) {
        try {
          await this.bridge.replyToWhatsApp(
            `✅ [Cron] Tarefa "${task.name}" executada com sucesso (${task.workflow})`,
          );
        } catch {
          console.warn('[CronScheduler] Failed to notify WhatsApp');
        }
      }
      } // end else (normal workflow dispatch)
    } catch (err) {
      task.lastStatus = 'error';
      console.error(`[CronScheduler] Task "${task.name}" failed:`, err);

      // Notify error via WhatsApp
      if (task.notifyWhatsApp && this.bridge) {
        try {
          const errMsg = err instanceof Error ? err.message : String(err);
          await this.bridge.replyToWhatsApp(
            `❌ [Cron] Tarefa "${task.name}" falhou: ${errMsg}`,
          );
        } catch {
          console.warn('[CronScheduler] Failed to notify WhatsApp about error');
        }
      }
    }

    this.onTaskCompleteCallback?.(task.id, task.lastStatus as 'success' | 'error');
    this.saveTasks();
    this.emitTasksChanged();
  }

  /**
   * Manually trigger a task (for testing or on-demand execution)
   */
  async runNow(taskId: string): Promise<boolean> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    await this.executeTask(task);
    return true;
  }

  // ── Persistence ─────────────────────────────────────────────────

  private loadTasks(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const config: ScheduledTasksConfig = JSON.parse(raw);
        this.tasks = config.tasks || [];
      }
    } catch (err) {
      console.error('[CronScheduler] Failed to load config:', err);
      this.tasks = [];
    }
  }

  private saveTasks(): void {
    try {
      const config: ScheduledTasksConfig = { tasks: this.tasks };
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[CronScheduler] Failed to save config:', err);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private emitTasksChanged(): void {
    this.onTasksChangedCallback?.(this.getTasks());
  }

  /**
   * Calculate next run time for a task
   */
  getNextRun(taskId: string): Date | null {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || !task.enabled) return null;

    if (task.runMode === 'once') {
      // One-shot: next run is creation + delay
      const created = new Date(task.createdAt);
      const delayMs = (task.delayMinutes ?? task.intervalMinutes) * 60 * 1000;
      return new Date(created.getTime() + delayMs);
    }

    if (task.lastRun) {
      const lastRun = new Date(task.lastRun);
      return new Date(lastRun.getTime() + task.intervalMinutes * 60 * 1000);
    }

    // If never run, next run is now + interval from creation
    const created = new Date(task.createdAt);
    return new Date(created.getTime() + task.intervalMinutes * 60 * 1000);
  }
}
