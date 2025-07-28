import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';

export class StartActivityCommand {
    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Nenhum workspace aberto.');
                return false;
            }

            const forgeDir = path.join(workspaceFolder.uri.fsPath, '.forge');
            const currentActivityPath = path.join(forgeDir, 'current-activity.md');

            // Verificar se já existe atividade em andamento
            if (await fs.pathExists(currentActivityPath)) {
                const content = await fs.readFile(currentActivityPath, 'utf8');
                if (content.trim() && !content.includes('# Atividade: [Vazio]')) {
                    const overwrite = await vscode.window.showWarningMessage(
                        'Já existe uma atividade em andamento. Deseja sobrescrever?',
                        'Sim', 'Não'
                    );
                    if (overwrite !== 'Sim') {
                        return false;
                    }
                }
            }

            // Obter nome da atividade
            const activityName = await vscode.window.showInputBox({
                prompt: 'Nome da atividade:',
                placeHolder: 'Ex: Implementar autenticação de usuário'
            });

            if (!activityName) {
                return false;
            }

            // Analisar contexto do projeto
            await this.analyzeProjectContext(workspaceFolder.uri.fsPath);

            // Fazer perguntas de clarificação
            const clarifications = await this.askClarificationQuestions(activityName);
            if (!clarifications) {
                return false;
            }

            // Criar arquivo de atividade
            await this.createActivityFile(currentActivityPath, activityName, clarifications);

            // Abrir arquivo para edição
            const doc = await vscode.workspace.openTextDocument(currentActivityPath);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage(`🎯 Atividade "${activityName}" iniciada!`);
            return true;

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao iniciar atividade: ${error}`);
            return false;
        }
    }

    private async analyzeProjectContext(workspacePath: string): Promise<string> {
        const analysis = [];
        
        // Analisar estrutura de pastas principais
        const mainDirs = ['src', 'app', 'lib', 'components', 'models', 'controllers', 'services'];
        for (const dir of mainDirs) {
            const dirPath = path.join(workspacePath, dir);
            if (await fs.pathExists(dirPath)) {
                analysis.push(`📁 Pasta encontrada: ${dir}/`);
            }
        }

        // Verificar arquivos de configuração
        const configFiles = ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml'];
        for (const file of configFiles) {
            const filePath = path.join(workspacePath, file);
            if (await fs.pathExists(filePath)) {
                analysis.push(`⚙️ Configuração: ${file}`);
                
                // Detectar tecnologias específicas
                if (file === 'package.json') {
                    try {
                        const content = await fs.readFile(filePath, 'utf8');
                        const pkg = JSON.parse(content);
                        if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
                            analysis.push('🔧 TypeScript project detected');
                        }
                        if (pkg.engines?.vscode || pkg.main?.includes('extension')) {
                            analysis.push('🧩 VS Code extension detected');
                        }
                    } catch (error) {
                        // Ignore parsing errors
                    }
                }
            }
        }

        // Mostrar análise no canal de output
        const outputChannel = vscode.window.createOutputChannel('FORGE - Análise do Projeto');
        outputChannel.clear();
        outputChannel.appendLine('🔍 ANÁLISE DO CONTEXTO DO PROJETO\n');
        analysis.forEach(item => outputChannel.appendLine(item));
        outputChannel.appendLine('\n📋 Use estas informações para responder às perguntas de clarificação.');
        outputChannel.show();

        return analysis.join('\n');
    }

    private async askClarificationQuestions(activityName: string): Promise<Record<string, string> | null> {
        const questions = this.generateClarificationQuestions(activityName);
        const answers: Record<string, string> = {};

        for (const question of questions) {
            const answer = await vscode.window.showInputBox({
                prompt: question,
                placeHolder: 'Digite sua resposta...'
            });

            if (!answer) {
                vscode.window.showWarningMessage('Perguntas de clarificação são obrigatórias.');
                return null;
            }

            answers[question] = answer;
        }

        return answers;
    }

    private generateClarificationQuestions(activityName: string): string[] {
        const baseQuestions = [
            'Qual é o escopo exato desta atividade? (o que deve ser entregue)',
            'Quais são os critérios de aceitação principais?',
            'Há dependências ou pré-requisitos específicos?'
        ];

        // Adicionar perguntas específicas baseadas no nome da atividade
        if (activityName.toLowerCase().includes('auth') || activityName.toLowerCase().includes('login')) {
            baseQuestions.push('Que tipo de autenticação? (JWT, OAuth, sessão, etc.)');
            baseQuestions.push('Quais validações de segurança são necessárias?');
        } else if (activityName.toLowerCase().includes('api') || activityName.toLowerCase().includes('endpoint')) {
            baseQuestions.push('Quais endpoints serão criados? (GET, POST, PUT, DELETE)');
            baseQuestions.push('Qual formato de resposta esperado? (JSON, XML, etc.)');
        } else if (activityName.toLowerCase().includes('database') || activityName.toLowerCase().includes('db') || 
                   activityName.toLowerCase().includes('banco')) {
            baseQuestions.push('Quais tabelas/modelos serão afetados?');
            baseQuestions.push('Que tipo de relacionamentos existem?');
        } else {
            baseQuestions.push('Que arquivos/componentes serão modificados?');
            baseQuestions.push('Há padrões específicos do projeto a seguir?');
        }

        return baseQuestions.slice(0, 5); // Máximo 5 perguntas
    }

    private createActivityTemplate(activityName: string, clarifications: Map<string, string>): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        let content = `# Atividade: ${activityName}

**Iniciada em:** ${new Date().toLocaleString('pt-BR')}
**ID:** ${timestamp}

## 📋 Descrição
[Descreva brevemente o que será implementado nesta atividade]

## 🎯 Critérios de Aceitação
- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3

## 📝 Passo a Passo
1. [ ] Primeiro passo
2. [ ] Segundo passo
3. [ ] Terceiro passo

## 🧪 Testes Unitários
- [ ] Teste 1: [Descrição]
- [ ] Teste 2: [Descrição]

## 🔧 Dificuldades Encontradas
[Documentar problemas encontrados durante a implementação]

## 📚 Perguntas de Clarificação

`;

        // Adicionar respostas das perguntas de clarificação
        clarifications.forEach((answer, question) => {
            content += `**${question}**\n${answer}\n\n`;
        });

        content += `---
*Atividade gerenciada pelo FORGE Framework*
`;
        
        return content;
    }

    private async createActivityFile(filePath: string, activityName: string, clarifications: Record<string, string>): Promise<void> {
        // Converter Record para Map para usar com o template
        const clarificationMap = new Map<string, string>();
        Object.entries(clarifications).forEach(([key, value]) => {
            clarificationMap.set(key, value);
        });

        const content = this.createActivityTemplate(activityName, clarificationMap);
        
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
    }

}
