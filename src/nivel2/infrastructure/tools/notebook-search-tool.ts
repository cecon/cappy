/**
 * @fileoverview LM Tool — Search the Cappy Notebook knowledge base
 * @module infrastructure/tools/notebook-search-tool
 */

import * as vscode from 'vscode';
import { NotebookStore } from '../notebook/notebook-store';
import { Retriever } from '../notebook/retriever';

interface NotebookSearchInput {
  /** Search query */
  query: string;
  /** Notebook name (default: "default") */
  notebookName?: string;
  /** Number of results to return (default: 5) */
  topK?: number;
}

/**
 * LM Tool that searches the Cappy Notebook RAG knowledge base.
 * Returns the most relevant chunks with their sources and scores.
 */
export class NotebookSearchTool implements vscode.LanguageModelTool<NotebookSearchInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<NotebookSearchInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { query, notebookName = 'default', topK = 5 } = options.input;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        content: [new vscode.LanguageModelTextPart(
          'ERROR: No workspace folder open. Cannot access notebook.'
        )]
      };
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const store = new NotebookStore(workspaceRoot);
    const notebook = store.load(notebookName);

    if (!notebook) {
      // List available notebooks
      const available = store.listNotebooks();
      const msg = available.length > 0
        ? `Notebook "${notebookName}" not found. Available notebooks: ${available.join(', ')}. Use cappy_notebook_ingest to create one.`
        : `No notebooks exist yet. Use cappy_notebook_ingest to create one by adding a document.`;
      return { content: [new vscode.LanguageModelTextPart(msg)] };
    }

    const retriever = new Retriever();
    const results = retriever.search(notebook, query, { topK });

    if (results.length === 0) {
      return {
        content: [new vscode.LanguageModelTextPart(
          `No results found for "${query}" in notebook "${notebookName}".`
        )]
      };
    }

    // Format results
    const lines: string[] = [
      `📚 Notebook "${notebookName}" — ${results.length} results for "${query}":`,
      '',
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      lines.push(`--- Result ${i + 1} (score: ${r.score}, vector: ${r.vectorScore}, graph: ${r.graphScore}) ---`);
      lines.push(`Source: ${r.chunk.source}${r.chunk.metadata.section ? ` > ${r.chunk.metadata.section}` : ''}`);
      lines.push(`Lines: ${r.chunk.metadata.startLine}-${r.chunk.metadata.endLine}`);
      lines.push(r.chunk.text);
      lines.push('');
    }

    // Add graph context
    if (notebook.graph.nodes.length > 0) {
      const relevantChunkIds = new Set(results.map(r => r.chunk.id));
      const relevantNodes = notebook.graph.nodes.filter(n =>
        n.chunkIds.some(id => relevantChunkIds.has(id))
      );

      if (relevantNodes.length > 0) {
        lines.push('--- Related entities (knowledge graph) ---');
        for (const node of relevantNodes.slice(0, 10)) {
          lines.push(`  • ${node.label} (${node.type}, ${node.chunkIds.length} chunks)`);
        }
      }
    }

    return {
      content: [new vscode.LanguageModelTextPart(lines.join('\n'))]
    };
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<NotebookSearchInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `🔍 Searching notebook for: "${options.input.query}"`,
    };
  }
}
