import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { writeOutputForced } from '../utils/outputWriter';

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
                writeOutputForced('Operação cancelada pelo usuário');
                return false;
            }

            const cappyDir = path.join(workspaceFolder.uri.fsPath, '.cappy');            
            const configPath = path.join(cappyDir, 'config.yaml');
            let configExisted = false;
            try {
                await fs.promises.access(configPath, fs.constants.F_OK);
                configExisted = true;
            } catch { /* no-op */ }

            // Mostrar progresso
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔨 Inicializando Cappy',
                cancellable: false
            }, async (progress: any) => {
                
                progress.report({ increment: 0, message: 'Verificando estrutura...' });

                // 1. Verificar/Criar pasta .cappy
                await this.setupCappyDirectory(cappyDir);

                progress.report({ increment: 40, message: configExisted ? 'Atualizando config.yaml...' : 'Criando config.yaml...' });

                // 2. Criar/Atualizar config.yaml com versão da extensão
                const ext = vscode.extensions.getExtension('eduardocecon.cappy-memory');
                const extVersion = ext?.packageJSON?.version || '0.0.0';
                await this.createConfigYaml(cappyDir, extVersion);

                progress.report({ increment: 65, message: 'Criando instruções locais do Cappy...' });

                // 3. (Alterado) Não injeta mais CAPY:CONFIG no copilot-instructions.md
                // Mantemos apenas as instruções locais em .cappy/instructions

                progress.report({ increment: 85, message: 'Atualizando instruções do Copilot...' });

                // 5. Sempre atualizar .github/copilot-instructions.md a partir do template
                await this.refreshGithubCopilotInstructions(workspaceFolder.uri.fsPath);

                // 6. Atualizar .gitignore para manter instruções privadas
                await this.updateGitignore(workspaceFolder.uri.fsPath);

                // 6.1 Garantia final: certificar que config.yaml existe (resiliência a variações FS)
                try {
                    const cfgPath = path.join(cappyDir, 'config.yaml');
                    await fs.promises.access(cfgPath, fs.constants.F_OK);
                } catch {
                    const ext = vscode.extensions.getExtension('eduardocecon.cappy-memory');
                    const extVersion = ext?.packageJSON?.version || '0.0.0';
                    await this.createConfigYaml(cappyDir, extVersion);
                }

                // 6.2 Garantir .cappy/stack.md existe
                await this.ensureStackFile(cappyDir);

                progress.report({ increment: 100, message: 'Finalizado!' });

                vscode.window.showInformationMessage(
                    '🎉 Cappy inicializado com sucesso! Use "Cappy: Create New Task" para começar.'
                );

                // Write result to .cappy/output.txt
                writeOutputForced('Cappy inicializado com sucesso!');

                return true;
            });

        } catch (error) {
            const errorMsg = `Erro ao inicializar Cappy: ${error}`;
            vscode.window.showErrorMessage(errorMsg);
            writeOutputForced(errorMsg);
            return false;
        }
    }

    private async setupCappyDirectory(cappyDir: string): Promise<void> {
        try {
            // Verificar se .cappy já existe
            await fs.promises.access(cappyDir, fs.constants.F_OK);
            
            // Se existe, verificar se tem config.yaml
            const configPath = path.join(cappyDir, 'config.yaml');
            try {
                await fs.promises.access(configPath, fs.constants.F_OK);
                // Se config.yaml existe, estrutura está OK
                return;
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    // Não tem config.yaml, remover pasta toda e recriar (API moderna)
                    await fs.promises.rm(cappyDir, { recursive: true, force: true });
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        // Criar estrutura completa
        await fs.promises.mkdir(cappyDir, { recursive: true });
        await fs.promises.mkdir(path.join(cappyDir, 'tasks'), { recursive: true });
        await fs.promises.mkdir(path.join(cappyDir, 'history'), { recursive: true });
        await fs.promises.mkdir(path.join(cappyDir, 'instructions'), { recursive: true });
        
        // Criar arquivo prevention-rules.xml se não existir
        await this.ensurePreventionRulesFile(cappyDir);
    }

    private async createConfigYaml(cappyDir: string, extensionVersion: string): Promise<void> {
        const nowIso = new Date().toISOString();
        const templatePath = path.join(this.getExtensionRoot(), 'resources', 'templates', 'cappy-config.yaml');
        const cfgPath = path.join(cappyDir, 'config.yaml');

        // If config exists, update only version and last_updated to preserve user edits
        let exists = false;
        try {
            await fs.promises.access(cfgPath, fs.constants.F_OK);
            exists = true;
        } catch { /* ignore */ }

        if (exists) {
            try {
                let current = await fs.promises.readFile(cfgPath, 'utf8');
                const hasVersion = /^(\s*)version:\s*"?.+?"?\s*$/m.test(current);
                const hasLastUpdated = /^(\s*)last_updated:\s*.*$/m.test(current);
                // Replace version
                if (hasVersion) {
                    current = current.replace(/^(\s*)version:\s*"?.+?"?\s*$/m, `$1version: "${extensionVersion}"`);
                } else {
                    current = `version: "${extensionVersion}"\n` + current;
                }
                // Replace last_updated under cappy:
                current = current.replace(/(\bcappy:\s*[\s\S]*?\blast_updated:)\s*.*$/m, `$1 "${nowIso}"`);
                await fs.promises.writeFile(cfgPath, current, 'utf8');
                return;
            } catch {
                // fallthrough to recreate from template
            }
        }

        // Create from template
        let contentFromTemplate = '';
        try {
            const tpl = await fs.promises.readFile(templatePath, 'utf8');
            contentFromTemplate = tpl
                .replace(/__VERSION__/g, extensionVersion)
                .replace(/__INITIALIZED_AT__/g, nowIso)
                .replace(/__LAST_UPDATED__/g, nowIso);
        } catch (err: any) {
            if (err?.code !== 'ENOENT') {
                throw err;
            }
        }
        await fs.promises.writeFile(cfgPath, contentFromTemplate, 'utf8');
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
                vscode.window.showWarningMessage('⚠️ Não foi possível localizar resources/instructions. As instruções locais do Cappy não foram criadas.');
                // ignore and continue
            }
        }
        // Fallback to current working directory
        return process.cwd();
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

    private async refreshGithubCopilotInstructions(workspaceRoot: string): Promise<void> {
        const githubDir = path.join(workspaceRoot, '.github');
        const targetPath = path.join(githubDir, 'copilot-instructions.md');
        const templatePath = path.join(this.getExtensionRoot(), 'resources', 'templates', 'cappy-copilot-instructions.md');

        await fs.promises.mkdir(githubDir, { recursive: true });

        try {
            const tpl = await fs.promises.readFile(templatePath, 'utf8');
            const start = '<!-- CAPPY INI -->';
            const end = '<!-- CAPPY END -->';

            // If target doesn't exist, create with template
            let existing = '';
            try {
                existing = await fs.promises.readFile(targetPath, 'utf8');
            } catch (e: any) {
                if (e?.code === 'ENOENT') {
                    await fs.promises.writeFile(targetPath, tpl, 'utf8');
                    return;
                }
                throw e;
            }

            const hasStart = existing.includes(start);
            const hasEnd = existing.includes(end);
            
            if (!hasStart || !hasEnd) {
                // No markers; overwrite entire file to align with template once
                await fs.promises.writeFile(targetPath, tpl, 'utf8');
                return;
            }

            // Replace only the marked block
            const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
            
            // Extract content between markers from template
            const templatePattern = new RegExp(`${start}([\\s\\S]*?)${end}`);
            const templateMatch = tpl.match(templatePattern);
            const templateContent = templateMatch ? templateMatch[1].trim() : tpl.trim();
            
            // Replace with markers preserved
            const replacement = `${start}\n${templateContent}\n${end}`;
            const updated = existing.replace(pattern, replacement);
            await fs.promises.writeFile(targetPath, updated, 'utf8');
        } catch (err: any) {
            if (err?.code === 'ENOENT') {
                // If template is missing, keep existing file or create a minimal header
                try {
                    await fs.promises.access(targetPath, fs.constants.F_OK);
                } catch {
                    await fs.promises.writeFile(targetPath, '# Cappy Copilot Instructions\n', 'utf8');
                }
            } else {
                throw err;
            }
        }
    }

    private async ensureStackFile(cappyDir: string): Promise<void> {
        const stackPath = path.join(cappyDir, 'stack.md');
        try {
            await fs.promises.access(stackPath, fs.constants.F_OK);
        } catch {
            await fs.promises.writeFile(stackPath, '', 'utf8');
        }
    }

    private async ensurePreventionRulesFile(cappyDir: string): Promise<void> {
        const preventionRulesPath = path.join(cappyDir, 'prevention-rules.xml');
        try {
            await fs.promises.access(preventionRulesPath, fs.constants.F_OK);
        } catch {
            const templatePath = path.join(this.getExtensionRoot(), 'resources', 'templates', 'prevention-rules.xml');
            try {
                const templateContent = await fs.promises.readFile(templatePath, 'utf8');
                await fs.promises.writeFile(preventionRulesPath, templateContent, 'utf8');
            } catch {
                // Fallback: criar arquivo vazio se template não for encontrado
                const defaultContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="0">
  <!-- Prevention rules will be added here -->
</prevention-rules>`;
                await fs.promises.writeFile(preventionRulesPath, defaultContent, 'utf8');
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

        const header = '# Cappy specific - ignore only runtime files';
        const entries = [
            '.cappy/history/',
            '.cappy/tasks/',
            '.cappy/output.txt'
        ];

        let changed = false;
        
        // Remove old Cappy entries if they exist
        const oldPatterns = [
            '# Cappy - Private AI Instructions',
            '.github/copilot-instructions.md',
            '.cappy/',
            '# Cappy specific (Personal Development)'
        ];
        
        for (const pattern of oldPatterns) {
            if (content.includes(pattern)) {
                content = content.replace(new RegExp(`^.*${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'gm'), '');
                changed = true;
            }
        }

        // Clean up empty lines
        if (changed) {
            content = content.replace(/\n\n\n+/g, '\n\n').trim();
        }

        // Add new header and entries if not present
        if (!content.includes(header)) {
            const newSection = `\n\n${header}\n${entries.join('\n')}`;
            content = content ? `${content}${newSection}` : `${header}\n${entries.join('\n')}`;
            changed = true;
        } else {
            // Check if all entries are present
            for (const entry of entries) {
                if (!content.includes(entry)) {
                    // Find the header and add the missing entry
                    const headerIndex = content.indexOf(header);
                    if (headerIndex !== -1) {
                        const afterHeader = content.substring(headerIndex + header.length);
                        const nextSectionIndex = afterHeader.search(/^#/m);
                        const insertIndex = nextSectionIndex === -1 
                            ? content.length 
                            : headerIndex + header.length + nextSectionIndex;
                        
                        content = content.substring(0, insertIndex) + `\n${entry}` + content.substring(insertIndex);
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            await fs.promises.writeFile(gitignorePath, content, 'utf8');
        }
    }   
}
