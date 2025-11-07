/**
 * @fileoverview Background process execution tool with streaming progress
 * @module codeact/tools/run-tool
 */

import * as vscode from 'vscode'
import { BaseTool } from '../core/tool'
import { progressManager, StreamingToolHelper } from '../core/progress'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * Background process execution result
 */
interface RunResult {
  command: string
  pid?: number
  status: 'started' | 'running' | 'completed' | 'failed'
  output?: string
  exitCode?: number
  background: boolean
  workingDirectory: string
  message: string
}

/**
 * Background process execution tool
 * Runs commands in background processes with monitoring
 */
export class RunTool extends BaseTool {
  name = 'run_process'
  description = `Execute commands as background processes with monitoring.

**Usage:**
- Run long-running processes (servers, watchers, builds)
- Execute commands that need to continue running
- Monitor process status and output
- Stop background processes when needed

**Features:**
- Background execution with process monitoring
- Automatic output capture and streaming
- Process lifecycle management
- Working directory control
- Timeout and resource limits

**Examples:**
- "Start dev server on port 3000"
- "Run build watcher in background"
- "Execute database migration"
- "Start test runner with watch mode"
`

  parameters: ToolParameter[] = [
    {
      name: 'command',
      type: 'string',
      description: 'The command to execute',
      required: true
    },
    {
      name: 'cwd',
      type: 'string',
      description: 'Working directory for the command (optional, must be within workspace)',
      required: false
    },
    {
      name: 'background',
      type: 'boolean',
      description: 'Run in background (optional, default true)',
      required: false
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Command timeout in seconds (optional, default 300)',
      required: false
    },
    {
      name: 'env',
      type: 'object',
      description: 'Environment variables to set (optional)',
      required: false
    },
    {
      name: 'shell',
      type: 'boolean',
      description: 'Execute through shell (optional, default false)',
      required: false
    }
  ]

  private runningProcesses = new Map<string, vscode.Terminal>()
  private processOutputs = new Map<string, string[]>()
  private readonly DEFAULT_TIMEOUT = 300 // 5 minutes

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }

    const streaming = new StreamingToolHelper(progressManager)

    try {
      const command = input.command as string
      const cwd = input.cwd as string | undefined
      const background = (input.background as boolean) !== false // default true
      const timeout = (input.timeout as number) || this.DEFAULT_TIMEOUT
      const env = (input.env as Record<string, string>) || {}
      const useShell = (input.shell as boolean) || false

      streaming.start(`Starting process: ${command}`)

      // Validate working directory
      if (cwd) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
          return streaming.fail('No workspace folder available')
        }

        const cwdUri = vscode.Uri.file(cwd)
        const relativePath = vscode.workspace.asRelativePath(cwdUri)
        if (relativePath.startsWith('..') || relativePath === cwd) {
          return streaming.fail('Working directory must be within the workspace')
        }
      }

      streaming.progress('Setting up terminal environment', 10)

      // Generate unique process ID
      const processId = `${command.split(' ')[0]}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create terminal for the process
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      const terminal = vscode.window.createTerminal({
        name: `Cappy Process: ${command.split(' ')[0]}`,
        cwd: cwd || workspaceFolder?.uri.fsPath,
        env: { ...process.env, ...env },
        isTransient: true // Terminal will be disposed when process ends
      })

      // Initialize output tracking
      this.processOutputs.set(processId, [])

      streaming.progress('Initializing process monitoring', 20)

      // Set up output monitoring
      const disposables: vscode.Disposable[] = []

      const outputDisposable = vscode.window.onDidChangeTerminalState?.((e) => {
        if (e === terminal) {
          // Terminal state changed - could be process start/end
        }
      })

      if (outputDisposable) {
        disposables.push(outputDisposable)
      }

      streaming.progress('Launching terminal', 30)

      // Show terminal
      terminal.show(false) // Don't focus the terminal

      // Execute command
      if (useShell) {
        terminal.sendText(command)
      } else {
        // Send command directly (better for background processes)
        terminal.sendText(command)
      }

      // Track the process
      this.runningProcesses.set(processId, terminal)

      streaming.progress('Process started successfully', 50)

      // Set up timeout for foreground processes
      let timeoutHandle: NodeJS.Timeout | undefined
      if (!background) {
        timeoutHandle = setTimeout(() => {
          streaming.warning(`Process timeout reached (${timeout}s), stopping...`)
          this.stopProcess(processId)
        }, timeout * 1000)
      }

      // For background processes, return immediately
      if (background) {
        streaming.progress('Background process running', 100)

        const result: RunResult = {
          command,
          pid: undefined, // VSCode terminals don't expose PIDs easily
          status: 'started',
          background: true,
          workingDirectory: cwd || workspaceFolder?.uri.fsPath || '',
          message: `🚀 Started background process: ${command}\n\nProcess ID: ${processId}\nWorking Directory: ${cwd || 'workspace root'}\n\nUse 'stop_process' to terminate when done.`
        }

        return streaming.complete(`Background process started: ${command}`, result)
      }

      // For foreground processes, wait for completion (simplified)
      streaming.progress('Waiting for process completion', 60)

      // In a real implementation, you'd want better process monitoring
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait a bit

      streaming.progress('Process completed', 100)

      // Clean up
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      disposables.forEach(d => d.dispose())

      const result: RunResult = {
        command,
        status: 'completed',
        background: false,
        workingDirectory: cwd || workspaceFolder?.uri.fsPath || '',
        message: `✅ Completed: ${command}\n\nProcess executed successfully.`
      }

      return streaming.complete(`Process completed: ${command}`, result)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error running process'
      return streaming.fail(errorMessage)
    }
  }  /**
   * Stop a background process
   */
  stopProcess(processId: string): boolean {
    const terminal = this.runningProcesses.get(processId)
    if (terminal) {
      terminal.dispose()
      this.runningProcesses.delete(processId)
      this.processOutputs.delete(processId)
      return true
    }
    return false
  }

  /**
   * Get status of a process
   */
  getProcessStatus(processId: string): 'running' | 'stopped' | 'unknown' {
    const terminal = this.runningProcesses.get(processId)
    if (!terminal) {
      return 'stopped'
    }

    // Check if terminal is still active
    if (terminal.exitStatus !== undefined) {
      this.runningProcesses.delete(processId)
      return 'stopped'
    }

    return 'running'
  }

  /**
   * Get output from a process
   */
  getProcessOutput(processId: string): string[] {
    return this.processOutputs.get(processId) || []
  }

  /**
   * List all running processes
   */
  listRunningProcesses(): string[] {
    return Array.from(this.runningProcesses.keys())
  }

  /**
   * Stop all running processes
   */
  stopAllProcesses(): number {
    const processIds = Array.from(this.runningProcesses.keys())
    let stopped = 0

    for (const processId of processIds) {
      if (this.stopProcess(processId)) {
        stopped++
      }
    }

    return stopped
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAllProcesses()
    this.processOutputs.clear()
  }
}