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
      try {
        console.log(`📨 DocumentsView received message: ${data.type}`, data);
        switch (data.type) {
          case 'document/upload':
            console.log('🔼 Handling upload...');
            await this.handleUpload();
            break;
          case 'document/scan':
            console.log('🔍 Handling scan...');
            await this.handleScan();
            break;
          case 'document/process':
            console.log('⚙️ Handling process...');
            await this.handleProcess(data.payload.fileUri);
            break;
          case 'document/retry':
            console.log('🔄 Handling retry...');
            await this.handleRetry();
            break;
          case 'document/clear':
            console.log('🗑️ Handling clear...');
            await this.handleClear();
            break;
          case 'document/refresh':
            console.log('🔄 Handling refresh...');
            await this.handleRefresh();
            break;
        }
      } catch (error) {
        console.error('❌ Error handling webview message:', error);
        vscode.window.showErrorMessage(`Error: ${error}`);
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
    console.log('🔼 handleUpload: Opening file dialog...');
    
    try {
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

      console.log(`🔼 handleUpload: Dialog closed, selected ${fileUris?.length || 0} files`);
      console.log('🔼 handleUpload: fileUris =', fileUris);

      if (!fileUris || fileUris.length === 0) {
        console.log('🔼 handleUpload: No files selected');
        vscode.window.showInformationMessage('No files selected');
        return;
      }

      console.log('🔼 handleUpload: Processing files...', fileUris.map(u => u.fsPath));
      vscode.window.showInformationMessage(`Selected ${fileUris.length} file(s), processing...`);
      
      for (const fileUri of fileUris) {
        console.log(`🔼 handleUpload: Processing ${fileUri.fsPath}`);
        await this.processFile(fileUri.fsPath);
      }
      
      console.log('🔼 handleUpload: All files processed!');
      vscode.window.showInformationMessage(`✅ Processed ${fileUris.length} file(s) successfully!`);
    } catch (error) {
      console.error('🔼 handleUpload: ERROR -', error);
      vscode.window.showErrorMessage(`Error during upload: ${error}`);
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
    console.log(`⚙️ processFile: Starting processing for ${filePath}`);
    
    const fileName = path.basename(filePath);
    const fileId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    console.log(`⚙️ processFile: fileName=${fileName}, fileId=${fileId}`);
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const now = new Date().toLocaleString('pt-BR');
    
    console.log(`⚙️ processFile: File size=${stats.size} bytes`);

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

    console.log('⚙️ processFile: Creating document entry...', doc);
    this.updateDocument(doc);

    // Simulate processing with progress
    try {
      // Mark as processing
      doc.status = 'processing';
      doc.currentStep = 'Reading file...';
      doc.progress = 25;
      doc.processingStartTime = now;
      console.log('⚙️ processFile: Updated status to processing');
      this.updateDocument(doc);

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 500));

      doc.currentStep = 'Parsing...';
      doc.progress = 50;
      console.log('⚙️ processFile: Parsing');
      this.updateDocument(doc);

      await new Promise(resolve => setTimeout(resolve, 500));

      doc.currentStep = 'Embedding...';
      doc.progress = 75;
      console.log('⚙️ processFile: Embedding');
      this.updateDocument(doc);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark as completed
      doc.status = 'completed';
      doc.currentStep = 'Completed';
      doc.progress = 100;
      doc.processingEndTime = new Date().toLocaleString('pt-BR');
      doc.summary = `${fileName} - Successfully processed`;
      console.log('✅ processFile: Processing completed successfully');
      this.updateDocument(doc);
      
      vscode.window.showInformationMessage(`✅ File processed: ${fileName}`);

    } catch (error) {
      console.error('❌ processFile: Error during processing:', error);
      doc.status = 'failed';
      doc.currentStep = `Error: ${error}`;
      doc.progress = 0;
      this.updateDocument(doc);
      vscode.window.showErrorMessage(`❌ Error processing ${fileName}: ${error}`);
      throw error;
    }
    
    console.log('⚙️ processFile: Finished');
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
