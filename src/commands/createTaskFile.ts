import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { writeOutput } from '../utils/outputWriter';

function getWorkspaceRoot(): string | null {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder?.uri.fsPath ?? null;
}

function getExtensionRoot(context?: vscode.ExtensionContext): string {
    const candidates = [
        context?.extensionPath,
        path.resolve(__dirname, '../..'),
        path.resolve(__dirname, '../../..')
    ].filter(Boolean) as string[];
    
    for (const base of candidates) {
        const tpl = path.join(base, 'resources', 'templates', 'task-template.xml');
        if (fs.existsSync(tpl)) {
            return base;
        }
    }
    return process.cwd();
}

function generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generateTaskId(): string {
    const timestamp = generateTimestamp();
    return `TASK_${timestamp}`;
}

function generateFileName(): string {
    const timestamp = generateTimestamp();
    return `TASK_${timestamp}_.ACTIVE.xml`;
}

async function createTaskFile(context?: vscode.ExtensionContext, args?: Record<string, string>): Promise<string> {
    try {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
            const message = "❌ Nenhum workspace aberto";
            await writeOutput(message);
            return message;
        }

        // Criar diretório .cappy/tasks se não existir
        const cappyDir = path.join(workspaceRoot, '.cappy');
        const tasksDir = path.join(cappyDir, 'tasks');
        
        if (!fs.existsSync(cappyDir)) {
            fs.mkdirSync(cappyDir, { recursive: true });
        }
        
        if (!fs.existsSync(tasksDir)) {
            fs.mkdirSync(tasksDir, { recursive: true });
        }

        // Ler o template XML
        const extensionRoot = getExtensionRoot(context);
        const templatePath = path.join(extensionRoot, 'resources', 'templates', 'task-template.xml');
        
        if (!fs.existsSync(templatePath)) {
            const message = "❌ Template de tarefa não encontrado";
            await writeOutput(message);
            return message;
        }

        let templateContent = fs.readFileSync(templatePath, 'utf8');

        // Gerar dados da tarefa
        const taskId = generateTaskId();
        const fileName = generateFileName();
        const timestamp = new Date().toISOString();
        
        // Substituir placeholders no template
        templateContent = templateContent
            .replace(/\{\{TASK_ID\}\}/g, taskId)
            .replace(/\{\{FILE_NAME\}\}/g, fileName)
            .replace(/\{\{CREATED_TIMESTAMP\}\}/g, timestamp);

        // Aplicar argumentos opcionais se fornecidos
        if (args) {
            if (args.title) {
                templateContent = templateContent.replace('<title>Nova Tarefa</title>', `<title>${args.title}</title>`);
            }
            if (args.description) {
                templateContent = templateContent.replace('<description>Descrição da tarefa</description>', `<description>${args.description}</description>`);
            }
            if (args.area) {
                templateContent = templateContent.replace('<area>desenvolvimento</area>', `<area>${args.area}</area>`);
            }
            if (args.priority) {
                templateContent = templateContent.replace('<priority>media</priority>', `<priority>${args.priority}</priority>`);
            }
            if (args.estimate) {
                templateContent = templateContent.replace('<estimate>30min</estimate>', `<estimate>${args.estimate}</estimate>`);
            }
        }

        // Criar o arquivo de tarefa
        const taskFilePath = path.join(tasksDir, fileName);
        fs.writeFileSync(taskFilePath, templateContent, 'utf8');

        // Preparar resultado
        const result = {
            success: true,
            taskId: taskId,
            fileName: fileName,
            filePath: taskFilePath,
            xml: templateContent
        };

        const output = `✅ Arquivo de tarefa criado com sucesso:
📁 Arquivo: ${fileName}
🆔 Task ID: ${taskId}
📍 Caminho: ${taskFilePath}

📄 Conteúdo XML:
${templateContent}`;

        await writeOutput(output);
        return output;

    } catch (error) {
        const message = `❌ Erro ao criar arquivo de tarefa: ${error}`;
        await writeOutput(message);
        return message;
    }
}

export default createTaskFile;
