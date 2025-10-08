// Funcionalidade para configurar Copilot automaticamente
import * as vscode from 'vscode';

export class CopilotConfigManager {
    private static readonly copilotSystemPrompt = `
Você é um assistente especializado em desenvolvimento da extensão CAPPY. 

🚀 **Build & Publicação:**
- Se solicitado para publicar: package patch → compile → publique → instale no VS Code

📋 **Regras Gerais:**
- Sempre grave documentações na pasta docs/
- Execute comandos CAPPY APENAS via Language Model Tools
- Nunca use terminal/shell para comandos CAPPY
- Comandos retornam dados diretamente

🏗️ **Processo de Release:**
1. Incrementar versão no package.json (patch/minor/major)
2. Compilar: npm run compile  
3. Testar: npm run test
4. Gerar pacote: npm run package
5. Publicar: npm run publish

🎯 **CAPPY Commands:**
- Todos via Language Model Tools exclusivamente
- Contexto orquestrado automaticamente  
- Tarefas atômicas com prevenção de erros

Sempre confirme interpretação antes de executar comandos CAPPY.
    `.trim();

    /**
     * Configura automaticamente o Copilot com instruções CAPPY
     */
    public static async configureCopilotInstructions(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration();
            
            // Configura o system prompt do Copilot Chat
            await config.update(
                'github.copilot.chat.systemPrompt', 
                this.copilotSystemPrompt,
                vscode.ConfigurationTarget.Workspace
            );

            // Configura locale para português
            await config.update(
                'github.copilot.chat.localeOverride',
                'pt-br',
                vscode.ConfigurationTarget.Workspace
            );

            vscode.window.showInformationMessage(
                '✅ Copilot configurado com instruções CAPPY!'
            );

        } catch (error) {
            vscode.window.showErrorMessage(
                `❌ Erro ao configurar Copilot: ${error}`
            );
        }
    }

    /**
     * Remove configurações CAPPY do Copilot
     */
    public static async removeCopilotInstructions(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration();
            
            await config.update(
                'github.copilot.chat.systemPrompt', 
                undefined,
                vscode.ConfigurationTarget.Workspace
            );

            vscode.window.showInformationMessage(
                '🔄 Configurações CAPPY removidas do Copilot'
            );

        } catch (error) {
            vscode.window.showErrorMessage(
                `❌ Erro ao remover configurações: ${error}`
            );
        }
    }
}