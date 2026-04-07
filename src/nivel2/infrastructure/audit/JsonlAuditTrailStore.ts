/**
 * @fileoverview Append-only JSONL audit trail store with async write queue.
 * @module infrastructure/audit/JsonlAuditTrailStore
 */

import * as path from 'path';
import { appendFile, mkdir, readFile } from 'fs/promises';
import type { AuditEvent, IAuditTrailStore } from '../../../shared/types/agent';

interface PendingWrite {
  targetPaths: string[];
  line: string;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Persists unified audit events to JSONL files in append-only mode.
 */
export class JsonlAuditTrailStore implements IAuditTrailStore {
  private readonly baseDir: string;
  private readonly ensureBaseDirReady: Promise<void>;
  private readonly queue: PendingWrite[] = [];
  private readonly flushWaiters: Array<() => void> = [];
  private isProcessing = false;

  constructor(workspaceRoot: string) {
    this.baseDir = path.join(workspaceRoot, '.cappy', 'audit');
    this.ensureBaseDirReady = mkdir(this.baseDir, { recursive: true }).then(() => undefined);
  }

  /**
   * Appends one event to session/run/global JSONL files in-order.
   */
  async append(event: AuditEvent): Promise<void> {
    await this.ensureBaseDirReady;
    const line = `${JSON.stringify(event)}\n`;
    const targetPaths = this.getTargetPaths(event);
    await this.enqueueWrite({ targetPaths, line });
  }

  /**
   * Reads events for one run id.
   */
  async readByRunId(runId: string): Promise<AuditEvent[]> {
    await this.flush();
    const target = path.join(this.baseDir, `run-${this.safeFilePart(runId)}.jsonl`);
    return this.readFileEvents(target);
  }

  /**
   * Reads events for one session id.
   */
  async readBySessionId(sessionId: string): Promise<AuditEvent[]> {
    await this.flush();
    const target = path.join(this.baseDir, `session-${this.safeFilePart(sessionId)}.jsonl`);
    return this.readFileEvents(target);
  }

  /**
   * Waits until all queued writes are persisted.
   */
  async flush(): Promise<void> {
    await this.ensureBaseDirReady;
    if (!this.isProcessing && this.queue.length === 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.flushWaiters.push(resolve);
    });
  }

  /**
   * Derives all target files that should receive the event.
   */
  private getTargetPaths(event: AuditEvent): string[] {
    const targets = [
      path.join(this.baseDir, 'all-events.jsonl'),
      path.join(this.baseDir, `session-${this.safeFilePart(event.sessionId)}.jsonl`),
      path.join(this.baseDir, `run-${this.safeFilePart(event.runId)}.jsonl`),
    ];
    return Array.from(new Set(targets));
  }

  /**
   * Enqueues one persisted write batch and processes queue asynchronously.
   */
  private async enqueueWrite(data: Pick<PendingWrite, 'targetPaths' | 'line'>): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.queue.push({
        targetPaths: data.targetPaths,
        line: data.line,
        resolve,
        reject,
      });
      void this.processQueue();
    });
  }

  /**
   * Processes queue in FIFO order using async appendFile.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    try {
      while (this.queue.length > 0) {
        const current = this.queue.shift();
        if (!current) {
          continue;
        }
        try {
          for (const targetPath of current.targetPaths) {
            await appendFile(targetPath, current.line, 'utf-8');
          }
          current.resolve();
        } catch (error) {
          current.reject(error);
        }
      }
    } finally {
      this.isProcessing = false;
      this.resolveFlushWaitersIfIdle();
    }
  }

  /**
   * Resolves all pending flush waiters when queue is idle.
   */
  private resolveFlushWaitersIfIdle(): void {
    if (this.isProcessing || this.queue.length > 0) {
      return;
    }
    while (this.flushWaiters.length > 0) {
      const waiter = this.flushWaiters.shift();
      waiter?.();
    }
  }

  /**
   * Parses JSONL file as ordered audit events.
   */
  private async readFileEvents(filePath: string): Promise<AuditEvent[]> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as AuditEvent)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ENOENT')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Normalizes dynamic ids for safe file names.
   */
  private safeFilePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}

