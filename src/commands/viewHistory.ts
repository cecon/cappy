import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface HistoryItem {
    fileName: string;
    displayName: string;
    timestamp: Date;
    filePath: string;
}

export class ViewHistoryCommand {
    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const openFolder = await vscode.window.showInformationMessage(
                    '📁 FORGE precisa de uma pasta de projeto para visualizar o histórico.\n\nAbra uma pasta primeiro.',
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

            const historyDir = path.join(workspaceFolder.uri.fsPath, '.forge', 'history');

            try {
                await fs.promises.access(historyDir, fs.constants.F_OK);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    vscode.window.showInformationMessage('Nenhum histórico de atividades encontrado.');
                    return false;
                }
                throw error;
            }

            const historyItems = await this.loadHistoryItems(historyDir);
            
            if (historyItems.length === 0) {
                vscode.window.showInformationMessage('Histórico de atividades vazio.');
                return false;
            }

            // Mostrar lista de atividades
            const selectedItem = await this.showHistoryQuickPick(historyItems);
            
            if (selectedItem) {
                // Abrir arquivo selecionado
                const doc = await vscode.workspace.openTextDocument(selectedItem.filePath);
                await vscode.window.showTextDocument(doc);
            }

            return true;

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao visualizar histórico: ${error}`);
            return false;
        }
    }

    private async loadHistoryItems(historyDir: string): Promise<HistoryItem[]> {
        const files = await fs.promises.readdir(historyDir);
        const historyItems: HistoryItem[] = [];

        for (const fileName of files) {
            if (fileName.endsWith('.md')) {
                const filePath = path.join(historyDir, fileName);
                const stats = await fs.promises.stat(filePath);
                
                // Extrair timestamp e nome do arquivo
                const match = fileName.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-(.+)\.md$/);
                
                if (match) {
                    const timestampStr = match[1].replace(/T/, ' ').replace(/-/g, ':');
                    const slug = match[2];
                    const displayName = slug.replace(/-/g, ' ');
                    
                    historyItems.push({
                        fileName,
                        displayName: this.capitalizeWords(displayName),
                        timestamp: new Date(timestampStr),
                        filePath
                    });
                } else {
                    // Fallback para arquivos que não seguem o padrão
                    historyItems.push({
                        fileName,
                        displayName: fileName.replace('.md', ''),
                        timestamp: stats.mtime,
                        filePath
                    });
                }
            }
        }

        // Ordenar por timestamp (mais recente primeiro)
        return historyItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    private async showHistoryQuickPick(historyItems: HistoryItem[]): Promise<HistoryItem | undefined> {
        const quickPickItems = historyItems.map(item => ({
            label: item.displayName,
            description: item.timestamp.toLocaleDateString('pt-BR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }),
            detail: `Arquivo: ${item.fileName}`,
            item: item
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            title: '📚 Histórico de Atividades',
            placeHolder: 'Selecione uma atividade para visualizar...',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.item;
    }

    private capitalizeWords(str: string): string {
        return str.replace(/\b\w/g, char => char.toUpperCase());
    }

    async generateHistoryReport(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const historyDir = path.join(workspaceFolder.uri.fsPath, '.forge', 'history');
            try {
                await fs.promises.access(historyDir, fs.constants.F_OK);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return;
                }
                throw error;
            }

            const historyItems = await this.loadHistoryItems(historyDir);
            
            if (historyItems.length === 0) {
                return;
            }

            // Gerar relatório
            const report = this.generateReport(historyItems);
            
            // Mostrar em novo documento
            const doc = await vscode.workspace.openTextDocument({
                content: report,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc);

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao gerar relatório: ${error}`);
        }
    }

    private generateReport(historyItems: HistoryItem[]): string {
        const totalActivities = historyItems.length;
        const dateRange = {
            start: historyItems[historyItems.length - 1]?.timestamp,
            end: historyItems[0]?.timestamp
        };

        const report = `# 📊 Relatório de Atividades FORGE

**Período:** ${dateRange.start?.toLocaleDateString('pt-BR')} - ${dateRange.end?.toLocaleDateString('pt-BR')}
**Total de Atividades:** ${totalActivities}

## 📋 Lista de Atividades

${historyItems.map((item, index) => 
    `${index + 1}. **${item.displayName}**\n   - Concluída em: ${item.timestamp.toLocaleDateString('pt-BR')}\n   - Arquivo: \`${item.fileName}\`\n`
).join('\n')}

## 📈 Estatísticas

- **Atividades por mês:** ${this.getActivitiesByMonth(historyItems)}
- **Última atividade:** ${historyItems[0]?.displayName || 'N/A'}
- **Atividade mais antiga:** ${historyItems[historyItems.length - 1]?.displayName || 'N/A'}

---
*Relatório gerado em ${new Date().toLocaleString('pt-BR')} pelo FORGE Framework*
`;

        return report;
    }

    private getActivitiesByMonth(historyItems: HistoryItem[]): string {
        const monthCounts: Record<string, number> = {};
        
        historyItems.forEach(item => {
            const monthKey = item.timestamp.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
            monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        });

        return Object.entries(monthCounts)
            .map(([month, count]) => `${month}: ${count}`)
            .join(', ');
    }
}
