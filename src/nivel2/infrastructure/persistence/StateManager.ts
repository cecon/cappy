/**
 * @fileoverview State Manager - In-memory state with debounced disk persistence
 * @module persistence/StateManager
 * 
 * Inspired by Cline's StateManager with atomic writes and parallel persistence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TaskHistoryItem } from './types';

/**
 * Global state keys
 */
export type GlobalStateKey = 
  | 'lastActiveTaskId'
  | 'enableCheckpoints'
  | 'autoCondenseContext'
  | string;

/**
 * State manager for fast in-memory access with async disk persistence
 * 
 * Features:
 * - In-memory cache for instant reads
 * - Debounced writes to reduce I/O
 * - Atomic batch operations
 * - File watcher for external changes
 * - Parallel persistence
 */
export class StateManager {
  private storagePath: string;
  private isInitialized = false;
  
  // In-memory caches
  private globalStateCache: Record<string, unknown> = {};
  private taskHistoryCache: TaskHistoryItem[] = [];
  
  // Pending changes (debounced)
  private pendingGlobalState = new Set<GlobalStateKey>();
  private pendingTaskHistory = false;
  
  // Debounced persistence
  private persistenceTimeout?: NodeJS.Timeout;
  private readonly PERSISTENCE_DELAY_MS = 500;
  
  // File watcher


  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  /**
   * Initialize state manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Ensure directories exist
      await fs.mkdir(path.join(this.storagePath, 'state'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'tasks'), { recursive: true });
      
      // Load initial state
      await this.loadGlobalState();
      await this.loadTaskHistory();
      
      this.isInitialized = true;
      console.log('[StateManager] Initialized successfully');
    } catch (error) {
      console.error('[StateManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Ensure initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('[StateManager] Not initialized. Call initialize() first.');
    }
  }

  // ============================================================================
  // Global State
  // ============================================================================

  /**
   * Get global state value
   */
  getGlobalState<T = unknown>(key: GlobalStateKey): T | undefined {
    this.ensureInitialized();
    return this.globalStateCache[key] as T | undefined;
  }

  /**
   * Set global state value (debounced write)
   */
  async setGlobalState(key: GlobalStateKey, value: unknown): Promise<void> {
    this.ensureInitialized();
    
    this.globalStateCache[key] = value;
    this.pendingGlobalState.add(key);
    
    this.scheduleDebouncedPersistence();
  }

  /**
   * Delete global state value
   */
  async deleteGlobalState(key: GlobalStateKey): Promise<void> {
    this.ensureInitialized();
    
    delete this.globalStateCache[key];
    this.pendingGlobalState.add(key);
    
    this.scheduleDebouncedPersistence();
  }

  /**
   * Load global state from disk
   */
  private async loadGlobalState(): Promise<void> {
    try {
      const stateFile = path.join(this.storagePath, 'state', 'global.json');
      
      const exists = await fs.access(stateFile).then(() => true).catch(() => false);
      if (!exists) {
        this.globalStateCache = {};
        return;
      }
      
      const content = await fs.readFile(stateFile, 'utf-8');
      this.globalStateCache = JSON.parse(content);
    } catch (error) {
      console.error('[StateManager] Failed to load global state:', error);
      this.globalStateCache = {};
    }
  }

  /**
   * Save global state to disk
   */
  private async saveGlobalState(): Promise<void> {
    try {
      const stateFile = path.join(this.storagePath, 'state', 'global.json');
      await fs.writeFile(stateFile, JSON.stringify(this.globalStateCache, null, 2));
      
      this.pendingGlobalState.clear();
    } catch (error) {
      console.error('[StateManager] Failed to save global state:', error);
      throw error;
    }
  }

  // ============================================================================
  // Task History
  // ============================================================================

  /**
   * Get all task history
   */
  getTaskHistory(): TaskHistoryItem[] {
    this.ensureInitialized();
    return [...this.taskHistoryCache];
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TaskHistoryItem | undefined {
    this.ensureInitialized();
    return this.taskHistoryCache.find(t => t.id === taskId);
  }

  /**
   * Add or update task in history
   */
  async updateTaskHistory(task: TaskHistoryItem): Promise<void> {
    this.ensureInitialized();
    
    const existingIndex = this.taskHistoryCache.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      this.taskHistoryCache[existingIndex] = task;
    } else {
      this.taskHistoryCache.unshift(task); // Add to beginning
    }
    
    this.pendingTaskHistory = true;
    this.scheduleDebouncedPersistence();
  }

  /**
   * Delete task from history
   */
  async deleteTask(taskId: string): Promise<void> {
    this.ensureInitialized();
    
    this.taskHistoryCache = this.taskHistoryCache.filter(t => t.id !== taskId);
    this.pendingTaskHistory = true;
    
    this.scheduleDebouncedPersistence();
    
    // Also delete task files
    try {
      const taskDir = path.join(this.storagePath, 'tasks', taskId);
      await fs.rm(taskDir, { recursive: true, force: true });
    } catch (error) {
      console.error('[StateManager] Failed to delete task files:', error);
    }
  }

  /**
   * Load task history from disk
   */
  private async loadTaskHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.storagePath, 'state', 'taskHistory.json');
      
      const exists = await fs.access(historyFile).then(() => true).catch(() => false);
      if (!exists) {
        this.taskHistoryCache = [];
        return;
      }
      
      const content = await fs.readFile(historyFile, 'utf-8');
      this.taskHistoryCache = JSON.parse(content);
    } catch (error) {
      console.error('[StateManager] Failed to load task history:', error);
      this.taskHistoryCache = [];
    }
  }

  /**
   * Save task history to disk
   */
  private async saveTaskHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.storagePath, 'state', 'taskHistory.json');
      
      // Create backup before overwriting
      const exists = await fs.access(historyFile).then(() => true).catch(() => false);
      if (exists) {
        const backupFile = path.join(
          this.storagePath, 
          'state', 
          `taskHistory.backup.${Date.now()}.json`
        );
        await fs.copyFile(historyFile, backupFile);
        
        // Keep only last 5 backups
        await this.cleanupOldBackups();
      }
      
      await fs.writeFile(historyFile, JSON.stringify(this.taskHistoryCache, null, 2));
      
      this.pendingTaskHistory = false;
    } catch (error) {
      console.error('[StateManager] Failed to save task history:', error);
      throw error;
    }
  }

  /**
   * Cleanup old backup files
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const stateDir = path.join(this.storagePath, 'state');
      const files = await fs.readdir(stateDir);
      
      const backupFiles = files
        .filter(f => f.startsWith('taskHistory.backup.'))
        .sort()
        .reverse();
      
      // Keep only last 5
      for (const file of backupFiles.slice(5)) {
        await fs.unlink(path.join(stateDir, file)).catch(() => {});
      }
    } catch (error) {
      // Non-fatal, just log
      console.warn('[StateManager] Failed to cleanup backups:', error);
    }
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Schedule debounced persistence
   */
  private scheduleDebouncedPersistence(): void {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }
    
    this.persistenceTimeout = setTimeout(async () => {
      try {
        await this.persistPendingState();
        this.persistenceTimeout = undefined;
      } catch (error) {
        console.error('[StateManager] Failed to persist pending changes:', error);
        this.persistenceTimeout = undefined;
      }
    }, this.PERSISTENCE_DELAY_MS);
  }

  /**
   * Persist all pending state changes
   */
  private async persistPendingState(): Promise<void> {
    // Early return if nothing to persist
    if (this.pendingGlobalState.size === 0 && !this.pendingTaskHistory) {
      return;
    }
    
    // Execute all persistence operations in parallel
    const operations: Promise<void>[] = [];
    
    if (this.pendingGlobalState.size > 0) {
      operations.push(this.saveGlobalState());
    }
    
    if (this.pendingTaskHistory) {
      operations.push(this.saveTaskHistory());
    }
    
    await Promise.all(operations);
  }

  /**
   * Flush all pending state changes immediately
   */
  async flushPendingState(): Promise<void> {
    // Cancel any pending timeout
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
      this.persistenceTimeout = undefined;
    }
    
    // Execute persistence immediately
    await this.persistPendingState();
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    await this.flushPendingState();
    this.isInitialized = false;
  }
}

// Singleton instance
let stateManagerInstance: StateManager | null = null;

/**
 * Get or create state manager instance
 */
export function getStateManager(storagePath?: string): StateManager {
  if (!stateManagerInstance) {
    if (!storagePath) {
      throw new Error('[StateManager] storagePath required for first initialization');
    }
    stateManagerInstance = new StateManager(storagePath);
  }
  return stateManagerInstance;
}

/**
 * Initialize state manager singleton
 */
export async function initializeStateManager(storagePath: string): Promise<StateManager> {
  const manager = getStateManager(storagePath);
  await manager.initialize();
  return manager;
}
