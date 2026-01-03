import * as vscode from 'vscode';
import { LLMSelector } from '../services/llm-selector';

export interface RefineTaskInput {
  taskFile?: string;
}

export class RefineTaskTool implements vscode.LanguageModelTool<RefineTaskInput> {
  public inputSchema = {
    type: 'object',
    properties: {
      taskFile: {
        type: 'string',
        description: 'Task file name to refine (optional, defaults to active task)'
      }
    },
    required: []
  } as const;

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<RefineTaskInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('No workspace folder found')
      ]);
    }

    try {
      const tasksDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks');
      const taskFile = await this.findTaskFile(tasksDir, options.input?.taskFile);
      
      if (!taskFile) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('No active task file found. Create a task first.')
        ]);
      }

      const taskContent = await vscode.workspace.fs.readFile(taskFile);
      const taskXml = Buffer.from(taskContent).toString('utf8');
      const context = await this.gatherWorkspaceContext(workspaceFolder);
      const refinedXml = await this.refineWithLLM(taskXml, context);

      if (!refinedXml) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('Failed to refine task. LLM unavailable.')
        ]);
      }

      await vscode.workspace.fs.writeFile(taskFile, Buffer.from(refinedXml, 'utf8'));
      const doc = await vscode.workspace.openTextDocument(taskFile);
      await vscode.window.showTextDocument(doc);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Task refinada com sucesso! Arquivos corrigidos, requisitos detalhados, estimativas adicionadas.')
      ]);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error refining task: ' + errorMessage)
      ]);
    }
  }

  private async findTaskFile(tasksDir: vscode.Uri, fileName?: string): Promise<vscode.Uri | null> {
    try {
      const files = await vscode.workspace.fs.readDirectory(tasksDir);
      if (fileName) {
        const match = files.find(([name]) => name.includes(fileName));
        if (match) return vscode.Uri.joinPath(tasksDir, match[0]);
      }
      const activeTask = files.find(([name]) => name.endsWith('.ACTIVE.xml'));
      if (activeTask) return vscode.Uri.joinPath(tasksDir, activeTask[0]);
      return null;
    } catch {
      return null;
    }
  }

  private async gatherWorkspaceContext(workspaceFolder: vscode.WorkspaceFolder): Promise<WorkspaceContext> {
    const context: WorkspaceContext = {
      projectName: workspaceFolder.name,
      structure: [],
      techStack: []
    };

    try {
      const pkgUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
      const pkgContent = await vscode.workspace.fs.readFile(pkgUri);
      const pkg = JSON.parse(Buffer.from(pkgContent).toString('utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps['react']) context.techStack.push('React');
      if (deps['@langchain/core']) context.techStack.push('LangChain');
      if (deps['sqlite3']) context.techStack.push('SQLite');
      if (deps['typescript']) context.techStack.push('TypeScript');
    } catch { /* ignore */ }

    try {
      const srcUri = vscode.Uri.joinPath(workspaceFolder.uri, 'src');
      context.structure = await this.getDirectoryTree(srcUri, 2);
    } catch { /* ignore */ }

    return context;
  }

  private async getDirectoryTree(uri: vscode.Uri, depth: number, prefix = ''): Promise<string[]> {
    if (depth <= 0) return [];
    const result: string[] = [];
    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      for (const [name, type] of entries) {
        if (name.startsWith('.') || name === 'node_modules') continue;
        const fullPath = prefix ? prefix + '/' + name : name;
        if (type === vscode.FileType.Directory) {
          result.push(fullPath + '/');
          const subUri = vscode.Uri.joinPath(uri, name);
          result.push(...await this.getDirectoryTree(subUri, depth - 1, fullPath));
        }
      }
    } catch { /* ignore */ }
    return result;
  }

  private async refineWithLLM(taskXml: string, context: WorkspaceContext): Promise<string | null> {
    const model = await LLMSelector.selectBestModel();
    if (!model) return null;

    const prompt = 'Voce e um arquiteto de software senior. Refine este arquivo de task XML.\n\n' +
      'PROJETO: ' + context.projectName + '\n' +
      'TECH STACK: ' + context.techStack.join(', ') + '\n' +
      'ESTRUTURA:\n' + context.structure.slice(0, 30).join('\n') + '\n\n' +
      'TASK ATUAL:\n' + taskXml + '\n\n' +
      'REFINE COM:\n' +
      '1. Arquivos corretos baseado na estrutura\n' +
      '2. Requisitos tecnicos detalhados\n' +
      '3. Estimativas de tempo em cada step\n' +
      '4. Dependencias npm necessarias\n' +
      '5. Referencias uteis\n' +
      '6. Prevention rules especificas\n\n' +
      'RETORNE APENAS O XML REFINADO.';

    try {
      const response = await model.sendRequest([
        vscode.LanguageModelChatMessage.User(prompt)
      ], {});

      let result = '';
      for await (const chunk of response.text as AsyncIterable<unknown>) {
        if (typeof chunk === 'string') {
          result += chunk;
        } else if (chunk && typeof chunk === 'object' && 'value' in (chunk as Record<string, unknown>)) {
          result += (chunk as Record<string, unknown>).value;
        }
      }

      const xmlMatch = result.match(/<\?xml[\s\S]*<\/task>/);
      if (xmlMatch) return xmlMatch[0];
      
      const taskMatch = result.match(/<task[\s\S]*<\/task>/);
      if (taskMatch) return '<?xml version="1.0" encoding="UTF-8"?>\n' + taskMatch[0];

      return null;
    } catch (error) {
      console.error('[RefineTaskTool] LLM error:', error);
      return null;
    }
  }
}

interface WorkspaceContext {
  projectName: string;
  structure: string[];
  techStack: string[];
}
