/**
 * @fileoverview String replace editor tool (like OpenHands str_replace_editor)
 * @module codeact/tools/edit-file-tool
 */

import * as vscode from 'vscode'
import * as path from 'node:path'
import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * Edit file tool - edit existing files using search/replace
 * Inspired by OpenHands str_replace_editor
 */
export class EditFileTool extends BaseTool {
  name = 'edit_file'
  description = `Edit an existing file using search and replace.

**Usage:**
1. Provide the file path
2. Provide the OLD content to search for (must match exactly)
3. Provide the NEW content to replace it with

**Tips:**
- OLD content must match exactly (including whitespace)
- Include context lines before/after for uniqueness
- NEW content should maintain proper indentation
`
  
  parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description: 'Relative path to the file to edit',
      required: true
    },
    {
      name: 'oldContent',
      type: 'string',
      description: 'The exact content to search for and replace (must match exactly)',
      required: true
    },
    {
      name: 'newContent',
      type: 'string',
      description: 'The new content to replace the old content with',
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
      const oldContent = input.oldContent as string
      const newContent = input.newContent as string
      
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        return this.error('No workspace folder open')
      }
      
      // Construct absolute path
      const absolutePath = path.join(workspaceFolder.uri.fsPath, filePath)
      const uri = vscode.Uri.file(absolutePath)
      
      // Read current content
      const fileContent = await vscode.workspace.fs.readFile(uri)
      const currentContent = Buffer.from(fileContent).toString('utf-8')
      
      // Check if old content exists
      if (!currentContent.includes(oldContent)) {
        return this.error(
          `Could not find the specified content to replace in ${filePath}.\n\nMake sure the oldContent matches exactly (including whitespace).`
        )
      }
      
      // Check for multiple matches
      const matches = currentContent.split(oldContent).length - 1
      if (matches > 1) {
        return this.error(
          `Found ${matches} matches for the oldContent in ${filePath}.\n\nPlease provide more context to make the match unique.`
        )
      }
      
      // Perform replacement
      const updatedContent = currentContent.replace(oldContent, newContent)
      
      // Write back
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updatedContent, 'utf-8'))
      
      // Open the file at the edit location
      const doc = await vscode.workspace.openTextDocument(uri)
      const editor = await vscode.window.showTextDocument(doc)
      
      // Try to position cursor at the edit
      const editPosition = updatedContent.indexOf(newContent)
      if (editPosition >= 0) {
        const position = doc.positionAt(editPosition)
        editor.selection = new vscode.Selection(position, position)
        editor.revealRange(new vscode.Range(position, position))
      }
      
      return this.success({
        path: filePath,
        matched: true,
        message: `✅ File edited successfully: \`${filePath}\`\n\nReplaced content at 1 location.`
      })
      
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return this.error(`File not found: ${input.path}`)
      }
      return this.error(
        error instanceof Error ? error.message : 'Unknown error editing file'
      )
    }
  }
}
