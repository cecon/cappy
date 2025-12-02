/**
 * @fileoverview File Context Tracker - Tracks files read/written during tasks
 * @module persistence/FileContextTracker
 * 
 * Inspired by Cline's FileContextTracker for workspace monitoring
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File operation type
 */
export type FileOperation = 'read' | 'write' | 'create' | 'delete';

/**
 * File context entry
 */
export interface FileContextEntry {
  filePath: string;
  operation: FileOperation;
  timestamp: number;
  content?: string; // For reads/writes
  previousContent?: string; // For writes (to enable rollback)
}

/**
 * Tracks files accessed during task execution
 * 
 * Features:
 * - Track all file operations
 * - Maintain operation history
 * - Content snapshots for rollback
 * - Disk persistence
 * - File change detection
 */
export class FileContextTracker {
  private taskId: string;
  private storagePath: string;
  private fileOperations: FileContextEntry[] = [];
  private trackedFiles = new Set<string>();

  constructor(taskId: string, storagePath: string) {
    this.taskId = taskId;
    this.storagePath = storagePath;
  }

  /**
   * Track a file read operation
   */
  async trackFileRead(filePath: string, content?: string): Promise<void> {
    const entry: FileContextEntry = {
      filePath: this.normalizePath(filePath),
      operation: 'read',
      timestamp: Date.now(),
      content
    };

    this.fileOperations.push(entry);
    this.trackedFiles.add(entry.filePath);
    
    await this.saveFileContext();
  }

  /**
   * Track a file write operation
   */
  async trackFileWrite(
    filePath: string, 
    content?: string, 
    previousContent?: string
  ): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    
    const entry: FileContextEntry = {
      filePath: normalizedPath,
      operation: 'write',
      timestamp: Date.now(),
      content,
      previousContent
    };

    this.fileOperations.push(entry);
    this.trackedFiles.add(normalizedPath);
    
    await this.saveFileContext();
  }

  /**
   * Track a file creation
   */
  async trackFileCreate(filePath: string, content?: string): Promise<void> {
    const entry: FileContextEntry = {
      filePath: this.normalizePath(filePath),
      operation: 'create',
      timestamp: Date.now(),
      content
    };

    this.fileOperations.push(entry);
    this.trackedFiles.add(entry.filePath);
    
    await this.saveFileContext();
  }

  /**
   * Track a file deletion
   */
  async trackFileDelete(filePath: string, previousContent?: string): Promise<void> {
    const entry: FileContextEntry = {
      filePath: this.normalizePath(filePath),
      operation: 'delete',
      timestamp: Date.now(),
      previousContent
    };

    this.fileOperations.push(entry);
    
    await this.saveFileContext();
  }

  /**
   * Get all operations for a specific file
   */
  getFileOperations(filePath: string): FileContextEntry[] {
    const normalizedPath = this.normalizePath(filePath);
    return this.fileOperations.filter(op => op.filePath === normalizedPath);
  }

  /**
   * Get all tracked files
   */
  getTrackedFiles(): string[] {
    return Array.from(this.trackedFiles);
  }

  /**
   * Get all operations
   */
  getAllOperations(): FileContextEntry[] {
    return [...this.fileOperations];
  }

  /**
   * Get operations by type
   */
  getOperationsByType(operation: FileOperation): FileContextEntry[] {
    return this.fileOperations.filter(op => op.operation === operation);
  }

  /**
   * Get operations after timestamp
   */
  getOperationsAfterTimestamp(timestamp: number): FileContextEntry[] {
    return this.fileOperations.filter(op => op.timestamp > timestamp);
  }

  /**
   * Truncate operations to a specific timestamp
   */
  async truncateToTimestamp(timestamp: number): Promise<void> {
    this.fileOperations = this.fileOperations.filter(op => op.timestamp <= timestamp);
    
    // Rebuild tracked files set
    this.trackedFiles.clear();
    for (const op of this.fileOperations) {
      if (op.operation !== 'delete') {
        this.trackedFiles.add(op.filePath);
      }
    }
    
    await this.saveFileContext();
  }

  /**
   * Get file statistics
   */
  getStats(): {
    totalOperations: number;
    uniqueFiles: number;
    reads: number;
    writes: number;
    creates: number;
    deletes: number;
  } {
    return {
      totalOperations: this.fileOperations.length,
      uniqueFiles: this.trackedFiles.size,
      reads: this.getOperationsByType('read').length,
      writes: this.getOperationsByType('write').length,
      creates: this.getOperationsByType('create').length,
      deletes: this.getOperationsByType('delete').length
    };
  }

  /**
   * Get last operation for each file
   */
  getLatestFileStates(): Map<string, FileContextEntry> {
    const latest = new Map<string, FileContextEntry>();
    
    for (const op of this.fileOperations) {
      const existing = latest.get(op.filePath);
      if (!existing || op.timestamp > existing.timestamp) {
        latest.set(op.filePath, op);
      }
    }
    
    return latest;
  }

  /**
   * Check if file was modified
   */
  wasFileModified(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    const ops = this.getFileOperations(normalizedPath);
    return ops.some(op => op.operation === 'write' || op.operation === 'create');
  }

  /**
   * Save file context to disk
   */
  private async saveFileContext(): Promise<void> {
    try {
      const taskDir = path.join(this.storagePath, 'tasks', this.taskId);
      await fs.mkdir(taskDir, { recursive: true });
      
      const contextFile = path.join(taskDir, 'file_context.json');
      
      const data = {
        operations: this.fileOperations,
        trackedFiles: Array.from(this.trackedFiles)
      };
      
      await fs.writeFile(contextFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[FileContextTracker] Failed to save file context:', error);
    }
  }

  /**
   * Load file context from disk
   */
  async loadFileContext(): Promise<void> {
    try {
      const taskDir = path.join(this.storagePath, 'tasks', this.taskId);
      const contextFile = path.join(taskDir, 'file_context.json');
      
      const exists = await fs.access(contextFile).then(() => true).catch(() => false);
      if (!exists) {
        this.fileOperations = [];
        this.trackedFiles.clear();
        return;
      }
      
      const content = await fs.readFile(contextFile, 'utf-8');
      const data = JSON.parse(content);
      
      this.fileOperations = data.operations || [];
      this.trackedFiles = new Set(data.trackedFiles || []);
    } catch (error) {
      console.error('[FileContextTracker] Failed to load file context:', error);
      this.fileOperations = [];
      this.trackedFiles.clear();
    }
  }

  /**
   * Normalize file path
   */
  private normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.fileOperations = [];
    this.trackedFiles.clear();
  }

  /**
   * Export file context for checkpoint
   */
  exportContext(): {
    operations: FileContextEntry[];
    trackedFiles: string[];
  } {
    return {
      operations: [...this.fileOperations],
      trackedFiles: Array.from(this.trackedFiles)
    };
  }

  /**
   * Import file context from checkpoint
   */
  importContext(context: {
    operations: FileContextEntry[];
    trackedFiles: string[];
  }): void {
    this.fileOperations = [...context.operations];
    this.trackedFiles = new Set(context.trackedFiles);
  }
}
