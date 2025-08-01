import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CompleteActivityCommand {
    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const openFolder = await vscode.window.showInformationMessage(
                    '📁 Capybara precisa de uma pasta de projeto para completar atividades.\n\nAbra uma pasta primeiro.',
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
            const currentActivityPath = path.join(forgeDir, 'current-activity.md');
            const historyDir = path.join(forgeDir, 'history');

            // Verificar se existe atividade atual
            try {
                await fs.promises.access(currentActivityPath, fs.constants.F_OK);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    vscode.window.showWarningMessage('Nenhuma atividade em andamento encontrada.');
                    return false;
                }
                throw error;
            }

            const content = await fs.promises.readFile(currentActivityPath, 'utf8');
            if (!content.trim() || content.includes('# Atividade: [Vazio]')) {
                vscode.window.showWarningMessage('Não há atividade ativa para completar.');
                return false;
            }

            // Extrair nome da atividade do conteúdo
            const activityNameMatch = content.match(/# Atividade: (.+)/);
            const activityName = activityNameMatch?.[1] || 'Atividade-sem-nome';

            // Verificar se atividade está realmente completa
            const isComplete = await this.checkActivityCompletion(content);
            if (!isComplete) {
                const proceed = await vscode.window.showWarningMessage(
                    'A atividade parece não estar completa. Deseja finalizar mesmo assim?',
                    'Sim', 'Não'
                );
                if (proceed !== 'Sim') {
                    return false;
                }
            }

            // Extrair prevention rules das dificuldades
            await this.extractPreventionRules(content, forgeDir);

            // Mover para histórico
            await this.moveToHistory(currentActivityPath, historyDir, activityName);

            // Limpar arquivo atual
            await this.createEmptyActivityFile(currentActivityPath);

            vscode.window.showInformationMessage(`✅ Atividade "${activityName}" completada e movida para o histórico!`);
            return true;

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao completar atividade: ${error}`);
            return false;
        }
    }

    private async checkActivityCompletion(content: string): Promise<boolean> {
        // Verificar se há itens marcados como concluídos
        const checkedItems = (content.match(/- \[x\]/gi) || []).length;
        const totalItems = (content.match(/- \[ \]/gi) || []).length + checkedItems;
        
        return totalItems > 0 && (checkedItems / totalItems) >= 0.5; // Pelo menos 50% concluído
    }

    private async extractPreventionRules(content: string, forgeDir: string): Promise<void> {
        const difficultiesMatch = content.match(/## ⚠️ Dificuldades Encontradas\s*([\s\S]*?)(?=\n##|\n---|$)/);
        
        if (difficultiesMatch && difficultiesMatch[1].trim()) {
            const difficulties = difficultiesMatch[1].trim();
            
            // Converter dificuldades em prevention rules
            const rules = this.convertDifficultiesToRules(difficulties);
            
            if (rules.length > 0) {
                await this.appendPreventionRules(forgeDir, rules);
                vscode.window.showInformationMessage(`📚 ${rules.length} nova(s) prevention rule(s) extraída(s)!`);
            }
        }
    }

    private convertDifficultiesToRules(difficulties: string): string[] {
        const rules: string[] = [];
        const lines = difficulties.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            if (line.includes('erro') || line.includes('problema') || line.includes('dificuldade')) {
                // Tentar extrair uma regra da dificuldade
                const rule = this.generateRuleFromDifficulty(line);
                if (rule && !this.isDuplicateRule(rule, rules)) {
                    rules.push(rule);
                }
            }
        }
        
        return rules;
    }

    private generateRuleFromDifficulty(difficulty: string): string | null {
        // Patterns comuns para converter dificuldades em regras
        const patterns = [
            { 
                regex: /não.*funcio.*|erro.*|falha.*|problema.*/i, 
                template: (match: string) => `❌ DON'T: ${match.toLowerCase()} → sempre verificar/testar antes`
            },
            { 
                regex: /esqueci.*|não.*lembr.*/i, 
                template: (match: string) => `❌ DON'T forget: ${match.toLowerCase()} → adicionar ao checklist`
            }
        ];

        for (const pattern of patterns) {
            if (pattern.regex.test(difficulty)) {
                return pattern.template(difficulty.trim());
            }
        }

        // Regra genérica se não matchear patterns específicos
        if (difficulty.length > 10 && difficulty.length < 200) {
            return `❌ ATENÇÃO: ${difficulty.trim()}`;
        }

        return null;
    }

    private isDuplicateRule(newRule: string, existingRules: string[]): boolean {
        return existingRules.some(rule => 
            rule.toLowerCase().includes(newRule.toLowerCase().substring(0, 30)) ||
            newRule.toLowerCase().includes(rule.toLowerCase().substring(0, 30))
        );
    }

    private async appendPreventionRules(forgeDir: string, rules: string[]): Promise<void> {
        const preventionRulesPath = path.join(forgeDir, 'prevention-rules.md');
        
        let content = '';
        try {
            await fs.promises.access(preventionRulesPath, fs.constants.F_OK);
            content = await fs.promises.readFile(preventionRulesPath, 'utf8');
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                content = `# Prevention Rules - ${new Date().toLocaleDateString('pt-BR')}

## 📚 Como usar
Este arquivo acumula lições aprendidas. Máximo 15 regras para manter foco.

## 🚨 Regras Ativas

`;
            } else {
                throw error;
            }
        }

        // Adicionar novas regras sem duplicatas
        const timestamp = new Date().toLocaleDateString('pt-BR');
        const newRulesSection = rules.map(rule => 
            `### ${rule}\n**Fonte**: Atividade completada em ${timestamp}\n`
        ).join('\n');

        content += '\n' + newRulesSection;

        await fs.promises.writeFile(preventionRulesPath, content, 'utf8');
    }

    private async moveToHistory(currentActivityPath: string, historyDir: string, activityName: string): Promise<void> {
        // Ensure history directory exists
        try {
            await fs.promises.mkdir(historyDir, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const slug = activityName.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
        
        const historyFileName = `${timestamp}-${slug}.md`;
        const historyFilePath = path.join(historyDir, historyFileName);

        // Move file by copying and then deleting original
        const content = await fs.promises.readFile(currentActivityPath, 'utf8');
        await fs.promises.writeFile(historyFilePath, content, 'utf8');
        await fs.promises.unlink(currentActivityPath);
    }

    private async createEmptyActivityFile(filePath: string): Promise<void> {
        const emptyContent = `# Atividade: [Vazio]

> Nenhuma atividade em andamento.
> Use **FORGE: Start Activity** para iniciar uma nova atividade.

---
*Aguardando nova atividade...*
`;

        await fs.promises.writeFile(filePath, emptyContent, 'utf8');
    }
}
