/**
 * @fileoverview File write/create tool
 * @module codeact/tools/file-write-tool
 */

import * as vscode from 'vscode'
import * as path from 'node:path'
import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * File write tool - create or overwrite files
 */
export class FileWriteTool extends BaseTool {
  name = 'write_file'
  description = 'Create a new file or overwrite an existing file with specified content. Use this to implement code, create configuration files, etc.'
  
  parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description: 'Relative path where the file should be created/written',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write to the file',
      required: true
    }
  ]
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    try {
      const filePath = input.path as string
      const content = input.content as string
      
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        return this.error('No workspace folder open')
      }
      
      // Construct absolute path
      const absolutePath = path.join(workspaceFolder.uri.fsPath, filePath)
      const uri = vscode.Uri.file(absolutePath)
      
      // Ensure directory exists
      const dirPath = path.dirname(absolutePath)
      const dirUri = vscode.Uri.file(dirPath)
      try {
        await vscode.workspace.fs.createDirectory(dirUri)
      } catch {
        // Directory might already exist
      }
      
      // Write file
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'))
      
      // Open the file in editor
      const doc = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(doc)
      
      const lineCount = content.split('\n').length
      
      return this.success({
        path: filePath,
        lineCount,
        message: `✅ File written: \`${filePath}\` (${lineCount} lines)`
      })
      
    } catch (error) {
      return this.error(
        error instanceof Error ? error.message : 'Unknown error writing file'
      )
    }
  }
}
