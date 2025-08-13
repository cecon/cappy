import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class InitCappyCommand {
    constructor(        
        private extensionContext?: vscode.ExtensionContext
    ) {}

    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const openFolder = await vscode.window.showInformationMessage(
                    '🔨 Cappy precisa de uma pasta de projeto para ser inicializado.\n\nAbra uma pasta primeiro e depois execute "Cappy: Initialize" novamente.',
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

            const capyDir = path.join(workspaceFolder.uri.fsPath, '.cappy');
            const githubDir = path.join(workspaceFolder.uri.fsPath, '.github');

            // Mostrar progresso
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔨 Inicializando Cappy',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: 'Verificando estrutura...' });

                // 1. Verificar/Criar pasta .cappy
                await this.setupCappyDirectory(capyDir);

                progress.report({ increment: 40, message: 'Criando config.yaml...' });

                // 2. Criar config.yaml com versão da extensão
                const ext = vscode.extensions.getExtension('eduardocecon.cappy-memory');
                const extVersion = ext?.packageJSON?.version || '0.0.0';
                await this.createConfigYaml(capyDir, extVersion);

                // 2.1 Garantir stack.md vazio na instalação inicial
                await this.ensureStackFile(capyDir);

                progress.report({ increment: 65, message: 'Criando instruções locais do Cappy...' });

                // 3. (Alterado) Não injeta mais CAPY:CONFIG no copilot-instructions.md
                // Mantemos apenas as instruções locais em .capy/instructions

                progress.report({ increment: 85, message: 'Copiando instruções...' });

                // 4. Copiar resources/instructions para .capy/instructions
                await this.copyInstructionsFiles(capyDir);

                // 5. Garantir .github/copilot-instructions.md a partir do template
                await this.ensureGithubCopilotInstructions(workspaceFolder.uri.fsPath);

                // 6. Atualizar .gitignore para manter instruções privadas
                await this.updateGitignore(workspaceFolder.uri.fsPath);

                // 6.1 Garantia final: certificar que config.yaml existe (resiliência a variações FS)
                try {
                    const cfgPath = path.join(capyDir, 'config.yaml');
                    await fs.promises.access(cfgPath, fs.constants.F_OK);
                } catch {
                    const ext = vscode.extensions.getExtension('eduardocecon.cappy-memory');
                    const extVersion = ext?.packageJSON?.version || '0.0.0';
                    await this.createConfigYaml(capyDir, extVersion);
                }

                progress.report({ increment: 100, message: 'Finalizado!' });

                vscode.window.showInformationMessage(
                    '🎉 Cappy inicializado com sucesso! Use "Cappy: Create New Task" para começar.'
                );

                return true;
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao inicializar Cappy: ${error}`);
            return false;
        }
    }

    private async setupCappyDirectory(capyDir: string): Promise<void> {
        try {
            // Verificar se .cappy já existe
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
                const configContent = `# Cappy Configuration
version: "${extensionVersion}"

cappy:
    initialized_at: "${new Date().toISOString()}"
    last_updated: "${new Date().toISOString()}"

stack:
    source: ".cappy/stack.md"
    validated: false
    validated_at:

tasks:
    directory: "tasks"
    history_directory: "history"

instructions:
    directory: "instructions"
`;

        const configPath = path.join(capyDir, 'config.yaml');
        await fs.promises.writeFile(configPath, configContent, 'utf8');
    }

    private async ensureStackFile(capyDir: string): Promise<void> {
        const stackPath = path.join(capyDir, 'stack.md');
        try {
            await fs.promises.access(stackPath, fs.constants.F_OK);
        } catch (err: any) {
            if (err?.code === 'ENOENT') {
                await fs.promises.writeFile(stackPath, '', 'utf8');
            } else {
                throw err;
            }
        }
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
            const tpl = path.join(base, 'resources', 'templates', 'cappy-copilot-instructions.md');
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

    // Removed: injectCopilotInstructions. Copilot instructions no longer carry CAPY config.

    private async copyInstructionsFiles(capyDir: string): Promise<void> {
        const sourceDir = path.join(this.getExtensionRoot(), 'resources', 'instructions');
        const targetDir = path.join(capyDir, 'instructions');

        // Copiar todos os arquivos de resources/instructions
        await this.copyDirectory(sourceDir, targetDir);
    }

    private async ensureGithubCopilotInstructions(workspaceRoot: string): Promise<void> {
        const githubDir = path.join(workspaceRoot, '.github');
        const targetPath = path.join(githubDir, 'copilot-instructions.md');
        const templatePath = path.join(this.getExtensionRoot(), 'resources', 'templates', 'cappy-copilot-instructions.md');

        await fs.promises.mkdir(githubDir, { recursive: true });

        // Create only if missing. Never overwrite user-edited file.
        try {
            await fs.promises.access(targetPath, fs.constants.F_OK);
            return; // exists, do nothing
        } catch (e: any) {
            if (e?.code !== 'ENOENT') {
                throw e;
            }
        }

        // Seed from template if available; otherwise, minimal header
        try {
            const content = await fs.promises.readFile(templatePath, 'utf8');
            await fs.promises.writeFile(targetPath, content, 'utf8');
        } catch (err: any) {
            if (err?.code === 'ENOENT') {
                await fs.promises.writeFile(targetPath, '# Cappy Copilot Instructions\n', 'utf8');
            } else {
                throw err;
            }
        }
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

        const header = '# Cappy - Private AI Instructions';
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
