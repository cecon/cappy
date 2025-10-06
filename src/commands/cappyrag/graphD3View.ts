import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { handleGetGraphData } from './handlers/graphHandlers';

/**
 * Opens a full-window D3.js graph visualization
 */
export async function openGraphD3View(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'cappyragGraphD3',
        'Cappy Knowledge Graph - D3.js',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    // Load the D3 graph HTML from source (will be copied to out during build)
    const graphHtmlPath = path.join(context.extensionPath, 'out', 'webview', 'graph-d3.html');
    
    try {
        let htmlContent = fs.readFileSync(graphHtmlPath, 'utf8');
        
        // Set the webview HTML
        panel.webview.html = htmlContent;

        // Wait a bit for the webview to load, then send data
        setTimeout(async () => {
            await handleGetGraphData(panel);
        }, 500);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'ready':
                        // Webview is ready, send data
                        await handleGetGraphData(panel);
                        break;
                    
                    case 'refresh':
                        // Refresh graph data
                        await handleGetGraphData(panel);
                        break;
                    
                    default:
                        console.warn(`[GraphD3] Unknown command: ${message.command}`);
                }
            },
            undefined,
            context.subscriptions
        );

    } catch (error) {
        console.error('[GraphD3] Failed to load graph HTML:', error);
        vscode.window.showErrorMessage(`Failed to load graph visualization: ${error}`);
    }
}
