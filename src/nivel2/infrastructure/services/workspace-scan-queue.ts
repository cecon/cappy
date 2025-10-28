/**
 * @fileoverview Queue for processing workspace scan tasks
 * @module services/workspace-scan-queue
 * @author Cappy Team
 * @since 3.0.0
 */

/**
 * Queue configuration
 */
export interface WorkspaceScanQueueConfig {
  concurrency: number;
  batchSize: number;
}

/**
 * Task function type
 */
type TaskFunction = () => Promise<void>;

/**
 * Queue for processing workspace scan tasks with concurrency control
 */
export class WorkspaceScanQueue {
  private readonly config: WorkspaceScanQueueConfig;
  private readonly queue: TaskFunction[] = [];
  private running = 0;
  private resolveEmpty?: () => void;

  constructor(config: WorkspaceScanQueueConfig) {
    this.config = config;
  }

  /**
   * Enqueues a task
   */
  enqueue(task: TaskFunction): void {
    this.queue.push(task);
    this.process();
  }

  /**
   * Waits for queue to drain
   */
  async drain(): Promise<void> {
    if (this.queue.length === 0 && this.running === 0) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.resolveEmpty = resolve;
    });
  }

  /**
   * Processes queue with concurrency control
   */
  private async process(): Promise<void> {
    while (this.running < this.config.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.running++;
      
      task()
        .catch((error) => {
          console.error('Task error:', error);
        })
        .finally(() => {
          this.running--;
          this.process();
          
          // Check if queue is empty
          if (this.queue.length === 0 && this.running === 0 && this.resolveEmpty) {
            this.resolveEmpty();
            this.resolveEmpty = undefined;
          }
        });
    }
  }

  /**
   * Gets queue status
   */
  getStatus(): { pending: number; running: number } {
    return {
      pending: this.queue.length,
      running: this.running
    };
  }
}
