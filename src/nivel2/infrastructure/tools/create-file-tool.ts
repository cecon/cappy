import * as vscode from 'vscode'

interface CreateFileInput {
  path: string
  content: string
}

/**
 * Language Model Tool for creating files in the workspace
 */
export class CreateFileTool implements vscode.LanguageModelTool<CreateFileInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateFileInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { path, content } = options.input

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
