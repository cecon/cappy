import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class AddPreventionRuleCommand {
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

            // Solicitar dados da nova rule via prompts
            const title = await vscode.window.showInputBox({
                prompt: 'Título da prevention rule',
                placeHolder: 'Ex: Evitar loops infinitos'
            });

            if (!title) {
                return;
            }

            const description = await vscode.window.showInputBox({
                prompt: 'Descrição da prevention rule',
                placeHolder: 'Ex: Sempre verificar condições de parada em loops'
            });

            if (!description) {
                return;
            }

            const category = await vscode.window.showInputBox({
                prompt: 'Categoria da prevention rule',
                placeHolder: 'Ex: performance, security, syntax'
            });

            if (!category) {
                return;
            }

            // Ler arquivo XML atual
            const xmlContent = await fs.promises.readFile(preventionRulesPath, 'utf8');
            
            // Calcular próximo ID
            const nextId = this.getNextId(xmlContent);
            
            // Incrementar count
            const newCount = this.getCurrentCount(xmlContent) + 1;
            
            // Criar nova rule XML
            const newRuleXml = `  <rule id="${nextId}">
    <title>${this.escapeXml(title)}</title>
    <description>${this.escapeXml(description)}</description>
    <category>${this.escapeXml(category)}</category>
  </rule>`;

            // Inserir nova rule no XML
            const updatedXml = this.insertNewRule(xmlContent, newRuleXml, newCount);
            
            // Salvar arquivo
            await fs.promises.writeFile(preventionRulesPath, updatedXml, 'utf8');

            // Output apenas o trecho da nova rule

        } catch (error) {
            const errorMsg = `Erro ao adicionar prevention rule: ${error}`;
        }
    }

    private getNextId(xmlContent: string): number {
        const idMatches = xmlContent.match(/id="(\d+)"/g);
        if (!idMatches || idMatches.length === 0) {
            return 1;
        }

        const ids = idMatches.map(match => parseInt(match.match(/\d+/)![0]));
        return Math.max(...ids) + 1;
    }

    private getCurrentCount(xmlContent: string): number {
        const countMatch = xmlContent.match(/count="(\d+)"/);
        return countMatch ? parseInt(countMatch[1]) : 0;
    }

    private insertNewRule(xmlContent: string, newRuleXml: string, newCount: number): string {
        // Atualizar o count
        let updated = xmlContent.replace(/count="\d+"/, `count="${newCount}"`);
        
        // Inserir nova rule antes do closing tag
        const closingTag = '</prevention-rules>';
        const insertPosition = updated.lastIndexOf(closingTag);
        
        if (insertPosition === -1) {
            throw new Error('Formato XML inválido: closing tag não encontrado');
        }

        return updated.slice(0, insertPosition) + newRuleXml + '\n' + updated.slice(insertPosition);
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
