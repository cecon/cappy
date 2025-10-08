import * as vscode from 'vscode';
import { getCappyRAGLanceDatabase } from '../../store/cappyragLanceDb';

/**
 * Command to clean orphaned entities and chunks from CappyRAG database
 * Removes entities without relationships and chunks without entities/relationships
 */
export async function cleanOrphanedDataCommand(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Confirm with user
        const answer = await vscode.window.showWarningMessage(
            '🧹 Limpar entidades e chunks órfãos do banco de dados CappyRAG?\n\n' +
            'Isto vai remover:\n' +
            '• Entidades que não têm nenhum relacionamento\n' +
            '• Chunks que não têm entidades ou relacionamentos\n\n' +
            'Esta ação não pode ser desfeita.',
            { modal: true },
            'Sim, limpar',
            'Cancelar'
        );

        if (answer !== 'Sim, limpar') {
            vscode.window.showInformationMessage('Limpeza cancelada.');
            return;
        }

        // Show progress
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'CappyRAG Cleanup',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Analisando banco de dados...' });

                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    throw new Error('Nenhum workspace aberto');
                }

                const db = getCappyRAGLanceDatabase(workspaceFolders[0].uri.fsPath);

                progress.report({ message: 'Removendo dados órfãos...' });

                const result = await db.cleanOrphanedData();

                // Show results
                const message = `✅ Limpeza concluída!\n\n` +
                    `Removido:\n` +
                    `• ${result.deletedEntities} entidades órfãs\n` +
                    `• ${result.deletedChunks} chunks órfãos\n\n` +
                    `Permanecendo:\n` +
                    `• ${result.remainingEntities} entidades\n` +
                    `• ${result.remainingChunks} chunks`;

                vscode.window.showInformationMessage(message);

                // Log to output channel
                console.log('\n' + '='.repeat(60));
                console.log('🧹 CappyRAG Cleanup Results');
                console.log('='.repeat(60));
                console.log(`Deleted Entities: ${result.deletedEntities}`);
                console.log(`Deleted Chunks: ${result.deletedChunks}`);
                console.log(`Remaining Entities: ${result.remainingEntities}`);
                console.log(`Remaining Chunks: ${result.remainingChunks}`);
                console.log('='.repeat(60) + '\n');
            }
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        vscode.window.showErrorMessage(`❌ Erro ao limpar dados: ${errorMessage}`);
        console.error('Error cleaning orphaned data:', error);
    }
}
