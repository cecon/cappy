import * as vscode from 'vscode';
import { handleLoadDocuments, handleDocumentUpload, handleDocumentDelete, handleClearAllDocuments, handleGenerateDescription } from './handlers/documentHandlers';
import { handleGetGraphData } from './handlers/graphHandlers';
import { handleExecuteQuery } from './handlers/retrievalHandlers';
import { getDatabase } from './utils/databaseHelper';

/**
 * Main entry point for CappyRAG Dashboard
 * This replaces the old monolithic documentUpload.ts
 */
export async function openDocumentUploadUI(context: vscode.ExtensionContext, initialTab: string = 'documents') {
    const panel = vscode.window.createWebviewPanel(
        'lightragDashboard',
        'Cappy',
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
    
    // Register callback to refresh documents when processing completes
    const { getBackgroundProcessor } = await import('../../services/backgroundProcessor');
    const processor = getBackgroundProcessor();
    processor.onDocumentCompleted(async (documentId) => {
        console.log(`[CappyRAG] Document ${documentId} completed, refreshing dashboard...`);
        try {
            const documents = await db.getDocumentsAsync();
            const stats = {
                documents: documents.length,
                entities: (await db.getEntitiesAsync()).length,
                relationships: (await db.getRelationshipsAsync()).length,
                chunks: (await db.getChunksAsync()).length
            };
            
            panel.webview.postMessage({
                command: 'documentsLoaded',
                data: {
                    documents,
                    stats
                }
            });
        } catch (error) {
            console.error('[CappyRAG] Failed to refresh after completion:', error);
        }
    });

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
        console.error('[CappyRAG] Failed to load initial data:', error);
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

                case 'openGraphPage':
                    // Navigate to full-page graph view
                    try {
                        const fs = await import('fs');
                        const path = await import('path');
                        const graphPagePath = path.join(context.extensionPath, 'out', 'webview', 'graph-page.html');
                        const d3JsPath = path.join(context.extensionPath, 'out', 'webview', 'd3.v7.min.js');
                        
                        let htmlContent = fs.readFileSync(graphPagePath, 'utf8');
                        const d3Content = fs.readFileSync(d3JsPath, 'utf8');
                        
                        // Replace CDN script tag with inline D3.js
                        htmlContent = htmlContent.replace(
                            /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/d3@7"><\/script>/,
                            `<script>${d3Content}</script>`
                        );
                        
                        // Update webview to show graph page
                        panel.webview.html = htmlContent;
                        
                        // Immediately send graph data
                        await handleGetGraphData(panel);
                    } catch (error) {
                        console.error('[CappyRAG] Failed to open graph page:', error);
                        vscode.window.showErrorMessage(`Failed to open graph page: ${error}`);
                    }
                    break;

                case 'backToDashboard':
                    // Navigate back to dashboard
                    try {
                        const { generateWebviewHTML } = await import('./templates/htmlTemplate');
                        panel.webview.html = generateWebviewHTML(panel.webview, context);
                        
                        // Reload dashboard data
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
                            activeTab: 'graph'
                        });
                    } catch (error) {
                        console.error('[CappyRAG] Failed to return to dashboard:', error);
                        vscode.window.showErrorMessage(`Failed to return to dashboard: ${error}`);
                    }
                    break;
                
                case 'getGraphD3HTML':
                    // Send D3.js graph HTML to iframe with inline D3.js library
                    try {
                        const fs = await import('fs');
                        const path = await import('path');
                        const graphHtmlPath = path.join(context.extensionPath, 'out', 'webview', 'graph-d3.html');
                        const d3JsPath = path.join(context.extensionPath, 'out', 'webview', 'd3.v7.min.js');
                        
                        let htmlContent = fs.readFileSync(graphHtmlPath, 'utf8');
                        const d3Content = fs.readFileSync(d3JsPath, 'utf8');
                        
                        // Replace CDN script tag with inline D3.js
                        htmlContent = htmlContent.replace(
                            /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/d3@7"><\/script>/,
                            `<script>${d3Content}</script>`
                        );
                        
                        panel.webview.postMessage({
                            command: 'graphD3HTML',
                            data: htmlContent
                        });
                    } catch (error) {
                        console.error('[CappyRAG] Failed to load graph-d3.html:', error);
                        panel.webview.postMessage({
                            command: 'graphD3HTMLError',
                            data: { message: `Failed to load graph HTML: ${error}` }
                        });
                    }
                    break;

                case 'generateDescription':
                    await handleGenerateDescription(message.data, panel);
                    break;

                case 'executeQuery':
                    await handleExecuteQuery(message.data.query, panel);
                    break;

                case 'getQueueStatus':
                    // Get current processing queue status
                    const { getProcessingQueue } = await import('../../services/documentProcessingQueue');
                    const queue = getProcessingQueue();
                    const queueStatus = queue.getQueueStatus();
                    const allItems = queue.getAllItems();
                    
                    panel.webview.postMessage({
                        command: 'queueStatus',
                        data: {
                            status: queueStatus,
                            items: allItems
                        }
                    });
                    break;

                case 'retryDocument':
                    // Retry failed document processing
                    const { getProcessingQueue: getQueue } = await import('../../services/documentProcessingQueue');
                    const retryQueue = getQueue();
                    retryQueue.retry(message.documentId);
                    
                    // Return updated status
                    const updatedStatus = retryQueue.getQueueStatus();
                    const updatedItems = retryQueue.getAllItems();
                    panel.webview.postMessage({
                        command: 'queueStatus',
                        data: {
                            status: updatedStatus,
                            items: updatedItems
                        }
                    });
                    break;

                default:
                    console.warn(`[CappyRAG] Unknown command: ${message.command}`);
            }
        },
        undefined,
        context.subscriptions
    );
}
