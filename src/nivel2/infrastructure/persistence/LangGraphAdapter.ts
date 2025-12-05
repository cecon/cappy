/**
 * @fileoverview LangGraph Integration - Persistence adapter for LangGraph StateGraph
 * @module persistence/LangGraphAdapter
 * 
 * Integrates our persistence layer with LangGraph's StateGraph system
 */

import type { AgentMessage } from './types';
import { MessageStateHandler } from './MessageStateHandler';
import { StateManager } from './StateManager';
import { CheckpointTracker } from './CheckpointTracker';
import { ContextManager } from './ContextManager';
import { FileContextTracker } from './FileContextTracker';

/**
 * LangGraph-compatible state annotation
 */
export interface LangGraphState {
  messages: AgentMessage[];
  metadata?: Record<string, unknown>;
  conversationHistoryDeletedRange?: [number, number];
  checkpointHash?: string;
}

/**
 * Checkpoint saver for LangGraph
 * Implements LangGraph's checkpoint protocol with our persistence layer
 */
export class LangGraphCheckpointSaver {
  private messageHandler: MessageStateHandler;
  private checkpointTracker?: CheckpointTracker;

  constructor(
    messageHandler: MessageStateHandler,
    checkpointTracker?: CheckpointTracker
  ) {
    this.messageHandler = messageHandler;
    this.checkpointTracker = checkpointTracker;
  }

  /**
   * Save checkpoint (called by LangGraph)
   */
  async saveCheckpoint(state: LangGraphState): Promise<string> {
    // Save messages
    await this.messageHandler.setMessages(state.messages);
    await this.messageHandler.saveMessages();
    
    // Create Git checkpoint if available
    if (this.checkpointTracker) {
      const hash = await this.checkpointTracker.commit();
      return hash;
    }
    
    return Date.now().toString();
  }

  /**
   * Load checkpoint (called by LangGraph)
   */
  async loadCheckpoint(checkpointId: string): Promise<LangGraphState | null> {
    // Restore from Git checkpoint if available
    if (this.checkpointTracker && checkpointId !== 'latest') {
      try {
        await this.checkpointTracker.restore(checkpointId);
      } catch (error) {
        console.error('[LangGraphCheckpointSaver] Failed to restore checkpoint:', error);
      }
    }
    
    // Load messages
    await this.messageHandler.loadMessages();
    const messages = this.messageHandler.getMessages();
    
    if (messages.length === 0) {
      return null;
    }
    
    const taskState = await this.messageHandler.getTaskState();
    
    return {
      messages,
      metadata: taskState.metadata,
      conversationHistoryDeletedRange: taskState.conversationHistoryDeletedRange,
      checkpointHash: checkpointId
    };
  }

  /**
   * List all checkpoints
   */
  async listCheckpoints(): Promise<string[]> {
    if (!this.checkpointTracker) {
      return [];
    }
    
    const checkpoints = await this.checkpointTracker.listCheckpoints();
    return checkpoints.map(c => c.hash);
  }
}

/**
 * LangGraph state reducer for messages
 * Implements LangGraph's annotation reducer protocol
 */
export function createMessageReducer() {
  return (left: AgentMessage[], right: AgentMessage | AgentMessage[]): AgentMessage[] => {
    const updates = Array.isArray(right) ? right : [right];
    return left.concat(updates);
  };
}

/**
 * Complete LangGraph persistence adapter
 * Provides all necessary components for LangGraph integration
 */
export class LangGraphPersistenceAdapter {
  private storagePath: string;
  private messageHandler?: MessageStateHandler;
  private stateManager?: StateManager;
  private checkpointTracker?: CheckpointTracker;
  private contextManager: ContextManager;
  private fileContextTracker?: FileContextTracker;
  private checkpointSaver?: LangGraphCheckpointSaver;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.contextManager = new ContextManager();
  }

  /**
   * Initialize for a specific task
   */
  async initializeForTask(
    taskId: string,
    ulid: string,
    workspacePath?: string
  ): Promise<{
    messageHandler: MessageStateHandler;
    checkpointSaver: LangGraphCheckpointSaver;
    contextManager: ContextManager;
    fileContextTracker: FileContextTracker;
  }> {
    // Initialize state manager if not already done
    if (!this.stateManager) {
      this.stateManager = new StateManager(this.storagePath);
      await this.stateManager.initialize();
    }

    // Create message handler
    this.messageHandler = new MessageStateHandler({
      taskId,
      ulid,
      storagePath: this.storagePath,
      updateTaskHistory: async (item) => {
        await this.stateManager!.updateTaskHistory(item);
      }
    });

    // Load existing messages
    await this.messageHandler.loadMessages();

    // Create checkpoint tracker if workspace path provided
    if (workspacePath) {
      this.checkpointTracker = new CheckpointTracker({
        workspacePath,
        checkpointsPath: `${this.storagePath}/checkpoints`,
        taskId
      });
      
      try {
        await this.checkpointTracker.initialize();
      } catch (error) {
        console.error('[LangGraphPersistenceAdapter] Checkpoint tracker initialization failed:', error);
        this.checkpointTracker = undefined;
      }
    }

    // Create checkpoint saver
    this.checkpointSaver = new LangGraphCheckpointSaver(
      this.messageHandler,
      this.checkpointTracker
    );

    // Create file context tracker
    this.fileContextTracker = new FileContextTracker(taskId, this.storagePath);
    await this.fileContextTracker.loadFileContext();

    // Load context manager history
    const taskDir = `${this.storagePath}/tasks/${taskId}`;
    await this.contextManager.loadContextHistory(taskDir);

    return {
      messageHandler: this.messageHandler,
      checkpointSaver: this.checkpointSaver,
      contextManager: this.contextManager,
      fileContextTracker: this.fileContextTracker
    };
  }

  /**
   * Get state manager instance
   */
  getStateManager(): StateManager {
    if (!this.stateManager) {
      throw new Error('[LangGraphPersistenceAdapter] Not initialized. Call initializeForTask() first.');
    }
    return this.stateManager;
  }

  /**
   * Cleanup and flush all pending saves
   */
  async dispose(): Promise<void> {
    await Promise.all([
      this.messageHandler?.dispose(),
      this.stateManager?.dispose(),
      this.checkpointTracker?.dispose()
    ]);
  }

  /**
   * Create a LangGraph-compatible state annotation
   */
  static createStateAnnotation() {
    return {
      messages: {
        reducer: createMessageReducer(),
        default: () => [] as AgentMessage[]
      },
      metadata: {
        reducer: (left: Record<string, unknown>, right: Record<string, unknown>) => ({
          ...left,
          ...right
        }),
        default: () => ({} as Record<string, unknown>)
      },
      conversationHistoryDeletedRange: {
        reducer: (_: any, right: [number, number] | undefined) => right,
        default: () => undefined as [number, number] | undefined
      },
      checkpointHash: {
        reducer: (_: any, right: string | undefined) => right,
        default: () => undefined as string | undefined
      }
    };
  }
}

/**
 * Export singleton factory
 */
let adapterInstance: LangGraphPersistenceAdapter | null = null;

export function getLangGraphAdapter(storagePath?: string): LangGraphPersistenceAdapter {
  if (!adapterInstance) {
    if (!storagePath) {
      throw new Error('[LangGraphPersistenceAdapter] storagePath required for first initialization');
    }
    adapterInstance = new LangGraphPersistenceAdapter(storagePath);
  }
  return adapterInstance;
}
