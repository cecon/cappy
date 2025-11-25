import * as vscode from 'vscode'

interface CreateFileInput {
  path: string
  content: string
}

/**
 * Language Model Tool for creating files in the workspace
 */
export class CreateFileTool implements vscode.LanguageModelTool<CreateFileInput> {
  public inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path from workspace root where the file should be created'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      }
    },
    required: ['path', 'content']
  } as const;

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateFileInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    // Validate input
    if (!options.input) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('❌ Error: Missing tool parameters. Please provide "path" and "content" parameters.')
      ])
    }

    const { path, content } = options.input

    // Validate required parameters
    if (!path || !content) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('❌ Error: Missing required parameters. Example: {"path": "src/file.ts", "content": "code here"}')
      ])
    }

    try {
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ No workspace folder open')
        ])
      }

      // Resolve full path
      const uri = vscode.Uri.joinPath(workspaceFolder.uri, path)

      // Check if file already exists
      try {
        await vscode.workspace.fs.stat(uri)
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`❌ File already exists: ${path}`)
        ])
      } catch {
        // File doesn't exist, proceed with creation
      }

      // Create file with content
      const encoder = new TextEncoder()
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content))

      // Open the created file
      const document = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(document)

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`✅ File created successfully: ${path}`)
      ])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error creating file: ${errorMessage}`)
      ])
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CreateFileInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { path } = options.input
    return {
      invocationMessage: `Creating file: ${path}`,
      confirmationMessages: {
        title: 'Create File',
        message: new vscode.MarkdownString(`Create file \`${path}\`?`)
      }
    }
  }
}
