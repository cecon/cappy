/**
 * @fileoverview Progress and streaming system for enhanced UX
 * @module codeact/core/progress
 */

import * as vscode from 'vscode'

/**
 * Progress event types
 */
export type ProgressEventType =
  | 'start'
  | 'progress'
  | 'complete'
  | 'error'
  | 'warning'
  | 'info'

/**
 * Progress event data
 */
export interface ProgressEvent {
  type: ProgressEventType
  message: string
  percentage?: number
  data?: unknown
  timestamp: number
}

/**
 * Progress listener callback
 */
export type ProgressListener = (event: ProgressEvent) => void

/**
 * Progress manager for streaming updates and status reporting
 */
export class ProgressManager {
  private listeners = new Set<ProgressListener>()
  private progressItems = new Map<string, vscode.Progress<{ message?: string; increment?: number }>>()
  private statusBarItems = new Map<string, vscode.StatusBarItem>()

  /**
   * Subscribe to progress events
   */
  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Emit a progress event
   */
  emit(event: Omit<ProgressEvent, 'timestamp'>): void {
    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: Date.now()
    }

    // Notify all listeners
    for (const listener of this.listeners) {
      try {
        listener(fullEvent)
      } catch (error) {
        console.error('Progress listener error:', error)
      }
    }
  }

  /**
   * Start a progress operation with VS Code UI
   */
  async startProgress(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<void>
  ): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true
      },
      async (progress) => {
        // Store progress instance for updates
        const progressId = `progress_${Date.now()}_${Math.random()}`
        this.progressItems.set(progressId, progress)

        try {
          this.emit({ type: 'start', message: title })

          await task(progress)

          this.emit({ type: 'complete', message: `${title} completed` })
        } catch (error) {
          this.emit({
            type: 'error',
            message: `${title} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
          throw error
        } finally {
          this.progressItems.delete(progressId)
        }
      }
    )
  }

  /**
   * Show status bar item with progress
   */
  showStatusProgress(text: string, icon: string = 'sync~spin'): vscode.StatusBarItem {
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
    statusItem.text = `$(${icon}) ${text}`
    statusItem.show()

    const statusId = `status_${Date.now()}_${Math.random()}`
    this.statusBarItems.set(statusId, statusItem)

    return statusItem
  }

  /**
   * Update status bar progress
   */
  updateStatusProgress(statusItem: vscode.StatusBarItem, text: string, icon?: string): void {
    if (icon) {
      statusItem.text = `$(${icon}) ${text}`
    } else {
      statusItem.text = text
    }
  }

  /**
   * Hide status bar progress
   */
  hideStatusProgress(statusItem: vscode.StatusBarItem): void {
    statusItem.hide()
    statusItem.dispose()

    // Remove from map
    for (const [id, item] of this.statusBarItems) {
      if (item === statusItem) {
        this.statusBarItems.delete(id)
        break
      }
    }
  }

  /**
   * Show information message with optional actions
   */
  async showInfo(message: string, ...actions: string[]): Promise<string | undefined> {
    this.emit({ type: 'info', message })

    if (actions.length > 0) {
      return await vscode.window.showInformationMessage(message, ...actions)
    } else {
      vscode.window.showInformationMessage(message)
      return undefined
    }
  }

  /**
   * Show warning message
   */
  showWarning(message: string): void {
    this.emit({ type: 'warning', message })
    vscode.window.showWarningMessage(message)
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    this.emit({ type: 'error', message })
    vscode.window.showErrorMessage(message)
  }

  /**
   * Show progress with percentage
   */
  reportProgress(message: string, percentage: number, data?: unknown): void {
    this.emit({ type: 'progress', message, percentage, data })
  }

  /**
   * Create a streaming output channel
   */
  createOutputChannel(name: string): vscode.OutputChannel {
    const channel = vscode.window.createOutputChannel(`Cappy: ${name}`)
    return channel
  }

  /**
   * Clean up all progress indicators
   */
  dispose(): void {
    // Hide all status bar items
    for (const statusItem of this.statusBarItems.values()) {
      statusItem.hide()
      statusItem.dispose()
    }
    this.statusBarItems.clear()

    // Clear progress items
    this.progressItems.clear()

    // Clear listeners
    this.listeners.clear()
  }
}

/**
 * Singleton progress manager instance
 */
export const progressManager = new ProgressManager()

/**
 * Progress-aware tool result with streaming support
 */
export interface StreamingToolResult {
  success: boolean
  result?: unknown
  error?: string
  progress?: {
    events: ProgressEvent[]
    summary: string
  }
}

/**
 * Helper to create streaming tool operations
 */
export class StreamingToolHelper {
  private events: ProgressEvent[] = []
  private progressManager: ProgressManager

  constructor(progressManager: ProgressManager) {
    this.progressManager = progressManager
  }

  /**
   * Start operation
   */
  start(message: string): void {
    this.progressManager.emit({ type: 'start', message })
    this.events.push({ type: 'start', message, timestamp: Date.now() })
  }

  /**
   * Report progress
   */
  progress(message: string, percentage?: number, data?: unknown): void {
    this.progressManager.emit({ type: 'progress', message, percentage, data })
    this.events.push({ type: 'progress', message, percentage, data, timestamp: Date.now() })
  }

  /**
   * Report info
   */
  info(message: string): void {
    this.progressManager.emit({ type: 'info', message })
    this.events.push({ type: 'info', message, timestamp: Date.now() })
  }

  /**
   * Report warning
   */
  warning(message: string): void {
    this.progressManager.emit({ type: 'warning', message })
    this.events.push({ type: 'warning', message, timestamp: Date.now() })
  }

  /**
   * Complete operation
   */
  complete(message: string, result?: unknown): StreamingToolResult {
    this.progressManager.emit({ type: 'complete', message })
    this.events.push({ type: 'complete', message, timestamp: Date.now() })

    return {
      success: true,
      result,
      progress: {
        events: [...this.events],
        summary: message
      }
    }
  }

  /**
   * Fail operation
   */
  fail(error: string): StreamingToolResult {
    this.progressManager.emit({ type: 'error', message: error })
    this.events.push({ type: 'error', message: error, timestamp: Date.now() })

    return {
      success: false,
      error,
      progress: {
        events: [...this.events],
        summary: `Failed: ${error}`
      }
    }
  }

  /**
   * Get progress summary
   */
  getSummary(): string {
    const startTime = this.events[0]?.timestamp
    const endTime = this.events[this.events.length - 1]?.timestamp

    if (!startTime || !endTime) return 'No progress data'

    const duration = endTime - startTime
    const eventCount = this.events.length

    return `Completed in ${duration}ms with ${eventCount} progress events`
  }
}