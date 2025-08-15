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

async function loadPreventionRules(workspaceRoot: string): Promise<string> {
    const preventionRulesPath = path.join(workspaceRoot, '.cappy', 'prevention-rules.md');
    
    if (fs.existsSync(preventionRulesPath)) {
        const content = fs.readFileSync(preventionRulesPath, 'utf8');
        
        // Parse prevention rules from markdown and convert to XML references
        const rules = parsePreventionRulesFromMarkdown(content);
        return generatePreventionRulesXml(rules);
    }
    
    // If no prevention rules file exists, return empty structure
    return `        <active-rules>
            <!-- Nenhuma prevention rule encontrada em .cappy/prevention-rules.md -->
            <rule id="placeholder" priority="medium">
                <title>Regras serão carregadas do .cappy/prevention-rules.md</title>
                <description>Execute cappy.init para criar arquivo de prevention rules</description>
            </rule>
        </active-rules>
        
        <environment-context>
            <os>{{OS_TYPE}}</os>
            <shell>{{SHELL_TYPE}}</shell>
            <workspace-root>${workspaceRoot}</workspace-root>
        </environment-context>`;
}

function parsePreventionRulesFromMarkdown(content: string): Array<{id: string, title: string, priority: string}> {
    const rules: Array<{id: string, title: string, priority: string}> = [];
    const lines = content.split('\n');
    
    let currentRule: {id: string, title: string, priority: string} | null = null;
    
    for (const line of lines) {
        // Look for markdown headers that could be rule titles
        const headerMatch = line.match(/^#+\s+(.+)/);
        if (headerMatch) {
            if (currentRule) {
                rules.push(currentRule);
            }
            const title = headerMatch[1];
            const id = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            currentRule = {
                id: id,
                title: title,
                priority: 'medium' // Default priority
            };
        }
        
        // Look for priority indicators
        if (currentRule && (line.includes('priority:') || line.includes('Priority:'))) {
            const priorityMatch = line.match(/priority:\s*(high|medium|low)/i);
            if (priorityMatch && currentRule) {
                currentRule.priority = priorityMatch[1].toLowerCase();
            }
        }
    }
    
    if (currentRule) {
        rules.push(currentRule);
    }
    
    return rules;
}

function generatePreventionRulesXml(rules: Array<{id: string, title: string, priority: string}>): string {
    if (rules.length === 0) {
        return `        <active-rules>
            <!-- Nenhuma prevention rule encontrada -->
        </active-rules>
        
        <environment-context>
            <os>{{OS_TYPE}}</os>
            <shell>{{SHELL_TYPE}}</shell>
            <workspace-root>{{WORKSPACE_ROOT}}</workspace-root>
        </environment-context>`;
    }
    
    const ruleRefs = rules.map(rule => 
        `            <rule-ref id="${rule.id}" priority="${rule.priority}" source=".cappy/prevention-rules.md#${rule.id}">
                <title>${rule.title}</title>
            </rule-ref>`
    ).join('\n');
    
    return `        <active-rules>
${ruleRefs}
        </active-rules>
        
        <environment-context>
            <os>{{OS_TYPE}}</os>
            <shell>{{SHELL_TYPE}}</shell>
            <workspace-root>{{WORKSPACE_ROOT}}</workspace-root>
        </environment-context>`;
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

        // Carregar prevention rules existentes
        const preventionRulesXml = await loadPreventionRules(workspaceRoot);

        // Gerar dados da tarefa
        const taskId = generateTaskId();
        const fileName = generateFileName();
        const timestamp = new Date().toISOString();
        
        // Detectar OS e shell (simplificado)
        const osType = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
        const shellType = process.platform === 'win32' ? 'powershell.exe' : 'bash';
        
        // Substituir placeholders no template
        templateContent = templateContent
            .replace(/\{\{TASK_ID\}\}/g, taskId)
            .replace(/\{\{FILE_NAME\}\}/g, fileName)
            .replace(/\{\{CREATED_TIMESTAMP\}\}/g, timestamp)
            .replace(/\{\{WORKSPACE_ROOT\}\}/g, workspaceRoot)
            .replace(/\{\{OS_TYPE\}\}/g, osType)
            .replace(/\{\{SHELL_TYPE\}\}/g, shellType);

        // Inserir prevention rules na seção appropriada
        templateContent = templateContent.replace(
            /<prevention-rules>\s*<!--[^>]*-->\s*<verification-checklist>/s,
            `<prevention-rules>
        <!-- Prevention rules carregadas automaticamente do .cappy/prevention-rules.md -->
${preventionRulesXml}
        
        <verification-checklist>`
        );

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
