import type { GraphStorePort } from '../../../domains/dashboard/ports/indexing-port';

export interface CleanupOptions {
  /**
   * Interval in milliseconds between cleanup runs (default: 1 hour)
   */
  intervalMs?: number;
  
  /**
   * Delete temporary files older than this many milliseconds (default: 24 hours)
   */
  maxAgeMs?: number;
  
  /**
   * Patterns to match temporary file paths
   */
  tempPathPatterns?: string[];
  
  /**
   * Enable/disable automatic cleanup
   */
  enabled?: boolean;
}

/**
 * Service for automatic cleanup of temporary/stale graph data
 */
export class GraphCleanupService {
  private readonly graphStore: GraphStorePort;
  private readonly options: CleanupOptions;
  private intervalHandle?: NodeJS.Timeout;
  private isRunning = false;
  
  constructor(graphStore: GraphStorePort, options: CleanupOptions = {}) {
    this.graphStore = graphStore;
    this.options = {
      intervalMs: options.intervalMs ?? 60 * 60 * 1000, // 1 hour
      maxAgeMs: options.maxAgeMs ?? 24 * 60 * 60 * 1000, // 24 hours
      tempPathPatterns: options.tempPathPatterns ?? [
        '/var/folders/%',
        '/tmp/%',
        '%/cappy-parse-%'
      ],
      enabled: options.enabled ?? true
    };
  }

  /**
   * Start the automatic cleanup service
   */
  start(): void {
    if (this.isRunning) {
      console.log('[GraphCleanupService] ⚠️ Already running');
      return;
    }

    if (!this.options.enabled) {
      console.log('[GraphCleanupService] ⏸️ Cleanup service is disabled');
      return;
    }

    console.log(`[GraphCleanupService] ▶️ Starting cleanup service (interval: ${this.options.intervalMs}ms)`);
    
    // Run immediately on start
    this.runCleanup().catch(err => {
      console.error('[GraphCleanupService] ❌ Initial cleanup failed:', err);
    });

    // Schedule periodic cleanup
    this.intervalHandle = setInterval(() => {
      this.runCleanup().catch(err => {
        console.error('[GraphCleanupService] ❌ Scheduled cleanup failed:', err);
      });
    }, this.options.intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the automatic cleanup service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[GraphCleanupService] ⏹️ Stopping cleanup service');
    
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    this.isRunning = false;
  }

  /**
   * Run cleanup manually
   */
  async runCleanup(): Promise<void> {
    console.log('[GraphCleanupService] 🧹 Starting cleanup...');
    const startTime = Date.now();

    try {
      let totalNodesDeleted = 0;
      let totalEdgesDeleted = 0;
      let totalVectorsDeleted = 0;

      // Cast to access SQLite-specific methods
      const store = this.graphStore as GraphStorePort & {
        db?: {
          prepare: (sql: string) => { run: (...params: unknown[]) => { changes: number } };
        };
      };

      if (!store.db) {
        console.warn('[GraphCleanupService] ⚠️ No database connection available');
        return;
      }

      // Clean each pattern
      for (const pattern of this.options.tempPathPatterns || []) {
        console.log(`[GraphCleanupService] 🗑️ Cleaning pattern: ${pattern}`);
        
        // Delete edges first (foreign keys)
        const edgesStmt = store.db.prepare(`
          DELETE FROM edges 
          WHERE from_id IN (SELECT id FROM nodes WHERE file_path LIKE ?) 
             OR to_id IN (SELECT id FROM nodes WHERE file_path LIKE ?)
        `);
        const edgesResult = edgesStmt.run(pattern, pattern);
        totalEdgesDeleted += edgesResult.changes;

        // Delete vectors
        const vectorsStmt = store.db.prepare(`
          DELETE FROM vectors 
          WHERE chunk_id IN (SELECT id FROM nodes WHERE file_path LIKE ?)
        `);
        const vectorsResult = vectorsStmt.run(pattern);
        totalVectorsDeleted += vectorsResult.changes;

        // Delete nodes
        const nodesStmt = store.db.prepare(`
          DELETE FROM nodes WHERE file_path LIKE ?
        `);
        const nodesResult = nodesStmt.run(pattern);
        totalNodesDeleted += nodesResult.changes;
      }

      const duration = Date.now() - startTime;
      
      if (totalNodesDeleted > 0 || totalEdgesDeleted > 0 || totalVectorsDeleted > 0) {
        console.log('[GraphCleanupService] ✅ Cleanup completed:');
        console.log(`  - Nodes deleted: ${totalNodesDeleted}`);
        console.log(`  - Edges deleted: ${totalEdgesDeleted}`);
        console.log(`  - Vectors deleted: ${totalVectorsDeleted}`);
        console.log(`  - Duration: ${duration}ms`);
      } else {
        console.log(`[GraphCleanupService] ✨ Nothing to clean (${duration}ms)`);
      }
    } catch (error) {
      console.error('[GraphCleanupService] ❌ Cleanup error:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; intervalMs: number; enabled: boolean } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.options.intervalMs || 0,
      enabled: this.options.enabled || false
    };
  }
}
