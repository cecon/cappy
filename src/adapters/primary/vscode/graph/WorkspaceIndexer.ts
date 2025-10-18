import * as vscode from 'vscode';

export interface WorkspaceIndexerHost {
  log: (message: string) => void;
  sendMessage: (message: Record<string, unknown>) => void;
}

export class WorkspaceIndexer {
  async index(host: WorkspaceIndexerHost): Promise<void> {
    host.sendMessage({ type: 'status', status: 'indexing' });
    host.log('📂 Scanning workspace for files...');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      host.log('⚠️ No workspace folder found');
      return;
    }

    try {
      // Placeholder: Hook ParserService + IndexingService here
      host.log('✅ Indexing system ready');
      host.log('➡️ Next: Use search to test hybrid search');
      host.sendMessage({
        type: 'graph-data',
        data: {
          message: 'Indexing system ready - use search to test queries',
          ready: true,
        },
      });
    } catch (error) {
      host.log(`❌ Indexing failed: ${error}`);
      host.sendMessage({
        type: 'error',
        error: `Indexing failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}
