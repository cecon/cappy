import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from '../utils/fileManager';
import { CapybaraConfig, DEFAULT_CAPYBARA_CONFIG } from '../models/capybaraConfig';

export class InitCapybaraCommand {
    constructor(
        private fileManager: FileManager
    ) {}

    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const openFolder = await vscode.window.showInformationMessage(
                    '� Capybara precisa de uma pasta de projeto para ser inicializado.\n\nAbra uma pasta primeiro e depois execute "Capybara: Initialize" novamente.',
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

            const capyDir = path.join(workspaceFolder.uri.fsPath, '.capy');
            const githubDir = path.join(workspaceFolder.uri.fsPath, '.github');

            // Verificar se já existe
            try {
                await fs.promises.access(capyDir, fs.constants.F_OK);
                const overwrite = await vscode.window.showWarningMessage(
                    '⚠️ Capybara já foi inicializado neste projeto. Sobrescrever?',
                    'Sim', 'Não'
                );
                if (overwrite !== 'Sim') {
                    return false;
                }
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            // Mostrar progresso
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔨 Inicializando Capybara',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: 'Criando estrutura...' });
                
                // 1. Criar estrutura básica
                await fs.promises.mkdir(capyDir, { recursive: true });
                await fs.promises.mkdir(githubDir, { recursive: true });
                await fs.promises.mkdir(path.join(capyDir, 'history'), { recursive: true });

                progress.report({ increment: 20, message: 'Coletando informações do projeto...' });

                // 2. Coletar informações do projeto
                const projectInfo = await this.collectProjectInfo(workspaceFolder.uri.fsPath);

                progress.report({ increment: 40, message: 'Configurando Capybara...' });

                // 3. Criar configuração
                const config: CapybaraConfig = {
                    version: DEFAULT_CAPYBARA_CONFIG.version || '1.0.0',
                    project: {
                        name: projectInfo.name,
                        language: projectInfo.languages || [projectInfo.language || 'unknown'],
                        framework: projectInfo.framework || [],
                        description: projectInfo.description
                    },
                    stack: DEFAULT_CAPYBARA_CONFIG.stack!,
                    environment: DEFAULT_CAPYBARA_CONFIG.environment!,
                    context: DEFAULT_CAPYBARA_CONFIG.context!,
                    tasks: DEFAULT_CAPYBARA_CONFIG.tasks!,
                    ai: DEFAULT_CAPYBARA_CONFIG.ai!,
                    analytics: DEFAULT_CAPYBARA_CONFIG.analytics!,
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };

                progress.report({ increment: 60, message: 'Criando arquivos de configuração...' });

                // 4. Salvar configuração
                await this.fileManager.writeCapybaraConfig(config);

                progress.report({ increment: 80, message: 'Criando instruções para Copilot...' });

                // 5. Criar instruções personalizadas para Copilot
                await this.createCopilotInstructions(config, githubDir, projectInfo);

                // 6. Criar arquivo de prevention rules
                await this.createInitialPreventionRules(capyDir);

                // 7. Adicionar ao .gitignore
                await this.updateGitignore(workspaceFolder.uri.fsPath);

                progress.report({ increment: 100, message: 'Finalizado!' });

                vscode.window.showInformationMessage(
                    '🎉 Capybara inicializado com sucesso! Use "Capybara: Start Activity" para começar.'
                );

                return true;
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao inicializar Capybara: ${error}`);
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

    private async createCopilotInstructions(config: CapybaraConfig, githubDir: string, projectInfo: any): Promise<void> {
        const instructionsPath = path.join(githubDir, 'copilot-instructions.md');
        
        const instructions = `# 🔨 Capybara - Instruções para GitHub Copilot

## 📋 **CONTEXTO DO PROJETO**
- **Projeto**: ${config.project.name}
- **Tipo**: ${projectInfo.type}
- **Linguagem Principal**: ${config.project.language}
- **Frameworks**: ${config.project.framework?.join(', ') || 'Nenhum detectado'}

## 🎯 **METODOLOGIA Capybara**
Este projeto usa a metodologia Capybara (Focus, Organize, Record, Grow, Evolve) para desenvolvimento solo:

### **Princípios:**
1. **Tarefas Atômicas**: Máximo 2-3 horas por STEP
2. **Aprendizado Contínuo**: Cada erro vira uma prevention rule
3. **Contexto Preservado**: AI sempre informada do estado atual
4. **Documentação Mínima**: Só o essencial que economiza tempo

### **Prevention Rules Ativas:**
*As regras serão carregadas automaticamente do arquivo .capy/prevention-rules.md*

## 🛠️ **INSTRUÇÕES ESPECÍFICAS**

### **Para este projeto:**
- Sempre verificar prevention rules antes de sugerir código
- Manter consistência com o padrão de arquivos existente  
- Focar em soluções simples e diretas
- Documentar problemas encontrados para criar novas rules

### **Comandos Capybara disponíveis:**
- \`Capybara: Start Activity\` - Iniciar nova tarefa
- \`Capybara: Complete Activity\` - Finalizar tarefa atual
- \`Capybara: Add Prevention Rule\` - Documentar erro/problema
- \`Capybara: View History\` - Ver histórico de atividades

---
*Este arquivo é privado e não deve ser commitado. Ele contém suas instruções personalizadas para o GitHub Copilot.*
`;

        await fs.promises.writeFile(instructionsPath, instructions, 'utf8');
    }

    private async createInitialPreventionRules(capyDir: string): Promise<void> {
        const rulesPath = path.join(capyDir, 'prevention-rules.md');
        
        const initialRules = `# 🛡️ Prevention Rules

> Regras acumuladas de erros e padrões específicos deste projeto.

## 📝 **Como usar:**
1. Quando encontrar um erro/problema, documente aqui
2. Use o comando "Capybara: Add Prevention Rule" para facilitar
3. As regras são automaticamente incluídas no contexto do Copilot

---

## 🏗️ **Regras Gerais**

### [SETUP] Inicialização do Capybara
**Context:** Ao inicializar Capybara pela primeira vez  
**Problem:** Usuário pode não entender os próximos passos  
**Solution:** Sempre mostrar as opções disponíveis após inicialização  
**Example:** Usar "Capybara: Start Activity" para começar primeira tarefa  

---

*⚡ Máximo de 15 regras para manter contexto enxuto e eficaz*
`;

        await fs.promises.writeFile(rulesPath, initialRules, 'utf8');
    }

    private async updateGitignore(workspacePath: string): Promise<void> {
        const gitignorePath = path.join(workspacePath, '.gitignore');
        const capybaraEntries = [
            '',
            '# Capybara - Private AI Instructions',
            '.github/copilot-instructions.md',
            ''
        ].join('\n');

        try {
            let gitignoreContent = '';
            try {
                await fs.promises.access(gitignorePath, fs.constants.F_OK);
                gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            // Verificar se já tem as entradas
            if (!gitignoreContent.includes('.github/copilot-instructions.md')) {
                gitignoreContent += capybaraEntries;
                await fs.promises.writeFile(gitignorePath, gitignoreContent, 'utf8');
            }
        } catch (error) {
            // Ignorar erros do .gitignore
        }
    }
}
