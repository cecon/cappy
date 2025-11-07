/**
 * @fileoverview Context analyzer for automatic context injection
 * @module services/context-analyzer
 */

import * as vscode from 'vscode'
import { spawn } from 'child_process'
import type { State } from '../core/state'
import { isAction, isObservation } from '../core/events'
import type { ToolResultObservation, ErrorObservation } from '../core/observations'

export interface ContextNeed {
  type: 'file' | 'dependency' | 'error_trace' | 'recent_changes'
  priority: number
  paths: string[]
  reason: string
}

/**
 * Analyzes current state and determines what context is needed
 */
export class ContextAnalyzer {

  /**
   * Analisa state e determina que contexto é necessário
   */
  async analyzeNeeds(state: State): Promise<ContextNeed[]> {
    const needs: ContextNeed[] = []

    // 1. Analisar último erro
    const lastError = this.getLastError(state)
    if (lastError) {
      needs.push(...await this.analyzeError(lastError))
    }

    // 2. Analisar arquivos mencionados
    const mentioned = this.extractMentionedFiles(state)
    if (mentioned.length > 0) {
      needs.push({
        type: 'file',
        priority: 8,
        paths: mentioned,
        reason: 'Files mentioned in conversation'
      })
    }

    // 3. Analisar dependências de arquivos abertos
    const openFiles = await this.getOpenFiles()
    for (const file of openFiles) {
      const deps = await this.analyzeDependencies(file)
      if (deps.length > 0) {
        needs.push({
          type: 'dependency',
          priority: 7,
          paths: deps,
          reason: `Dependencies of ${file}`
        })
      }
    }

    // 4. Mudanças recentes (últimos commits)
    const recentChanges = await this.getRecentChanges()
    if (recentChanges.length > 0) {
      needs.push({
        type: 'recent_changes',
        priority: 5,
        paths: recentChanges,
        reason: 'Recently modified files'
      })
    }

    // Sort by priority
    needs.sort((a, b) => b.priority - a.priority)

    return needs
  }

  /**
   * Analisa erro para determinar arquivos relevantes
   */
  private async analyzeError(error: string): Promise<ContextNeed[]> {
    const needs: ContextNeed[] = []

    // Extract file paths from error message
    const paths = this.extractPathsFromError(error)

    if (paths.length > 0) {
      needs.push({
        type: 'error_trace',
        priority: 10, // Highest priority
        paths,
        reason: 'Files mentioned in error trace'
      })
    }

    // Extract stack trace files
    const stackFiles = this.extractStackTraceFiles(error)
    if (stackFiles.length > 0) {
      needs.push({
        type: 'error_trace',
        priority: 9,
        paths: stackFiles,
        reason: 'Files in error stack trace'
      })
    }

    return needs
  }

  /**
   * Analisa dependências de um arquivo
   */
  private async analyzeDependencies(filePath: string): Promise<string[]> {
    // Ler arquivo
    const content = await this.readFile(filePath)
    if (!content) return []

    const dependencies: string[] = []

    // TypeScript/JavaScript imports
    const importRegex = /import\s+.*\s+from\s+['"](.+)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]

      // Resolver caminho relativo
      if (importPath.startsWith('.')) {
        const resolved = await this.resolveRelativePath(filePath, importPath)
        if (resolved) {
          dependencies.push(resolved)
        }
      }
    }

    // Python imports (se aplicável)
    const pythonImportRegex = /from\s+(\S+)\s+import|import\s+(\S+)/g
    while ((match = pythonImportRegex.exec(content)) !== null) {
      const module = match[1] || match[2]
      const resolved = await this.resolvePythonModule(module)
      if (resolved) {
        dependencies.push(resolved)
      }
    }

    return dependencies
  }

  /**
   * Extrai arquivos mencionados no histórico
   */
  private extractMentionedFiles(state: State): string[] {
    const files = new Set<string>()
    const recentHistory = state.getRecentHistory(5)

    for (const event of recentHistory) {
      if (isAction(event) && event.action === 'message') {
        const content = event.content

        // Regex para paths comuns
        const pathRegex = /(?:^|\s)([a-zA-Z0-9_\-./]+\.(ts|js|py|java|go|rs|cpp|h|tsx|jsx|css|html|json|md))/g
        let match

        while ((match = pathRegex.exec(content)) !== null) {
          files.add(match[1])
        }
      }
    }

    return Array.from(files)
  }

  private extractPathsFromError(error: string): string[] {
    const paths: string[] = []

    // Common patterns: /path/to/file.ts, src/file.ts, etc
    const pathRegex = /(?:^|\s)([a-zA-Z0-9_\-./]+\.(ts|js|py|java|go|rs|cpp|h|tsx|jsx))/g
    let match

    while ((match = pathRegex.exec(error)) !== null) {
      paths.push(match[1])
    }

    return paths
  }

  private extractStackTraceFiles(error: string): string[] {
    const files: string[] = []

    // Stack trace patterns: at /path/to/file.ts:line:col
    const stackRegex = /at\s+.*?\(([^)]+):(\d+):(\d+)\)/g
    let match

    while ((match = stackRegex.exec(error)) !== null) {
      files.push(match[1])
    }

    return files
  }

  private getLastError(state: State): string | null {
    const recent = state.getRecentHistory(10)

    for (let i = recent.length - 1; i >= 0; i--) {
      const event = recent[i]
      if (isObservation(event)) {
        if (event.observation === 'error') {
          return (event as ErrorObservation).error
        }
        if (event.observation === 'tool_result' && !(event as ToolResultObservation).success) {
          const result = (event as ToolResultObservation).result
          return typeof result === 'string' ? result : JSON.stringify(result)
        }
      }
    }

    return null
  }

  private async getOpenFiles(): Promise<string[]> {
    // Use VSCode API to get open editors
    const openEditors = vscode.window.visibleTextEditors
    return openEditors.map(editor => vscode.workspace.asRelativePath(editor.document.uri))
  }

  private async getRecentChanges(): Promise<string[]> {
    // Git log to get recently changed files
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) return []

      const gitLog = await this.runCommand('git log --name-only --oneline -10', {
        cwd: workspaceFolder.uri.fsPath
      })

      const files = new Set<string>()
      const lines = gitLog.split('\n')

      for (const line of lines) {
        // Skip commit messages (lines that don't contain / or .)
        if (line.includes('/') || line.includes('.')) {
          files.add(line.trim())
        }
      }

      return Array.from(files)
    } catch {
      return []
    }
  }

  private async readFile(path: string): Promise<string | null> {
    try {
      const uri = vscode.Uri.file(path)
      const content = await vscode.workspace.fs.readFile(uri)
      return Buffer.from(content).toString('utf-8')
    } catch {
      return null
    }
  }

  private async resolveRelativePath(from: string, to: string): Promise<string | null> {
    try {
      const fromUri = vscode.Uri.file(from)
      const resolvedUri = vscode.Uri.joinPath(fromUri, '..', to)
      const stat = await vscode.workspace.fs.stat(resolvedUri)

      if (stat.type === vscode.FileType.File) {
        return vscode.workspace.asRelativePath(resolvedUri)
      }

      // Try with .ts, .js extensions
      for (const ext of ['.ts', '.js', '.tsx', '.jsx']) {
        try {
          const withExt = vscode.Uri.joinPath(fromUri, '..', to + ext)
          await vscode.workspace.fs.stat(withExt)
          return vscode.workspace.asRelativePath(withExt)
        } catch {
          // Continue
        }
      }

      return null
    } catch {
      return null
    }
  }

  private async resolvePythonModule(_module: string): Promise<string | null> { // eslint-disable-line @typescript-eslint/no-unused-vars
    // For now, just return null - can be extended later
    return null
  }

  private async runCommand(command: string, options: { cwd?: string } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ')

      const proc = spawn(cmd, args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code: number) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`))
        }
      })

      proc.on('error', (err: Error) => {
        reject(err)
      })
    })
  }
}