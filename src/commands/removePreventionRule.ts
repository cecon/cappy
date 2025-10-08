import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class RemovePreventionRuleCommand {
    async execute(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                
                return;
            }

            const cappyDir = path.join(workspaceFolder.uri.fsPath, '.cappy');
            const preventionRulesPath = path.join(cappyDir, 'prevention-rules.xml');

            // Verificar se arquivo existe
            try {
                await fs.promises.access(preventionRulesPath, fs.constants.F_OK);
            } catch {
                
                return;
            }

            // Ler arquivo XML atual
            const xmlContent = await fs.promises.readFile(preventionRulesPath, 'utf8');

            // Listar rules existentes para o usuário escolher
            const existingRules = this.extractExistingRules(xmlContent);
            
            if (existingRules.length === 0) {
                
                return;
            }

            // Criar lista de opções para o usuário
            const quickPickItems = existingRules.map(rule => ({
                label: `ID ${rule.id}: ${rule.title}`,
                description: rule.description,
                id: rule.id
            }));

            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Selecione a prevention rule para remover'
            });

            if (!selectedItem) {
                
                return;
            }

            const ruleIdToRemove = selectedItem.id;

            // Remover a rule do XML
            const updatedXml = this.removeRuleFromXml(xmlContent, ruleIdToRemove);
            
            // Salvar arquivo
            await fs.promises.writeFile(preventionRulesPath, updatedXml, 'utf8');

            // Output apenas o ID da rule removida
            

        } catch (error) {
            const errorMsg = `Erro ao remover prevention rule: ${error}`;
            
        }
    }

    private extractExistingRules(xmlContent: string): Array<{id: string, title: string, description: string}> {
        const rules: Array<{id: string, title: string, description: string}> = [];
        
        // Regex para capturar todas as rules
        const ruleRegex = /<rule\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/rule>/g;
        let match;
        
        while ((match = ruleRegex.exec(xmlContent)) !== null) {
            const id = match[1];
            const ruleContent = match[2];
            
            const titleMatch = ruleContent.match(/<title>(.*?)<\/title>/);
            const descriptionMatch = ruleContent.match(/<description>(.*?)<\/description>/);
            
            if (titleMatch && descriptionMatch) {
                rules.push({
                    id,
                    title: this.unescapeXml(titleMatch[1]),
                    description: this.unescapeXml(descriptionMatch[1])
                });
            }
        }
        
        return rules;
    }

    private removeRuleFromXml(xmlContent: string, ruleIdToRemove: string): string {
        // Remover a rule específica
        const ruleRegex = new RegExp(`\\s*<rule\\s+id="${ruleIdToRemove}"[^>]*>[\\s\\S]*?<\\/rule>`, 'g');
        let updated = xmlContent.replace(ruleRegex, '');
        
        // Atualizar o count
        const currentCount = this.getCurrentCount(xmlContent);
        const newCount = Math.max(0, currentCount - 1);
        updated = updated.replace(/count="\d+"/, `count="${newCount}"`);
        
        return updated;
    }

    private getCurrentCount(xmlContent: string): number {
        const countMatch = xmlContent.match(/count="(\d+)"/);
        return countMatch ? parseInt(countMatch[1]) : 0;
    }

    private unescapeXml(text: string): string {
        return text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
    }
}
