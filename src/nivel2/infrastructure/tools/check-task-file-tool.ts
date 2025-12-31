import * as vscode from 'vscode';

interface CheckTaskFileInput {
  /**
   * File name inside .cappy/tasks (e.g., task_2025-12-21_1766285413291_create-tool.ACTIVE.xml)
   */
  fileName: string;
}

/**
 * Language Model Tool to verify whether a task file exists in the workspace.
 */
export class CheckTaskFileTool implements vscode.LanguageModelTool<CheckTaskFileInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CheckTaskFileInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { fileName } = options.input;

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return {
          content: [new vscode.LanguageModelTextPart('❌ No workspace folder open')]
        };
      }

      // Build candidate paths (.ACTIVE.xml fallback to .xml if not provided)
      const tasksDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks');
      const candidates: vscode.Uri[] = [];

      const normalized = fileName.trim();
      if (normalized.length === 0) {
        return {
          content: [new vscode.LanguageModelTextPart('❌ fileName is required')]
        };
      }

      const hasExtension = /\.xml$/i.test(normalized);
      if (hasExtension) {
        candidates.push(vscode.Uri.joinPath(tasksDir, normalized));
      } else {
        candidates.push(vscode.Uri.joinPath(tasksDir, `${normalized}.ACTIVE.xml`));
        candidates.push(vscode.Uri.joinPath(tasksDir, `${normalized}.xml`));
      }

      for (const uri of candidates) {
        try {
          await vscode.workspace.fs.stat(uri);
          return {
            content: [new vscode.LanguageModelTextPart(`✅ Task file exists: ${uri.fsPath}`)]
          };
        } catch {
          // continue to next candidate
        }
      }

      return {
        content: [new vscode.LanguageModelTextPart('⚠️ Task file not found in .cappy/tasks')]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [new vscode.LanguageModelTextPart(`❌ Error checking task file: ${message}`)]
      };
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CheckTaskFileInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Checking task file: ${options.input.fileName}`
    };
  }
}