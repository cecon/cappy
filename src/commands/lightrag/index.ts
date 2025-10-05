import * as vscode from 'vscode';
import { handleLoadDocuments, handleDocumentUpload, handleDocumentDelete, handleClearAllDocuments, handleGenerateDescription } from './handlers/documentHandlers';
import { handleGetGraphData } from './handlers/graphHandlers';
import { getDatabase } from './utils/databaseHelper';

/**
 * Main entry point for LightRAG Dashboard
 * This replaces the old monolithic documentUpload.ts
 */
export async function openDocumentUploadUI(context: vscode.ExtensionContext, initialTab: string = 'documents') {
    const panel = vscode.window.createWebviewPanel(
        'lightragDashboard',
        'LightRAG - Knowledge Graph Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    // Initialize database
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const db = getDatabase();
    await db.initialize();

    // Set the webview HTML content using new modular template
    const { generateWebviewHTML } = await import('./templates/htmlTemplate');
    panel.webview.html = generateWebviewHTML(panel.webview, context);

    // Send initial data
    try {
        const documents = await db.getDocumentsAsync();
        const stats = {
            documents: documents.length,
            entities: (await db.getEntitiesAsync()).length,
            relationships: (await db.getRelationshipsAsync()).length,
            chunks: (await db.getChunksAsync()).length
        };
        
        panel.webview.postMessage({
            command: 'initialData',
            documents,
            stats,
            activeTab: initialTab
        });
    } catch (error) {
        console.error('[LightRAG] Failed to load initial data:', error);
    }

    // Message handler using modular handlers
    panel.webview.onDidReceiveMessage(
        async (message: any) => {
            switch (message.command) {
                case 'loadDocuments':
                    await handleLoadDocuments(panel);
                    break;

                case 'uploadDocument':
                    await handleDocumentUpload(message.data, panel);
                    break;

                case 'deleteDocument':
                    await handleDocumentDelete(message.documentId, panel);
                    break;

                case 'clearAllDocuments':
                    await handleClearAllDocuments(panel);
                    break;

                case 'getGraphData':
                    await handleGetGraphData(panel);
                    break;

                case 'generateDescription':
                    await handleGenerateDescription(message.data, panel);
                    break;

                default:
                    console.warn(`[LightRAG] Unknown command: ${message.command}`);
            }
        },
        undefined,
        context.subscriptions
    );
}
