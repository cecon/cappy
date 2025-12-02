/**
 * @fileoverview Context Manager - Temporal tracking of context updates
 * @module persistence/ContextManager
 * 
 * Inspired by Cline's ContextManager with timestamp-based truncation
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Context update types
 */
export type ContextUpdateType = 'text' | 'truncation' | 'optimization';

/**
 * Context update entry
 */
export interface ContextUpdate {
  timestamp: number;
  updateType: ContextUpdateType;
  data: unknown;
}

/**
 * Edit type for message modifications
 */
export enum EditType {
  User = 0,
  Assistant = 1
}

/**
 * Manages context history with temporal tracking
 * 
 * Features:
 * - Timestamp-based update tracking
 * - Truncation support for checkpoints
 * - Binary search for efficient lookups
 * - Nested index structure for performance
 * - Disk persistence
 */
export class ContextManager {
  // Mapping: outerIndex => [EditType, { innerIndex => [ContextUpdate[]] }]
  private contextHistoryUpdates: Map<number, [number, Map<number, ContextUpdate[]>]> = new Map();
  
  private taskDirectory?: string;

  constructor() {}

  /**
   * Add a context update
   */
  addContextUpdate(
    outerIndex: number,
    innerIndex: number,
    editType: EditType,
    updateType: ContextUpdateType,
    data: unknown
  ): void {
    const timestamp = Date.now();
    
    const update: ContextUpdate = {
      timestamp,
      updateType,
      data
    };

    // Get or create outer entry
    let outerEntry = this.contextHistoryUpdates.get(outerIndex);
    if (!outerEntry) {
      outerEntry = [editType, new Map()];
      this.contextHistoryUpdates.set(outerIndex, outerEntry);
    }

    // Get or create inner entry
    const innerMap = outerEntry[1];
    let updates = innerMap.get(innerIndex);
    if (!updates) {
      updates = [];
      innerMap.set(innerIndex, updates);
    }

    // Add update (maintains chronological order)
    updates.push(update);
  }

  /**
   * Get all updates for a specific message
   */
  getUpdatesForMessage(outerIndex: number, innerIndex: number): ContextUpdate[] {
    const outerEntry = this.contextHistoryUpdates.get(outerIndex);
    if (!outerEntry) {
      return [];
    }

    const innerMap = outerEntry[1];
    return innerMap.get(innerIndex) || [];
  }

  /**
   * Truncate context history to a specific timestamp
   * Removes all updates after the given timestamp
   */
  async truncateContextHistory(timestamp: number, taskDirectory: string): Promise<void> {
    this.taskDirectory = taskDirectory;
    
    // Iterate through all outer indices
    for (const [outerIndex, [editType, innerMap]] of this.contextHistoryUpdates) {
      // Iterate through all inner indices
      for (const [innerIndex, updates] of innerMap) {
        // Binary search to find cutoff point
        const cutoffIdx = this.findCutoffIndex(updates, timestamp);
        
        if (cutoffIdx < updates.length) {
          // Remove updates after timestamp
          updates.splice(cutoffIdx);
        }

        // Remove inner index if no updates remain
        if (updates.length === 0) {
          innerMap.delete(innerIndex);
        }
      }

      // Remove outer index if no inner entries remain
      if (innerMap.size === 0) {
        this.contextHistoryUpdates.delete(outerIndex);
      }
    }

    // Save truncated history
    await this.saveContextHistory(taskDirectory);
  }

  /**
   * Binary search to find cutoff index for truncation
   */
  private findCutoffIndex(updates: ContextUpdate[], timestamp: number): number {
    let left = 0;
    let right = updates.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      
      if (updates[mid].timestamp <= timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  /**
   * Apply context optimizations (placeholder for future enhancements)
   */
  applyContextOptimizations(
    apiMessages: any[],
    startFromIndex: number,
    timestamp: number
  ): [boolean, Set<number>] {
    const modifiedIndices = new Set<number>();
    let anyChanges = false;

    // Apply tracked updates to messages
    for (const [outerIndex, [editType, innerMap]] of this.contextHistoryUpdates) {
      if (outerIndex < startFromIndex) continue;

      for (const [innerIndex, updates] of innerMap) {
        // Apply only updates up to timestamp
        const relevantUpdates = updates.filter(u => u.timestamp <= timestamp);
        
        if (relevantUpdates.length > 0) {
          modifiedIndices.add(outerIndex);
          anyChanges = true;
        }
      }
    }

    return [anyChanges, modifiedIndices];
  }

  /**
   * Save context history to disk
   */
  async saveContextHistory(taskDirectory: string): Promise<void> {
    try {
      this.taskDirectory = taskDirectory;
      
      // Convert Map to serializable format
      const serialized: Record<string, [number, Record<string, ContextUpdate[]>]> = {};
      
      for (const [outerIndex, [editType, innerMap]] of this.contextHistoryUpdates) {
        const innerObj: Record<string, ContextUpdate[]> = {};
        
        for (const [innerIndex, updates] of innerMap) {
          innerObj[innerIndex.toString()] = updates;
        }
        
        serialized[outerIndex.toString()] = [editType, innerObj];
      }

      const contextFile = path.join(taskDirectory, 'context_history.json');
      await fs.writeFile(contextFile, JSON.stringify(serialized, null, 2));
    } catch (error) {
      console.error('[ContextManager] Failed to save context history:', error);
      throw error;
    }
  }

  /**
   * Load context history from disk
   */
  async loadContextHistory(taskDirectory: string): Promise<void> {
    try {
      this.taskDirectory = taskDirectory;
      
      const contextFile = path.join(taskDirectory, 'context_history.json');
      
      const exists = await fs.access(contextFile).then(() => true).catch(() => false);
      if (!exists) {
        this.contextHistoryUpdates.clear();
        return;
      }

      const content = await fs.readFile(contextFile, 'utf-8');
      const serialized = JSON.parse(content);

      // Convert back to Map structure
      this.contextHistoryUpdates.clear();
      
      for (const [outerIndexStr, entry] of Object.entries(serialized)) {
        const [editType, innerObj] = entry as [EditType, Record<string, ContextUpdate[]>];
        const outerIndex = parseInt(outerIndexStr);
        const innerMap = new Map<number, ContextUpdate[]>();
        
        for (const [innerIndexStr, updates] of Object.entries(innerObj as Record<string, ContextUpdate[]>)) {
          const innerIndex = parseInt(innerIndexStr);
          innerMap.set(innerIndex, updates);
        }
        
        this.contextHistoryUpdates.set(outerIndex, [editType as number, innerMap]);
      }
    } catch (error) {
      console.error('[ContextManager] Failed to load context history:', error);
      this.contextHistoryUpdates.clear();
    }
  }

  /**
   * Clear all context history
   */
  clear(): void {
    this.contextHistoryUpdates.clear();
  }

  /**
   * Get statistics about context updates
   */
  getStats(): {
    totalUpdates: number;
    messageCount: number;
    oldestTimestamp?: number;
    newestTimestamp?: number;
  } {
    let totalUpdates = 0;
    let messageCount = 0;
    let oldestTimestamp: number | undefined;
    let newestTimestamp: number | undefined;

    for (const [_, [__, innerMap]] of this.contextHistoryUpdates) {
      messageCount += innerMap.size;
      
      for (const [___, updates] of innerMap) {
        totalUpdates += updates.length;
        
        for (const update of updates) {
          if (!oldestTimestamp || update.timestamp < oldestTimestamp) {
            oldestTimestamp = update.timestamp;
          }
          if (!newestTimestamp || update.timestamp > newestTimestamp) {
            newestTimestamp = update.timestamp;
          }
        }
      }
    }

    return {
      totalUpdates,
      messageCount,
      oldestTimestamp,
      newestTimestamp
    };
  }
}
