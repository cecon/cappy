/**
 * Central registry for Chat Tools
 * 
 * Manages registration, discovery, and lifecycle of all chat tools
 */

import * as vscode from 'vscode'
import type {
  ToolMetadata,
  ToolRegistryEntry,
  ToolUsageMetrics,
  ToolCategory
} from './types'

export class ToolRegistry {
  private tools = new Map<string, ToolRegistryEntry>()
  private metrics = new Map<string, ToolUsageMetrics>()

  /**
   * Register a tool
   */
  register(
    metadata: ToolMetadata,
    tool: vscode.LanguageModelTool<unknown>
  ): vscode.Disposable {
    // Register with VS Code
    const disposable = vscode.lm.registerTool(metadata.id, tool)

    // Store in registry
    this.tools.set(metadata.id, {
      metadata,
      tool,
      disposable
    })

    // Initialize metrics
    this.metrics.set(metadata.id, {
      toolId: metadata.id,
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      userCancellations: 0,
      averageExecutionTime: 0
    })

    console.log(`✅ Tool registered: ${metadata.id} (${metadata.category})`)

    return disposable
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): void {
    const entry = this.tools.get(toolId)
    if (entry) {
      entry.disposable.dispose()
      this.tools.delete(toolId)
      console.log(`🗑️ Tool unregistered: ${toolId}`)
    }
  }

  /**
   * Get tool by ID
   */
  get(toolId: string): ToolRegistryEntry | undefined {
    return this.tools.get(toolId)
  }

  /**
   * Get all tools
   */
  getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ToolRegistryEntry[] {
    return this.getAll().filter(entry => entry.metadata.category === category)
  }

  /**
   * Get tool metadata
   */
  getMetadata(toolId: string): ToolMetadata | undefined {
    return this.tools.get(toolId)?.metadata
  }

  /**
   * Check if tool exists
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId)
  }

  /**
   * Get tool metrics
   */
  getMetrics(toolId: string): ToolUsageMetrics | undefined {
    return this.metrics.get(toolId)
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ToolUsageMetrics[] {
    return Array.from(this.metrics.values())
  }

  /**
   * Record tool invocation
   */
  recordInvocation(
    toolId: string,
    success: boolean,
    duration: number,
    cancelled: boolean = false
  ): void {
    const metrics = this.metrics.get(toolId)
    if (!metrics) return

    metrics.totalInvocations++
    
    if (cancelled) {
      metrics.userCancellations++
    } else if (success) {
      metrics.successfulInvocations++
    } else {
      metrics.failedInvocations++
    }

    // Update average execution time
    const totalSuccessful = metrics.successfulInvocations
    if (success && totalSuccessful > 0) {
      metrics.averageExecutionTime = 
        (metrics.averageExecutionTime * (totalSuccessful - 1) + duration) / totalSuccessful
    }

    metrics.lastUsed = new Date()
  }

  /**
   * Reset metrics for a tool
   */
  resetMetrics(toolId: string): void {
    const metrics = this.metrics.get(toolId)
    if (metrics) {
      metrics.totalInvocations = 0
      metrics.successfulInvocations = 0
      metrics.failedInvocations = 0
      metrics.userCancellations = 0
      metrics.averageExecutionTime = 0
      metrics.lastUsed = undefined
    }
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    for (const toolId of this.metrics.keys()) {
      this.resetMetrics(toolId)
    }
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.tools.size
  }

  /**
   * List all tool IDs
   */
  listIds(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * List all tool names
   */
  listNames(): string[] {
    return this.getAll().map(entry => entry.metadata.name)
  }

  /**
   * Export tools information for debugging
   */
  exportInfo(): {
    tools: Array<{
      id: string
      name: string
      category: string
      version: string
    }>
    metrics: ToolUsageMetrics[]
  } {
    return {
      tools: this.getAll().map(entry => ({
        id: entry.metadata.id,
        name: entry.metadata.name,
        category: entry.metadata.category,
        version: entry.metadata.version
      })),
      metrics: this.getAllMetrics()
    }
  }

  /**
   * Dispose all tools
   */
  dispose(): void {
    for (const entry of this.tools.values()) {
      entry.disposable.dispose()
    }
    this.tools.clear()
    this.metrics.clear()
    console.log('🧹 All tools disposed')
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry()
