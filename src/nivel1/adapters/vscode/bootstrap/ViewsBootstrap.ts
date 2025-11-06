/**
 * @fileoverview Bootstrap for VS Code Views registration
 * @module bootstrap/ViewsBootstrap
 */

import * as vscode from 'vscode';
import { GraphPanel } from '../dashboard/GraphPanel';
import { DocumentsViewProvider } from '../documents/DocumentsViewProvider';

export interface ViewsBootstrapResult {
  graphPanel: GraphPanel;
  documentsViewProvider: DocumentsViewProvider;
}

/**
 * Registers all VS Code views (webviews, panels, etc)
 */
export class ViewsBootstrap {
  /**
   * Registers all views
   */
  register(context: vscode.ExtensionContext): ViewsBootstrapResult {
    console.log('📺 Registering VS Code Views...');

    // Create output channel for graph logs
    const graphOutputChannel = vscode.window.createOutputChannel('Cappy Graph');
    context.subscriptions.push(graphOutputChannel);

    // Create graph panel
    const graphPanel = new GraphPanel(context, graphOutputChannel);
    console.log('  ✅ Graph Panel created');

    // Register Documents View Provider
    const documentsViewProvider = new DocumentsViewProvider(context.extensionUri);
    const documentsViewDisposable = vscode.window.registerWebviewViewProvider(
      DocumentsViewProvider.viewType,
      documentsViewProvider
    );
    context.subscriptions.push(documentsViewDisposable);
    console.log('  ✅ Documents View Provider registered');

    // Create status bar shortcut
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '$(graph) Cappy Graph';
    statusBar.tooltip = 'Open Cappy Graph';
    statusBar.command = 'cappy.openGraph';
    statusBar.show();
    context.subscriptions.push(statusBar);
    console.log('  ✅ Status Bar item created');

    return {
      graphPanel,
      documentsViewProvider
    };
  }
}
