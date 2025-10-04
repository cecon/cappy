import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { writeOutputForced } from '../utils/outputWriter';
import { FileManager } from '../utils/fileManager';

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

                // 6.3 Copiar XSD schemas para .cappy/schemas/
                progress.report({ increment: 85, message: 'Copiando schemas XSD...' });
                try {
                    console.log('[initCappy] Starting XSD copy process...');
                    const fileManager = new FileManager();
                    console.log('[initCappy] FileManager created, calling copyXsdSchemas...');
                    await fileManager.copyXsdSchemas();
                    console.log('[initCappy] XSD copy completed successfully');
                } catch (xsdError) {
                    console.error('[initCappy] Error copying XSD schemas during init:', xsdError);
                    // Don't fail the entire init process if XSD copy fails
                }

                // 6.4 Configurar estrutura Mini-LightRAG
                progress.report({ increment: 92, message: 'Configurando Mini-LightRAG...' });
                try {
                    console.log('[initCappy] Starting Mini-LightRAG setup...');
                    await this.setupMiniLightRAG();
                    console.log('[initCappy] Mini-LightRAG setup completed successfully');
                } catch (lightragError) {
                    console.error('[initCappy] Error setting up Mini-LightRAG:', lightragError);
                    // Don't fail the entire init process if Mini-LightRAG setup fails
                }

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
                    // Se não tem config.yaml, apenas criar os diretórios necessários
                    // NÃO remove a pasta inteira para preservar dados do usuário
                    await fs.promises.mkdir(path.join(cappyDir, 'tasks'), { recursive: true });
                    await fs.promises.mkdir(path.join(cappyDir, 'history'), { recursive: true });
                    await fs.promises.mkdir(path.join(cappyDir, 'schemas'), { recursive: true });
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // Criar estrutura completa apenas se .cappy não existir
            await fs.promises.mkdir(cappyDir, { recursive: true });
            await fs.promises.mkdir(path.join(cappyDir, 'tasks'), { recursive: true });
            await fs.promises.mkdir(path.join(cappyDir, 'history'), { recursive: true });
            await fs.promises.mkdir(path.join(cappyDir, 'schemas'), { recursive: true });
        }
        
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

    /**
     * Configura estrutura Mini-LightRAG para busca híbrida
     * Cria diretórios para LanceDB, embeddings e UI de grafo
     */
    private async setupMiniLightRAG(): Promise<void> {
        if (!this.extensionContext) {
            console.log('[setupMiniLightRAG] ExtensionContext not available, skipping Mini-LightRAG setup');
            return;
        }

        // Verificar se estrutura já existe
        const globalStoragePath = this.extensionContext.globalStorageUri.fsPath;
        const miniLightRagPath = path.join(globalStoragePath, 'mini-lightrag');
        
        try {
            await fs.promises.access(miniLightRagPath, fs.constants.F_OK);
            console.log('[setupMiniLightRAG] Mini-LightRAG structure already exists, skipping creation');
            return;
        } catch {
            // Não existe, vamos criar
        }

        // Criar estrutura de diretórios para Mini-LightRAG
        const directories = [
            miniLightRagPath,
            path.join(miniLightRagPath, 'chunks'),    // Coleção principal de chunks  
            path.join(miniLightRagPath, 'nodes'),     // Nós do grafo
            path.join(miniLightRagPath, 'edges'),     // Arestas do grafo
            path.join(miniLightRagPath, 'indexes'),   // Índices HNSW/IVF
            path.join(miniLightRagPath, 'models'),    // Cache de modelos de embedding
            path.join(miniLightRagPath, 'temp')       // Arquivos temporários
        ];

        for (const dir of directories) {
            await fs.promises.mkdir(dir, { recursive: true });
            console.log(`[setupMiniLightRAG] Created directory: ${dir}`);
        }

        // Criar arquivo de configuração inicial
        const configPath = path.join(miniLightRagPath, 'config.json');
        const config = {
            version: "1.0.0",
            created: new Date().toISOString(),
            embedding: {
                model: "all-MiniLM-L6-v2",
                dimensions: 384,
                normalize: true
            },
            lancedb: {
                collections: {
                    chunks: "chunks",
                    nodes: "nodes", 
                    edges: "edges"
                }
            },
            graph: {
                maxNodes: 5000,
                maxEdges: 10000,
                expandHops: 1
            },
            query: {
                defaultTopK: 20,
                maxResults: 200,
                timeout: 2000
            }
        };

        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log(`[setupMiniLightRAG] Created config: ${configPath}`);

        // Criar arquivo README.md explicativo
        const readmePath = path.join(miniLightRagPath, 'README.md');
        const readmeContent = `# Mini-LightRAG Storage

Esta pasta contém os dados do sistema de busca híbrida Mini-LightRAG.

## Estrutura

- \`chunks/\` - Dados principais de chunks indexados (LanceDB)
- \`nodes/\` - Nós do grafo de conhecimento
- \`edges/\` - Arestas/relacionamentos do grafo  
- \`indexes/\` - Índices vetoriais HNSW/IVF
- \`models/\` - Cache de modelos de embedding
- \`temp/\` - Arquivos temporários de processamento

## Configuração

Veja \`config.json\` para parâmetros do sistema.

## Gerado em

${new Date().toISOString()} pela extensão Cappy v${vscode.extensions.getExtension('eduardocecon.cappy-memory')?.packageJSON?.version || '0.0.0'}
`;

        await fs.promises.writeFile(readmePath, readmeContent, 'utf8');
        console.log(`[setupMiniLightRAG] Created README: ${readmePath}`);

        console.log('[setupMiniLightRAG] Mini-LightRAG setup completed successfully');
    }   
}
