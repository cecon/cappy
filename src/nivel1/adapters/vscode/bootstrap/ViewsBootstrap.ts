/**
 * @fileoverview Bootstrap for VS Code Views registration
 * @module bootstrap/ViewsBootstrap
 */

import * as vscode from 'vscode';
import { GraphPanel } from '../dashboard/GraphPanel';
import { ChatViewProvider } from '../chat/ChatViewProvider';
import { DocumentsViewProvider } from '../documents/DocumentsViewProvider';
// import { LangGraphChatEngine } from '../../../../nivel2/infrastructure/agents/langgraph-chat-engine';
import { OrchestratedChatEngine } from '../../../../nivel2/infrastructure/agents/chat-engine/orchestrated-chat-engine';
import { createChatService } from '../../../../domains/chat/services/chat-service';

export interface ViewsBootstrapResult {
  graphPanel: GraphPanel;
  chatViewProvider: ChatViewProvider;
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

    // Create chat service with new orchestrated engine
    const chatEngine = new OrchestratedChatEngine();
    const chatService = createChatService(chatEngine);
    console.log('  ✅ OrchestratedChatEngine initialized (3 sub-agents)');

    // Register Chat View Provider
    const chatViewProvider = new ChatViewProvider(context.extensionUri, chatService);
    const chatViewDisposable = vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider
    );
    context.subscriptions.push(chatViewDisposable);
    console.log('  ✅ Chat View Provider registered');

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
      chatViewProvider,
      documentsViewProvider
    };
  }
}
