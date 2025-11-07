/**
 * @fileoverview Bootstrap for VS Code Views registration
 * @module bootstrap/ViewsBootstrap
 */

import * as vscode from 'vscode';
import { GraphPanel } from '../dashboard/GraphPanel';

export interface ViewsBootstrapResult {
  graphPanel: GraphPanel;
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

    // Create graph panel (includes documents page in dashboard)
    const graphPanel = new GraphPanel(context, graphOutputChannel);
    console.log('  ✅ Graph Panel created (includes Documents page)');

    // Create status bar shortcut
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '$(graph) Cappy Graph';
    statusBar.tooltip = 'Open Cappy Graph';
    statusBar.command = 'cappy.openGraph';
    statusBar.show();
    context.subscriptions.push(statusBar);
    console.log('  ✅ Status Bar item created');

    return {
      graphPanel
    };
  }
}
