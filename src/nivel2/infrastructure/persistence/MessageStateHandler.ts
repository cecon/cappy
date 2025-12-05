/**
 * @fileoverview Message State Handler - Manages message state with atomic persistence
 * @module persistence/MessageStateHandler
 * 
 * Inspired by Cline's MessageStateHandler with mutex protection and atomic operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentMessage, TaskHistoryItem, TaskState } from './types';

/**
 * Mutex implementation for atomic operations
 */
class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    while (this.locked) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = false;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

interface MessageStateHandlerParams {
  taskId: string;
  ulid: string;
  storagePath: string;
  updateTaskHistory?: (item: TaskHistoryItem) => Promise<void>;
}

/**
 * Handles message state with atomic persistence and mutex protection
 * 
 * Features:
 * - Mutex protection against race conditions
 * - Atomic save operations
 * - Debounced disk writes
 * - Conversation history tracking
 * - LangGraph compatible state format
 */
export class MessageStateHandler {
  private messages: AgentMessage[] = [];
  private taskId: string;
  private ulid: string;
  private storagePath: string;
  private updateTaskHistory?: (item: TaskHistoryItem) => Promise<void>;
  
  // Mutex to prevent concurrent state modifications
  private stateMutex = new Mutex();
  
  // Debounced persistence
  private persistenceTimeout?: NodeJS.Timeout;
  private readonly PERSISTENCE_DELAY_MS = 500;
  private pendingSave = false;

  constructor(params: MessageStateHandlerParams) {
    this.taskId = params.taskId;
    this.ulid = params.ulid;
    this.storagePath = params.storagePath;
    this.updateTaskHistory = params.updateTaskHistory;
  }

  /**
   * Execute function with exclusive lock on message state
   */
  private async withStateLock<T>(fn: () => T | Promise<T>): Promise<T> {
    return await this.stateMutex.withLock(fn);
  }

  /**
   * Get messages (read-only)
   */
  getMessages(): AgentMessage[] {
    return [...this.messages];
  }

  /**
   * Set messages directly (protected by mutex)
   */
  async setMessages(newMessages: AgentMessage[]): Promise<void> {
    await this.withStateLock(async () => {
      this.messages = [...newMessages];
      this.scheduleDebouncedPersistence();
    });
  }

  /**
   * Add a new message (atomic operation)
   */
  async addMessage(message: AgentMessage): Promise<void> {
    await this.withStateLock(async () => {
      // Set conversation history index
      message.conversationHistoryIndex = this.messages.length;
      
      this.messages.push(message);
      await this.saveMessagesInternal();
    });
  }

  /**
   * Update a specific message (atomic operation)
   */
  async updateMessage(index: number, updates: Partial<AgentMessage>): Promise<void> {
    await this.withStateLock(async () => {
      if (index < 0 || index >= this.messages.length) {
        throw new Error(`Invalid message index: ${index}`);
      }
      
      this.messages[index] = {
        ...this.messages[index],
        ...updates
      };
      
      await this.saveMessagesInternal();
    });
  }

  /**
   * Overwrite entire message history (atomic operation)
   */
  async overwriteMessages(newMessages: AgentMessage[]): Promise<void> {
    await this.withStateLock(async () => {
      this.messages = [...newMessages];
      await this.saveMessagesInternal();
    });
  }

  /**
   * Load messages from disk
   */
  async loadMessages(): Promise<void> {
    await this.withStateLock(async () => {
      try {
        const taskDir = this.getTaskDirectory();
        const messagesFile = path.join(taskDir, 'messages.json');
        
        const exists = await fs.access(messagesFile).then(() => true).catch(() => false);
        if (!exists) {
          this.messages = [];
          return;
        }
        
        const content = await fs.readFile(messagesFile, 'utf-8');
        const loaded = JSON.parse(content) as AgentMessage[];
        
        // Convert timestamp strings back to Date objects
        this.messages = loaded.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } catch (error) {
        console.error('[MessageStateHandler] Failed to load messages:', error);
        this.messages = [];
      }
    });
  }

  /**
   * Save messages to disk (internal, must be called within lock)
   */
  private async saveMessagesInternal(): Promise<void> {
    try {
      const taskDir = this.getTaskDirectory();
      await fs.mkdir(taskDir, { recursive: true });
      
      const messagesFile = path.join(taskDir, 'messages.json');
      await fs.writeFile(messagesFile, JSON.stringify(this.messages, null, 2));
      
      // Update task history if callback provided
      if (this.updateTaskHistory) {
        await this.updateTaskHistoryInternal();
      }
    } catch (error) {
      console.error('[MessageStateHandler] Failed to save messages:', error);
      throw error;
    }
  }

  /**
   * Save messages to disk (public API with mutex protection)
   */
  async saveMessages(): Promise<void> {
    await this.withStateLock(async () => {
      await this.saveMessagesInternal();
    });
  }

  /**
   * Update task history (internal)
   */
  private async updateTaskHistoryInternal(): Promise<void> {
    if (!this.updateTaskHistory) return;
    
    const lastMessage = this.messages[this.messages.length - 1];
    if (!lastMessage) return;
    
    // Calculate metrics (simplified - enhance as needed)
    const totalTokens = this.messages.reduce((sum, msg) => {
      return sum + Math.ceil(msg.content.length / 4); // Rough estimate
    }, 0);
    
    const historyItem: TaskHistoryItem = {
      id: this.taskId,
      ulid: this.ulid,
      ts: lastMessage.timestamp.getTime(),
      task: this.messages[0]?.content || '',
      tokensIn: Math.floor(totalTokens / 2),
      tokensOut: Math.ceil(totalTokens / 2),
      totalCost: 0, // Calculate based on model
      isFavorited: false
    };
    
    await this.updateTaskHistory(historyItem);
  }

  /**
   * Schedule debounced persistence
   */
  private scheduleDebouncedPersistence(): void {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }
    
    this.pendingSave = true;
    
    this.persistenceTimeout = setTimeout(async () => {
      if (this.pendingSave) {
        await this.saveMessages();
        this.pendingSave = false;
      }
      this.persistenceTimeout = undefined;
    }, this.PERSISTENCE_DELAY_MS);
  }

  /**
   * Flush pending saves immediately
   */
  async flushPendingSaves(): Promise<void> {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
      this.persistenceTimeout = undefined;
    }
    
    if (this.pendingSave) {
      await this.saveMessages();
      this.pendingSave = false;
    }
  }

  /**
   * Get task directory path
   */
  private getTaskDirectory(): string {
    return path.join(this.storagePath, 'tasks', this.taskId);
  }

  /**
   * Get full task state
   */
  async getTaskState(): Promise<TaskState> {
    return {
      taskId: this.taskId,
      ulid: this.ulid,
      messages: this.getMessages(),
      metadata: {}
    };
  }

  /**
   * Save full task state to disk
   */
  async saveTaskState(state: Partial<TaskState>): Promise<void> {
    await this.withStateLock(async () => {
      try {
        const taskDir = this.getTaskDirectory();
        await fs.mkdir(taskDir, { recursive: true });
        
        const currentState = await this.getTaskState();
        const newState: TaskState = {
          ...currentState,
          ...state
        };
        
        const stateFile = path.join(taskDir, 'state.json');
        await fs.writeFile(stateFile, JSON.stringify(newState, null, 2));
      } catch (error) {
        console.error('[MessageStateHandler] Failed to save task state:', error);
        throw error;
      }
    });
  }

  /**
   * Load task state from disk
   */
  async loadTaskState(): Promise<TaskState | null> {
    try {
      const taskDir = this.getTaskDirectory();
      const stateFile = path.join(taskDir, 'state.json');
      
      const exists = await fs.access(stateFile).then(() => true).catch(() => false);
      if (!exists) {
        return null;
      }
      
      const content = await fs.readFile(stateFile, 'utf-8');
      return JSON.parse(content) as TaskState;
    } catch (error) {
      console.error('[MessageStateHandler] Failed to load task state:', error);
      return null;
    }
  }

  /**
   * Cleanup and dispose
   */
  async dispose(): Promise<void> {
    await this.flushPendingSaves();
  }
}
