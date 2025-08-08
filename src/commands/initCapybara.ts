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

                progress.report({ increment: 40, message: 'Criando config.yaml...' });

                // 2. Criar config.yaml com versão da extensão
                const ext = vscode.extensions.getExtension('eduardocecon.capybara-memory');
                const extVersion = ext?.packageJSON?.version || '0.0.0';
                await this.createConfigYaml(capyDir, extVersion);

                progress.report({ increment: 65, message: 'Injetando instruções no Copilot...' });

                // 3. Injetar instruções no .github/copilot-instructions.md com CAPY:CONFIG
                const projectName = path.basename(workspaceFolder.uri.fsPath);
                await this.injectCopilotInstructions(githubDir, {
                    name: projectName,
                    type: 'general',
                    languages: ['unknown'],
                    framework: []
                });

                progress.report({ increment: 85, message: 'Copiando instruções...' });

                // 4. Copiar resources/instructions para .capy/instructions
                await this.copyInstructionsFiles(capyDir);

                // 5. Atualizar .gitignore para manter instruções privadas
                await this.updateGitignore(workspaceFolder.uri.fsPath);

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
                    // Não tem config.yaml, remover pasta toda e recriar (API moderna)
                    await fs.promises.rm(capyDir, { recursive: true, force: true });
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

    private async createConfigYaml(capyDir: string, extensionVersion: string): Promise<void> {
        const configContent = `# Capybara Configuration
version: "${extensionVersion}"

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

    private getExtensionRoot(): string {
        // Prefer VS Code context when available
        const candidatePaths = [
            this.extensionContext?.extensionPath,
            // compiled test/runtime: out/commands -> out
            path.resolve(__dirname, '../..'),
            // project root if running from out
            path.resolve(__dirname, '../../..')
        ].filter(Boolean) as string[];

        for (const base of candidatePaths) {
            const tpl = path.join(base, 'resources', 'templates', 'capybara-copilot-instructions.md');
            const instr = path.join(base, 'resources', 'instructions');
            try {
                if (fs.existsSync(tpl) && fs.existsSync(instr)) {
                    return base;
                }
            } catch {
                // ignore and continue
            }
        }
        // Fallback to current working directory
        return process.cwd();
    }

    private async injectCopilotInstructions(githubDir: string, projectInfo: { name: string; type: string; languages: string[]; framework: string[]; }): Promise<void> {
        await fs.promises.mkdir(githubDir, { recursive: true });
        
        const copilotInstructionsPath = path.join(githubDir, 'copilot-instructions.md');
        
        // Ler template das instruções
        const templatePath = path.join(this.getExtensionRoot(), 'resources', 'templates', 'capybara-copilot-instructions.md');
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

        // Bloco CAPY:CONFIG com valores padrão
        const capyConfigBlock = `<!-- CAPY:CONFIG:BEGIN -->
capy-config:
  stack:
    source: ".github/instructions/copilot.stack.md"
    validated: false
    last-validated-at:
<!-- CAPY:CONFIG:END -->`;

        let finalContent = capybaraInstructions;

        // Verificar se arquivo já existe
        try {
            const existingContent = await fs.promises.readFile(copilotInstructionsPath, 'utf8');
            
            // Remover instruções antigas (blocos Capybara e CAPY:CONFIG) se existirem
            const removedCapySections = existingContent.replace(
                /-- CAPYBARA MEMORY INSTRUCTIONS INIT --[\s\S]*?-- CAPYBARA MEMORY INSTRUCTIONS END --/g,
                ''
            );
            const cleanContent = removedCapySections.replace(
                /<!--\s*CAPY:CONFIG:BEGIN\s*-->[\s\S]*?<!--\s*CAPY:CONFIG:END\s*-->/g,
                ''
            ).trim();

            // Adicionar novas instruções + bloco CAPY:CONFIG no topo
            finalContent = cleanContent 
                ? `${capyConfigBlock}\n\n${cleanContent}\n\n${capybaraInstructions}`
                : `${capyConfigBlock}\n\n${capybaraInstructions}`;
            
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Erro ao ler arquivo existente:', error);
            }
            // Se não existir, criar com bloco CAPY:CONFIG + instruções
            finalContent = `${capyConfigBlock}\n\n${capybaraInstructions}`;
        }

        await fs.promises.writeFile(copilotInstructionsPath, finalContent, 'utf8');
    }

    private async copyInstructionsFiles(capyDir: string): Promise<void> {
        const sourceDir = path.join(this.getExtensionRoot(), 'resources', 'instructions');
        const targetDir = path.join(capyDir, 'instructions');

        // Copiar todos os arquivos de resources/instructions
        await this.copyDirectory(sourceDir, targetDir);
    }

    private async updateGitignore(workspaceRoot: string): Promise<void> {
        const gitignorePath = path.join(workspaceRoot, '.gitignore');
        let content = '';
        try {
            content = await fs.promises.readFile(gitignorePath, 'utf8');
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        const header = '# Capybara - Private AI Instructions';
        const entry = '.github/copilot-instructions.md';

        let changed = false;
        if (!content.includes(header)) {
            content = content ? `${content}\n\n${header}\n${entry}\n` : `${header}\n${entry}\n`;
            changed = true;
        } else if (!content.includes(entry)) {
            content = `${content.trim()}\n${entry}\n`;
            changed = true;
        }

        if (changed) {
            await fs.promises.writeFile(gitignorePath, content, 'utf8');
        }
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
