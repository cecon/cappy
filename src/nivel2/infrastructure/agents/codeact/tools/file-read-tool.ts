/**
 * @fileoverview File read tool for reading file contents
 * @module codeact/tools/file-read-tool
 */

import * as vscode from 'vscode'
import * as path from 'node:path'
import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * File read tool - read file contents from workspace
 */
export class FileReadTool extends BaseTool {
  name = 'read_file'
  description = 'Read the contents of a file from the workspace. Use this to examine code, configuration, or any text file.'
  
  parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description: 'Relative path to the file from workspace root',
      required: true
    },
    {
      name: 'startLine',
      type: 'number',
      description: 'Optional start line (1-based) to read from',
      required: false
    },
    {
      name: 'endLine',
      type: 'number',
      description: 'Optional end line (1-based) to read to',
      required: false
    }
  ]
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    try {
      const filePath = input.path as string
      const startLine = input.startLine as number | undefined
      const endLine = input.endLine as number | undefined
      
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        return this.error('No workspace folder open')
      }
      
      // Construct absolute path
      const absolutePath = path.join(workspaceFolder.uri.fsPath, filePath)
      const uri = vscode.Uri.file(absolutePath)
      
      // Read file
      const fileContent = await vscode.workspace.fs.readFile(uri)
      const content = Buffer.from(fileContent).toString('utf-8')
      
      // If line range specified, extract it
      let resultContent = content
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n')
        const start = (startLine || 1) - 1
        const end = endLine || lines.length
        resultContent = lines.slice(start, end).join('\n')
      }
      
      const lineCount = resultContent.split('\n').length
      
      return this.success({
        path: filePath,
        content: resultContent,
        lineCount,
        message: `📄 Read ${lineCount} lines from \`${filePath}\``
      })
      
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return this.error(`File not found: ${input.path}`)
      }
      return this.error(
        error instanceof Error ? error.message : 'Unknown error reading file'
      )
    }
  }
}
