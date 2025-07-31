import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { FileManager } from '../utils/fileManager';
import { ForgeConfig, DEFAULT_FORGE_CONFIG } from '../models/forgeConfig';

export class InitForgeCommand {
    constructor(
        private fileManager: FileManager
    ) {}

    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const openFolder = await vscode.window.showInformationMessage(
                    '� FORGE Framework precisa de uma pasta de projeto para ser inicializado.\n\nAbra uma pasta primeiro e depois execute "FORGE: Initialize" novamente.',
                    'Abrir Pasta', 'Cancelar'
                );
                
                if (openFolder === 'Abrir Pasta') {
                    try {
                        await vscode.commands.executeCommand('vscode.openFolder');
                    } catch (error) {
                        // Silently handle error - user can open folder manually
                        vscode.window.showInformationMessage('Por favor, abra uma pasta manualmente via File > Open Folder');
                    }
                }
                return false;
            }

            const forgeDir = path.join(workspaceFolder.uri.fsPath, '.forge');
            const githubDir = path.join(workspaceFolder.uri.fsPath, '.github');

            // Verificar se já existe
            if (await fs.pathExists(forgeDir)) {
                const overwrite = await vscode.window.showWarningMessage(
                    '⚠️ FORGE já foi inicializado neste projeto. Sobrescrever?',
                    'Sim', 'Não'
                );
                if (overwrite !== 'Sim') {
                    return false;
                }
            }

            // Mostrar progresso
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔨 Inicializando FORGE Framework',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: 'Criando estrutura...' });
                
                // 1. Criar estrutura básica
                await fs.ensureDir(forgeDir);
                await fs.ensureDir(githubDir);
                await fs.ensureDir(path.join(forgeDir, 'history'));

                progress.report({ increment: 20, message: 'Coletando informações do projeto...' });

                // 2. Coletar informações do projeto
                const projectInfo = await this.collectProjectInfo(workspaceFolder.uri.fsPath);

                progress.report({ increment: 40, message: 'Configurando FORGE...' });

                // 3. Criar configuração
                const config: ForgeConfig = {
                    version: DEFAULT_FORGE_CONFIG.version || '1.0.0',
                    project: {
                        name: projectInfo.name,
                        language: projectInfo.languages || [projectInfo.language || 'unknown'],
                        framework: projectInfo.framework || [],
                        description: projectInfo.description
                    },
                    stack: DEFAULT_FORGE_CONFIG.stack!,
                    environment: DEFAULT_FORGE_CONFIG.environment!,
                    context: DEFAULT_FORGE_CONFIG.context!,
                    tasks: DEFAULT_FORGE_CONFIG.tasks!,
                    ai: DEFAULT_FORGE_CONFIG.ai!,
                    analytics: DEFAULT_FORGE_CONFIG.analytics!,
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };

                progress.report({ increment: 60, message: 'Criando arquivos de configuração...' });

                // 4. Salvar configuração
                await this.fileManager.writeForgeConfig(config);

                progress.report({ increment: 80, message: 'Criando instruções para Copilot...' });

                // 5. Criar instruções personalizadas para Copilot
                await this.createCopilotInstructions(config, githubDir, projectInfo);

                // 6. Criar arquivo de prevention rules
                await this.createInitialPreventionRules(forgeDir);

                // 7. Adicionar ao .gitignore
                await this.updateGitignore(workspaceFolder.uri.fsPath);

                progress.report({ increment: 100, message: 'Finalizado!' });

                vscode.window.showInformationMessage(
                    '🎉 FORGE Framework inicializado com sucesso! Use "FORGE: Start Activity" para começar.'
                );

                return true;
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao inicializar FORGE: ${error}`);
            return false;
        }
    }

    private async collectProjectInfo(workspacePath: string): Promise<any> {
        const projectName = path.basename(workspacePath);
        
        // Detectar linguagens
        const languages = await this.detectLanguages(workspacePath);
        
        // Detectar frameworks
        const frameworks = await this.detectFrameworks(workspacePath);

        return {
            name: projectName,
            description: `Projeto ${projectName} - Desenvolvimento solo com FORGE`,
            language: languages.length > 0 ? languages[0] : 'unknown',
            languages: languages,
            framework: frameworks,
            type: this.inferProjectType(languages, frameworks)
        };
    }

    private async detectLanguages(workspacePath: string): Promise<string[]> {
        const languages: string[] = [];
        
        // Verificar arquivos comuns
        if (await fs.pathExists(path.join(workspacePath, 'package.json'))) {
            languages.push('javascript');
            
            // Verificar se é TypeScript
            if (await fs.pathExists(path.join(workspacePath, 'tsconfig.json')) ||
                await this.hasFilesWithExtension(workspacePath, '.ts')) {
                languages.push('typescript');
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
            if (await fs.pathExists(packageJsonPath)) {
                const packageJson = await fs.readJson(packageJsonPath);
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                if (deps['react']) { frameworks.push('react'); }
                if (deps['next']) { frameworks.push('nextjs'); }
                if (deps['vue']) { frameworks.push('vue'); }
                if (deps['@angular/core']) { frameworks.push('angular'); }
                if (deps['express']) { frameworks.push('express'); }
                if (deps['vscode']) { frameworks.push('vscode-extension'); }
            }
        } catch (error) {
            // Ignore errors
        }
        
        return frameworks;
    }

    private async hasFilesWithExtension(dirPath: string, extension: string): Promise<boolean> {
        try {
            const files = await fs.readdir(dirPath);
            return files.some(file => file.endsWith(extension));
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

    private async createCopilotInstructions(config: ForgeConfig, githubDir: string, projectInfo: any): Promise<void> {
        const instructionsPath = path.join(githubDir, 'copilot-instructions.md');
        
        const instructions = `# 🔨 FORGE Framework - Instruções para GitHub Copilot

## 📋 **CONTEXTO DO PROJETO**
- **Projeto**: ${config.project.name}
- **Tipo**: ${projectInfo.type}
- **Linguagem Principal**: ${config.project.language}
- **Frameworks**: ${config.project.framework?.join(', ') || 'Nenhum detectado'}

## 🎯 **METODOLOGIA FORGE**
Este projeto usa a metodologia FORGE (Focus, Organize, Record, Grow, Evolve) para desenvolvimento solo:

### **Princípios:**
1. **Tarefas Atômicas**: Máximo 2-3 horas por STEP
2. **Aprendizado Contínuo**: Cada erro vira uma prevention rule
3. **Contexto Preservado**: AI sempre informada do estado atual
4. **Documentação Mínima**: Só o essencial que economiza tempo

### **Prevention Rules Ativas:**
*As regras serão carregadas automaticamente do arquivo .forge/prevention-rules.md*

## 🛠️ **INSTRUÇÕES ESPECÍFICAS**

### **Para este projeto:**
- Sempre verificar prevention rules antes de sugerir código
- Manter consistência com o padrão de arquivos existente  
- Focar em soluções simples e diretas
- Documentar problemas encontrados para criar novas rules

### **Comandos FORGE disponíveis:**
- \`FORGE: Start Activity\` - Iniciar nova tarefa
- \`FORGE: Complete Activity\` - Finalizar tarefa atual
- \`FORGE: Add Prevention Rule\` - Documentar erro/problema
- \`FORGE: View History\` - Ver histórico de atividades

---
*Este arquivo é privado e não deve ser commitado. Ele contém suas instruções personalizadas para o GitHub Copilot.*
`;

        await fs.writeFile(instructionsPath, instructions, 'utf8');
    }

    private async createInitialPreventionRules(forgeDir: string): Promise<void> {
        const rulesPath = path.join(forgeDir, 'prevention-rules.md');
        
        const initialRules = `# 🛡️ Prevention Rules

> Regras acumuladas de erros e padrões específicos deste projeto.

## 📝 **Como usar:**
1. Quando encontrar um erro/problema, documente aqui
2. Use o comando "FORGE: Add Prevention Rule" para facilitar
3. As regras são automaticamente incluídas no contexto do Copilot

---

## 🏗️ **Regras Gerais**

### [SETUP] Inicialização do FORGE
**Context:** Ao inicializar FORGE pela primeira vez  
**Problem:** Usuário pode não entender os próximos passos  
**Solution:** Sempre mostrar as opções disponíveis após inicialização  
**Example:** Usar "FORGE: Start Activity" para começar primeira tarefa  

---

*⚡ Máximo de 15 regras para manter contexto enxuto e eficaz*
`;

        await fs.writeFile(rulesPath, initialRules, 'utf8');
    }

    private async updateGitignore(workspacePath: string): Promise<void> {
        const gitignorePath = path.join(workspacePath, '.gitignore');
        const forgeEntries = [
            '',
            '# FORGE Framework - Private AI Instructions',
            '.github/copilot-instructions.md',
            ''
        ].join('\n');

        try {
            let gitignoreContent = '';
            if (await fs.pathExists(gitignorePath)) {
                gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
            }

            // Verificar se já tem as entradas
            if (!gitignoreContent.includes('.github/copilot-instructions.md')) {
                gitignoreContent += forgeEntries;
                await fs.writeFile(gitignorePath, gitignoreContent, 'utf8');
            }
        } catch (error) {
            // Ignorar erros do .gitignore
        }
    }
}
