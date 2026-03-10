/**
 * @fileoverview Type definitions for the Cron Scheduler system
 * @module scheduler/types
 */

export type ExecutionMode = 'new_chat' | 'terminal';
export type RunMode = 'recurring' | 'once';

/**
 * A scheduled task configuration
 */
export interface ScheduledTask {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Workflow to execute (e.g., '/build', '/deploy-check') */
  workflow: string;
  /** Interval in minutes between executions (for recurring tasks) */
  intervalMinutes: number;
  /** Whether this task is currently active */
  enabled: boolean;
  /** Whether to send result notifications via WhatsApp */
  notifyWhatsApp: boolean;
  /** How the task is executed: 'new_chat' opens a new Antigravity conversation, 'terminal' runs in VS Code terminal */
  executionMode: ExecutionMode;
  /** Whether the task is recurring or runs once: 'recurring' uses setInterval, 'once' uses setTimeout and auto-removes */
  runMode: RunMode;
  /** Delay in minutes before execution (for one-shot tasks). Falls back to intervalMinutes if not set. */
  delayMinutes?: number;
  /** ISO timestamp of the last execution */
  lastRun: string | null;
  /** Result of the last execution */
  lastStatus: 'success' | 'error' | 'running' | null;
  /** ISO timestamp when the task was created */
  createdAt: string;
}

/**
 * The scheduled tasks storage file format
 */
export interface ScheduledTasksConfig {
  tasks: ScheduledTask[];
}

/**
 * Events emitted by the CronScheduler
 */
export interface SchedulerEvents {
  /** Fired when the task list changes (add/remove/update) */
  onTasksChanged: (tasks: ScheduledTask[]) => void;
  /** Fired when a task starts executing */
  onTaskRunning: (taskId: string) => void;
  /** Fired when a task finishes */
  onTaskComplete: (taskId: string, status: 'success' | 'error') => void;
}
