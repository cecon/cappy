/**
 * @fileoverview LM Tool — Ingest a document into the Cappy Notebook
 * @module infrastructure/tools/notebook-ingest-tool
 */

import * as vscode from 'vscode';
import { NotebookStore } from '../notebook/notebook-store';

interface NotebookIngestInput {
  /** File path to ingest (relative to workspace or absolute) */
  filePath: string;
  /** Notebook name (default: "default") */
  notebookName?: string;
}

/**
 * LM Tool that ingests a document into the Cappy Notebook.
 * Chunks the document, generates embeddings, builds knowledge graph.
 */
export class NotebookIngestTool implements vscode.LanguageModelTool<NotebookIngestInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<NotebookIngestInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { filePath, notebookName = 'default' } = options.input;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        content: [new vscode.LanguageModelTextPart(
          'ERROR: No workspace folder open. Cannot create notebook.'
        )]
      };
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const store = new NotebookStore(workspaceRoot);

    try {
      const notebook = store.addSource(notebookName, filePath);

      const stats = {
        totalChunks: notebook.chunks.length,
        totalSources: notebook.meta.sources.length,
        graphNodes: notebook.graph.nodes.length,
        graphEdges: notebook.graph.edges.length,
      };

      const lines = [
        `✅ Document "${filePath}" ingested into notebook "${notebookName}".`,
        '',
        `📊 Notebook stats:`,
        `  • Sources: ${stats.totalSources} (${notebook.meta.sources.join(', ')})`,
        `  • Chunks: ${stats.totalChunks}`,
        `  • Graph: ${stats.graphNodes} entities, ${stats.graphEdges} relationships`,
        '',
        `Use cappy_notebook_search to query this knowledge base.`,
      ];

      return {
        content: [new vscode.LanguageModelTextPart(lines.join('\n'))]
      };
    } catch (err) {
      return {
        content: [new vscode.LanguageModelTextPart(
          `ERROR: Failed to ingest "${filePath}": ${err}`
        )]
      };
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<NotebookIngestInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `📥 Ingesting "${options.input.filePath}" into notebook...`,
    };
  }
}
