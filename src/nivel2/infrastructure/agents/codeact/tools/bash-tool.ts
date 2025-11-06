/**
 * @fileoverview Bash/Terminal command execution tool
 * @module codeact/tools/bash-tool
 * 
 * Allows agent to execute bash/powershell commands in the workspace
 */

import * as vscode from 'vscode'
import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * Bash command execution tool
 * Executes commands in the integrated terminal
 */
export class BashTool extends BaseTool {
  name = 'execute_bash'
  description = `Execute a bash/powershell command in the terminal.

**Usage:**
- Execute commands to explore the codebase, run builds, tests, etc.
- Commands execute in a persistent shell session
- For long-running commands, they will execute in background

**Examples:**
- "npm run build"
- "git status"
- "ls -la src/"
- "grep -r 'function' src/"
`
  
  parameters: ToolParameter[] = [
    {
      name: 'command',
      type: 'string',
      description: 'The bash/powershell command to execute',
      required: true
    },
    {
      name: 'cwd',
      type: 'string',
      description: 'Working directory for the command (optional)',
      required: false
    }
  ]
  
  private terminal: vscode.Terminal | null = null
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    try {
      const command = input.command as string
      const cwd = input.cwd as string | undefined
      
      // Get or create terminal
      if (!this.terminal || this.terminal.exitStatus !== undefined) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        this.terminal = vscode.window.createTerminal({
          name: 'Cappy Agent',
          cwd: cwd || workspaceFolder?.uri.fsPath
        })
      }
      
      // Show terminal
      this.terminal.show(true)
      
      // Send command
      this.terminal.sendText(command)
      
      return this.success({
        command,
        status: 'Command sent to terminal',
        message: `✅ Executed: ${command}\n\nNote: Check the terminal output for results. For critical information, use file read operations instead of relying on terminal output.`
      })
      
    } catch (error) {
      return this.error(
        error instanceof Error ? error.message : 'Unknown error executing command'
      )
    }
  }
  
  /**
   * Dispose terminal when done
   */
  dispose(): void {
    if (this.terminal) {
      this.terminal.dispose()
      this.terminal = null
    }
  }
}
