import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class InitCapybaraCommand {
    constructor(        
        private extensionContext?: vscode.ExtensionContext
    ) {}

    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const openFolder = await vscode.window.showInformationMessage(
                    '🔨 Capybara precisa de uma pasta de projeto para ser inicializado.\n\nAbra uma pasta primeiro e depois execute "Capybara: Initialize" novamente.',
                    'Abrir Pasta', 'Cancelar'
                );
                
                if (openFolder === 'Abrir Pasta') {
                    try {
                        await vscode.commands.executeCommand('vscode.openFolder');
                    } catch (error) {
                        vscode.window.showInformationMessage('Por favor, abra uma pasta manualmente via File > Open Folder');
                    }
                }
                return false;
            }

            const capyDir = path.join(workspaceFolder.uri.fsPath, '.capy');
            const githubDir = path.join(workspaceFolder.uri.fsPath, '.github');

            // Mostrar progresso
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔨 Inicializando Capybara',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: 'Verificando estrutura...' });

                // 1. Verificar/Criar pasta .capy
                await this.setupCapyDirectory(capyDir);

                progress.report({ increment: 30, message: 'Coletando informações do projeto...' });

                // 2. Coletar informações do projeto
                const projectInfo = await this.collectProjectInfo(workspaceFolder.uri.fsPath);

                progress.report({ increment: 50, message: 'Criando config.yaml...' });

                // 3. Criar config.yaml
                await this.createConfigYaml(capyDir, projectInfo);

                progress.report({ increment: 70, message: 'Injetando instruções no Copilot...' });

                // 4. Injetar instruções no .github/copilot-instructions.md
                await this.injectCopilotInstructions(githubDir, projectInfo);

                progress.report({ increment: 90, message: 'Copiando instruções...' });

                // 5. Copiar resources/instructions para .capy/instructions
                await this.copyInstructionsFiles(capyDir);

                progress.report({ increment: 100, message: 'Finalizado!' });

                vscode.window.showInformationMessage(
                    '🎉 Capybara inicializado com sucesso! Use "Capybara: Create New Task" para começar.'
                );

                return true;
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao inicializar Capybara: ${error}`);
            return false;
        }
    }

    private async setupCapyDirectory(capyDir: string): Promise<void> {
        try {
            // Verificar se .capy já existe
            await fs.promises.access(capyDir, fs.constants.F_OK);
            
            // Se existe, verificar se tem config.yaml
            const configPath = path.join(capyDir, 'config.yaml');
            try {
                await fs.promises.access(configPath, fs.constants.F_OK);
                // Se config.yaml existe, estrutura está OK
                return;
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    // Não tem config.yaml, remover pasta toda e recriar
                    await fs.promises.rmdir(capyDir, { recursive: true });
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        // Criar estrutura completa
        await fs.promises.mkdir(capyDir, { recursive: true });
        await fs.promises.mkdir(path.join(capyDir, 'tasks'), { recursive: true });
        await fs.promises.mkdir(path.join(capyDir, 'history'), { recursive: true });
        await fs.promises.mkdir(path.join(capyDir, 'instructions'), { recursive: true });
    }

    private async createConfigYaml(capyDir: string, projectInfo: any): Promise<void> {
        const configContent = `# Capybara Configuration
version: "1.0.0"
project:
  name: "${projectInfo.name}"
  type: "${projectInfo.type}"
  languages: 
    - ${projectInfo.languages.map((lang: string) => `"${lang}"`).join('\n    - ')}
  frameworks:
    - ${projectInfo.framework.map((fw: string) => `"${fw}"`).join('\n    - ')}
  description: "${projectInfo.description}"

capybara:
  initialized_at: "${new Date().toISOString()}"
  last_updated: "${new Date().toISOString()}"
  
tasks:
  directory: "tasks"
  history_directory: "history"
  
instructions:
  directory: "instructions"
`;

        const configPath = path.join(capyDir, 'config.yaml');
        await fs.promises.writeFile(configPath, configContent, 'utf8');
    }

    private async injectCopilotInstructions(githubDir: string, projectInfo: any): Promise<void> {
        await fs.promises.mkdir(githubDir, { recursive: true });
        
        const copilotInstructionsPath = path.join(githubDir, 'copilot-instructions.md');
        
        // Ler template das instruções
        const templatePath = path.join(this.extensionContext?.extensionPath || '', 'resources', 'templates', 'capybara-copilot-instructions.md');
        const templateContent = await fs.promises.readFile(templatePath, 'utf8');

        // Substituir placeholders
        const instructions = templateContent
            .replace(/{PROJECT_NAME}/g, projectInfo.name)
            .replace(/{PROJECT_TYPE}/g, projectInfo.type)
            .replace(/{MAIN_LANGUAGE}/g, projectInfo.languages.join(', '))
            .replace(/{FRAMEWORKS}/g, projectInfo.framework?.join(', ') || 'Nenhum detectado');

        const capybaraInstructions = `
-- CAPYBARA MEMORY INSTRUCTIONS INIT --
${instructions}
-- CAPYBARA MEMORY INSTRUCTIONS END --
`;

        let finalContent = capybaraInstructions;

        // Verificar se arquivo já existe
        try {
            const existingContent = await fs.promises.readFile(copilotInstructionsPath, 'utf8');
            
            // Remover instruções antigas se existirem
            const cleanContent = existingContent.replace(
                /-- CAPYBARA MEMORY INSTRUCTIONS INIT --[\s\S]*?-- CAPYBARA MEMORY INSTRUCTIONS END --/g,
                ''
            ).trim();

            // Adicionar novas instruções
            finalContent = cleanContent ? `${cleanContent}\n\n${capybaraInstructions}` : capybaraInstructions;
            
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Erro ao ler arquivo existente:', error);
            }
        }

        await fs.promises.writeFile(copilotInstructionsPath, finalContent, 'utf8');
    }

    private async copyInstructionsFiles(capyDir: string): Promise<void> {
        const sourceDir = path.join(this.extensionContext?.extensionPath || '', 'resources', 'instructions');
        const targetDir = path.join(capyDir, 'instructions');

        // Copiar todos os arquivos de resources/instructions
        await this.copyDirectory(sourceDir, targetDir);
    }

    private async collectProjectInfo(workspacePath: string): Promise<any> {
        const projectName = path.basename(workspacePath);
        
        // Detectar linguagens
        const languages = await this.detectLanguages(workspacePath);
        
        // Detectar frameworks
        const frameworks = await this.detectFrameworks(workspacePath);

        return {
            name: projectName,
            description: `Projeto ${projectName} - Desenvolvimento solo com Capybara`,
            language: languages.length > 0 ? languages[0] : 'unknown',
            languages: languages,
            framework: frameworks,
            type: this.inferProjectType(languages, frameworks)
        };
    }

    private async detectLanguages(workspacePath: string): Promise<string[]> {
        const languages: string[] = [];
        
        // Verificar arquivos comuns
        try {
            await fs.promises.access(path.join(workspacePath, 'package.json'), fs.constants.F_OK);
            languages.push('javascript');
            
            // Verificar se é TypeScript
            try {
                await fs.promises.access(path.join(workspacePath, 'tsconfig.json'), fs.constants.F_OK);
                languages.push('typescript');
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    // Check for .ts files
                    if (await this.hasFilesWithExtension(workspacePath, '.ts')) {
                        languages.push('typescript');
                    }
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Error checking package.json:', error);
            }
        }
        
        if (await this.hasFilesWithExtension(workspacePath, '.py')) {
            languages.push('python');
        }
        
        if (await this.hasFilesWithExtension(workspacePath, '.cs')) {
            languages.push('csharp');
        }
        
        if (await this.hasFilesWithExtension(workspacePath, '.java')) {
            languages.push('java');
        }
        
        return languages;
    }

    private async detectFrameworks(workspacePath: string): Promise<string[]> {
        const frameworks: string[] = [];
        
        try {
            const packageJsonPath = path.join(workspacePath, 'package.json');
            try {
                await fs.promises.access(packageJsonPath, fs.constants.F_OK);
                const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(packageJsonContent);
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                if (deps['react']) { frameworks.push('react'); }
                if (deps['next']) { frameworks.push('nextjs'); }
                if (deps['vue']) { frameworks.push('vue'); }
                if (deps['@angular/core']) { frameworks.push('angular'); }
                if (deps['express']) { frameworks.push('express'); }
                if (deps['vscode']) { frameworks.push('vscode-extension'); }
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    console.error('Error reading package.json:', error);
                }
            }
        } catch (error) {
            // Ignore errors
        }
        
        return frameworks;
    }

    private async hasFilesWithExtension(dirPath: string, extension: string): Promise<boolean> {
        try {
            const files = await fs.promises.readdir(dirPath);
            return files.some((file: string) => file.endsWith(extension));
        } catch {
            return false;
        }
    }

    private inferProjectType(languages: string[], frameworks: string[]): string {
        if (frameworks.includes('vscode-extension')) { return 'vscode-extension'; }
        if (frameworks.includes('nextjs')) { return 'web-app'; }
        if (frameworks.includes('react')) { return 'web-app'; }
        if (languages.includes('python')) { return 'python-app'; }
        if (languages.includes('typescript') || languages.includes('javascript')) { return 'node-app'; }
        return 'general';
    }

    private async copyDirectory(source: string, destination: string): Promise<void> {
        const entries = await fs.promises.readdir(source, { withFileTypes: true });
        
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);
            
            if (entry.isDirectory()) {
                await fs.promises.mkdir(destPath, { recursive: true });
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.promises.copyFile(sourcePath, destPath);
            }
        }
    }
}
