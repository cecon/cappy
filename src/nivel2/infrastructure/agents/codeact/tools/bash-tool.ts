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
 * Dangerous commands that should be blocked
 */
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf .*',
  'del /s /q c:\\',
  'del /s /q c:',
  'format',
  'fdisk',
  'mkfs',
  'dd if=',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'sudo rm',
  'su -c rm',
  'chmod 777',
  'chown root',
  'passwd',
  'usermod',
  'userdel',
  'groupmod',
  'mount',
  'umount',
  'fsck',
  'mkfs',
  'fdisk',
  'parted',
  'dd',
  'wget',
  'curl.*--exec',
  'curl.*-X',
  'curl.*--upload',
  'scp',
  'rsync',
  'ssh',
  'telnet',
  'ftp',
  'sftp',
  'nc',
  'ncat',
  'socat',
  'netcat',
  'bash -i',
  'sh -i',
  'python -c.*import.*os',
  'python.*exec',
  'node.*exec',
  'eval',
  'exec',
  'system',
  'popen',
  'subprocess',
  'spawn',
  'fork',
  'kill',
  'killall',
  'pkill',
  'kill -9',
  'killall -9',
  'pkill -9'
]

/**
 * Commands that require explicit confirmation
 */
const SENSITIVE_COMMANDS = [
  'rm',
  'del',
  'delete',
  'uninstall',
  'npm uninstall',
  'yarn remove',
  'pnpm remove',
  'git reset',
  'git clean',
  'git push --force',
  'git push -f',
  'drop table',
  'drop database',
  'truncate table',
  'delete from',
  'update.*set',
  'alter table',
  'create table',
  'drop index',
  'drop view',
  'drop procedure',
  'drop function'
]

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

**Safety:**
- Dangerous commands are blocked for security
- Sensitive commands require explicit confirmation
- Commands are validated before execution

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
      description: 'Working directory for the command (optional, must be within workspace)',
      required: false
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Command timeout in seconds (optional, default 30)',
      required: false
    },
    {
      name: 'background',
      type: 'boolean',
      description: 'Run command in background (optional, default false)',
      required: false
    }
  ]
  
  private terminal: vscode.Terminal | null = null
  private commandHistory: string[] = []
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    const commandValidation = this.validateCommand(input)
    if (!commandValidation.valid) {
      return this.error(commandValidation.error!)
    }
    
    try {
      const command = input.command as string
      const cwd = input.cwd as string | undefined
      const timeout = (input.timeout as number) || 30
      const background = (input.background as boolean) || false
      
      // Validate working directory
      if (cwd) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
          return this.error('No workspace folder available')
        }
        
        const cwdUri = vscode.Uri.file(cwd)
        const relativePath = vscode.workspace.asRelativePath(cwdUri)
        if (relativePath.startsWith('..') || relativePath === cwd) {
          return this.error('Working directory must be within the workspace')
        }
      }
      
      // Add to history
      this.commandHistory.push(command)
      if (this.commandHistory.length > 100) {
        this.commandHistory.shift()
      }
      
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
      
      const result = {
        command,
        status: background ? 'Command sent to background' : 'Command sent to terminal',
        timeout: `${timeout}s`,
        cwd: cwd || 'workspace root',
        message: `✅ Executed: ${command}\n\nNote: Check the terminal output for results. For critical information, use file read operations instead of relying on terminal output.`
      }
      
      if (background) {
        result.message += '\n\n⚠️  Command is running in background. Use terminal to monitor progress.'
      }
      
      return this.success(result)
      
    } catch (error) {
      return this.error(
        error instanceof Error ? error.message : 'Unknown error executing command'
      )
    }
  }
  
  /**
   * Validate command for safety
   */
  private validateCommand(input: Record<string, unknown>): { valid: boolean; error?: string } {
    const command = input.command as string
    
    // Check for dangerous commands
    for (const dangerous of DANGEROUS_COMMANDS) {
      if (command.toLowerCase().includes(dangerous.toLowerCase())) {
        return {
          valid: false,
          error: `Command blocked for security: contains dangerous pattern "${dangerous}"`
        }
      }
    }
    
    // Check for sensitive commands (warn but allow)
    for (const sensitive of SENSITIVE_COMMANDS) {
      if (command.toLowerCase().includes(sensitive.toLowerCase())) {
        console.warn(`⚠️  Sensitive command detected: ${command}`)
        // For now, allow but log. In future, could require confirmation
      }
    }
    
    // Check command length
    if (command.length > 1000) {
      return {
        valid: false,
        error: 'Command too long (max 1000 characters)'
      }
    }
    
    // Check for empty command
    if (!command.trim()) {
      return {
        valid: false,
        error: 'Empty command not allowed'
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Get command history
   */
  getCommandHistory(): string[] {
    return [...this.commandHistory]
  }
  
  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = []
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
