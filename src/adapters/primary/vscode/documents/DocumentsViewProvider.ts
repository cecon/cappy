/**
 * @fileoverview WebView provider for Documents page
 * @module adapters/primary/vscode/documents/DocumentsViewProvider
 * @author Cappy Team
 * @since 3.0.4
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Document status type
 */
export type DocumentStatus = 'completed' | 'preprocessed' | 'processing' | 'pending' | 'failed';

/**
 * Document interface
 */
export interface DocumentItem {
  id: string;
  fileName: string;
  filePath: string;
  summary: string;
  status: DocumentStatus;
  length: number;
  chunks: number;
  created: string;
  updated: string;
  trackId?: string;
  processingStartTime?: string;
  processingEndTime?: string;
  currentStep?: string;
  progress?: number;
}

/**
 * Documents view provider for webview
 */
export class DocumentsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.documentsView';
  private _view?: vscode.WebviewView;
  private documents: Map<string, DocumentItem> = new Map();

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * Resolves the webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'document/upload':
          await this.handleUpload();
          break;
        case 'document/scan':
          await this.handleScan();
          break;
        case 'document/process':
          await this.handleProcess(data.payload.fileUri);
          break;
        case 'document/retry':
          await this.handleRetry();
          break;
        case 'document/clear':
          await this.handleClear();
          break;
        case 'document/refresh':
          await this.handleRefresh();
          break;
      }
    });
  }

  /**
   * Adds or updates a document in the list
   */
  public updateDocument(doc: DocumentItem) {
    this.documents.set(doc.id, doc);
    this._view?.webview.postMessage({
      type: 'document/updated',
      payload: { document: doc }
    });
  }

  /**
   * Removes a document from the list
   */
  public removeDocument(id: string) {
    this.documents.delete(id);
    this._view?.webview.postMessage({
      type: 'document/removed',
      payload: { id }
    });
  }

  /**
   * Clears all documents
   */
  public clearDocuments() {
    this.documents.clear();
    this._view?.webview.postMessage({
      type: 'document/cleared'
    });
  }

  /**
   * Handles file upload
   */
  private async handleUpload() {
    const fileUris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      filters: {
        'TypeScript': ['ts', 'tsx'],
        'JavaScript': ['js', 'jsx'],
        'Markdown': ['md', 'mdx'],
        'All Files': ['*']
      },
      title: 'Select files to process'
    });

    if (!fileUris || fileUris.length === 0) {
      return;
    }

    for (const fileUri of fileUris) {
      await this.processFile(fileUri.fsPath);
    }
  }

  /**
   * Handles workspace scan
   */
  private async handleScan() {
    await vscode.commands.executeCommand('cappy.scanWorkspace');
  }

  /**
   * Handles processing a specific file
   */
  private async handleProcess(fileUri: string) {
    await this.processFile(fileUri);
  }

  /**
   * Processes a single file
   */
  private async processFile(filePath: string) {
    const fileName = path.basename(filePath);
    const fileId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const now = new Date().toLocaleString('pt-BR');

    // Create initial document entry
    const doc: DocumentItem = {
      id: fileId,
      fileName,
      filePath,
      summary: `Processing ${fileName}...`,
      status: 'pending',
      length: stats.size,
      chunks: 0,
      created: now,
      updated: now,
      trackId: `process_${Date.now()}`,
      currentStep: 'Queued',
      progress: 0
    };

    this.updateDocument(doc);

    // Process file with progress updates
    try {
      // Step 1: Parsing
      doc.status = 'processing';
      doc.currentStep = 'Parsing AST...';
      doc.progress = 20;
      doc.processingStartTime = now;
      this.updateDocument(doc);

      // Execute the processing command
      await vscode.commands.executeCommand('cappy.processSingleFileInternal', {
        filePath,
        onProgress: (step: string, progress: number) => {
          doc.currentStep = step;
          doc.progress = progress;
          this.updateDocument(doc);
        }
      });

      // Step 5: Completed
      doc.status = 'completed';
      doc.currentStep = 'Completed';
      doc.progress = 100;
      doc.processingEndTime = new Date().toLocaleString('pt-BR');
      doc.summary = `${fileName} - Successfully processed`;
      this.updateDocument(doc);

    } catch (error) {
      doc.status = 'failed';
      doc.currentStep = `Error: ${error}`;
      doc.progress = 0;
      this.updateDocument(doc);
    }
  }

  /**
   * Handles retry failed documents
   */
  private async handleRetry() {
    const failedDocs = Array.from(this.documents.values()).filter(d => d.status === 'failed');
    for (const doc of failedDocs) {
      await this.processFile(doc.filePath);
    }
  }

  /**
   * Handles clear all documents
   */
  private async handleClear() {
    const answer = await vscode.window.showWarningMessage(
      'Clear all documents from the list?',
      { modal: true },
      'Yes',
      'No'
    );

    if (answer === 'Yes') {
      this.clearDocuments();
    }
  }

  /**
   * Handles refresh documents
   */
  private async handleRefresh() {
    // Send all documents to the webview
    this._view?.webview.postMessage({
      type: 'document/list',
      payload: {
        documents: Array.from(this.documents.values())
      }
    });
  }

  /**
   * Gets the HTML content for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'main.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Cappy Documents</title>
</head>
<body>
  <div id="root" data-page="documents"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
