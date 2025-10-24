import * as vscode from 'vscode';
import * as path from 'path';

import { EmbeddingService } from '../services/embedding-service';
import { SQLiteAdapter } from '../nivel2/infrastructure/database/sqlite-adapter';
import { createVectorStore } from '../nivel2/infrastructure/vector/sqlite-vector-adapter';
import { IndexingService } from '../services/indexing-service';
import { ConfigService } from '../services/config-service';

export function registerDebugRetrievalCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('cappy.debugRetrieval', async () => {
    const output = vscode.window.createOutputChannel('Cappy Retrieval Test');
    output.show(true);

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const configService = new ConfigService(workspaceRoot);
      const sqlitePath = configService.getGraphDataPath(workspaceRoot);

      output.appendLine(`🔧 Using graph DB at: ${path.join(sqlitePath, 'graph-store.db')}`);

      // Initialize services (same wiring as the rest of the extension)
      const embeddingService = new EmbeddingService();
      await embeddingService.initialize();

      const graphStore = new SQLiteAdapter(sqlitePath);
      await graphStore.initialize();

      const vectorStore = createVectorStore(graphStore, embeddingService);

      const indexingService = new IndexingService(
        vectorStore,
        graphStore,
        embeddingService,
        workspaceRoot,
        undefined
      );
      await indexingService.initialize();

      // Quick DB sanity: subgraph counts
      try {
        const sub = await graphStore.getSubgraph(undefined, 1);
        output.appendLine(`📊 Current subgraph (depth=1): ${sub.nodes.length} nodes, ${sub.edges.length} edges`);
      } catch (e) {
        output.appendLine(`⚠️ Could not read subgraph: ${String(e)}`);
      }

      // Ask for a query
      const query = await vscode.window.showInputBox({
        title: 'Cappy Retrieval Test',
        prompt: 'Enter a semantic query to test retrieval',
        value: 'indexing service',
        ignoreFocusOut: true
      });
      if (!query) {
        output.appendLine('⏭️ Retrieval cancelled (no query entered).');
        return;
      }

      output.appendLine(`\n🔎 Hybrid search for: "${query}" ...`);
      const { directMatches, relatedChunks } = await indexingService.hybridSearch(query, 2);
      output.appendLine(`   📌 Direct matches: ${directMatches.length}`);
      output.appendLine(`   🕸️ Related chunks: ${relatedChunks.length}`);

      const show = (label: string, chunks: typeof directMatches) => {
        if (chunks.length === 0) {
          output.appendLine(`   • ${label}: none`);
          return;
        }
        const top = chunks.slice(0, 10);
        for (const c of top) {
          const fp = c.metadata.filePath;
          const loc = `${c.metadata.lineStart}-${c.metadata.lineEnd}`;
          const snippet = (c.content || '').replace(/\s+/g, ' ').slice(0, 120);
          output.appendLine(`   • ${label}: ${fp}:${loc} — ${snippet}`);
        }
        if (chunks.length > top.length) {
          output.appendLine(`   • (${chunks.length - top.length} more omitted)`);
        }
      };

      show('match', directMatches);
      show('related', relatedChunks);

      vscode.window.showInformationMessage('✅ Retrieval test completed — see "Cappy Retrieval Test" output.');
    } catch (error) {
      console.error('[RetrievalTest] Error:', error);
      vscode.window.showErrorMessage(`Retrieval test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  context.subscriptions.push(disposable);
}
