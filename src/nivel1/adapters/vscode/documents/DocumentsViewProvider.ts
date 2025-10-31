/**
 * @fileoverview WebView provider for Documents page
 * @module nivel1/adapters/vscode/documents/DocumentsViewProvider
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { FileMetadataDatabase, type FileMetadata, type FileProcessingStatus } from '../../../../nivel2/infrastructure/services/file-metadata-database';

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
  private readonly documents: Map<string, DocumentItem> = new Map();
  private readonly _extensionUri: vscode.Uri;
  private _fileDatabase?: FileMetadataDatabase;
  private _graphStore?: unknown; // Will be typed as GraphStorePort when passed
  private _refreshIntervalId?: NodeJS.Timeout;
  private readonly _refreshIntervalMs = 5000; // Refresh every 5 seconds when view is visible

  constructor(extensionUri: vscode.Uri, fileDatabase?: FileMetadataDatabase) {
    console.log('🏗️ [DocumentsViewProvider] Constructor called');
    this._extensionUri = extensionUri;
    this._fileDatabase = fileDatabase;
    console.log('🏗️ [DocumentsViewProvider] Initialized with fileDatabase:', !!fileDatabase);
  }

  /**
   * Sets the file database (can be called after initialization)
   */
  setFileDatabase(fileDatabase: FileMetadataDatabase): void {
    this._fileDatabase = fileDatabase;
  }

  /**
   * Sets the graph store (can be called after initialization)
   */
  setGraphStore(graphStore: unknown): void {
    this._graphStore = graphStore;
  }

  /**
   * Notifies the webview of file processing updates
   * Called by FileProcessingQueue when files are processed
   */
  notifyFileUpdate(event: {
    type: 'processing' | 'completed' | 'error';
    fileId: string;
    filePath: string;
    progress?: number;
    currentStep?: string;
    error?: string;
    metrics?: {
      chunksCount: number;
      nodesCount: number;
      relationshipsCount: number;
      duration: number;
    };
  }): void {
    if (!this._view) {
      return;
    }

    console.log(`📢 [DocumentsViewProvider] Notifying webview of ${event.type} for ${event.filePath}`);

    // Send update to webview
    this._view.webview.postMessage({
      type: 'document/update',
      payload: {
        fileId: event.fileId,
        filePath: event.filePath,
        status: event.type === 'completed' ? 'processed' : event.type,
        progress: event.progress,
        currentStep: event.currentStep,
        errorMessage: event.error,
        chunksCount: event.metrics?.chunksCount,
        nodesCount: event.metrics?.nodesCount,
        relationshipsCount: event.metrics?.relationshipsCount
      }
    });

    // If processing completed or failed, refresh the list to show updated data
    if (event.type === 'completed' || event.type === 'error') {
      // Debounce refresh to avoid too many updates
      setTimeout(() => {
        this.refreshDocumentList().catch(err => {
          console.error('Failed to refresh document list after update:', err);
        });
      }, 500);
    }
  }

  /**
   * Resolves the webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // Mark unused parameters as intentionally referenced for linting
    console.debug?.('[DocumentsViewProvider] resolveWebviewView args present:', Boolean(_context), Boolean(_token));
    console.log('🔧 [DocumentsViewProvider] Resolving webview view...');
    console.log('🔧 [DocumentsViewProvider] File database available:', !!this._fileDatabase);
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      // Limit resource roots to /out like ChatViewProvider (consistency)
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'out')]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    // DON'T load initial list here - wait for webview-ready message
    console.log('📊 [DocumentsViewProvider] Waiting for webview-ready before loading documents');

    // Start auto-refresh interval when view becomes visible
    this._startAutoRefresh();
    
    // Probe extension -> webview channel
    try {
      webviewView.webview.postMessage({ type: 'document/hello', payload: { from: 'DocumentsViewProvider' } });
      console.log('📤 [DocumentsViewProvider] Sent hello to webview');
    } catch (e) {
      console.warn('⚠️ [DocumentsViewProvider] Failed to send hello to webview:', e);
    }

    // Stop auto-refresh when view is hidden
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log('👁️ [DocumentsViewProvider] View became visible - starting auto-refresh');
        this._startAutoRefresh();
      } else {
        console.log('🙈 [DocumentsViewProvider] View became hidden - stopping auto-refresh');
        this._stopAutoRefresh();
      }
    });

    // Handle messages from the webview
    console.log('🎧 [DocumentsViewProvider] Setting up message listener for webview');
    const disposeListener = webviewView.webview.onDidReceiveMessage(async (data) => {
      console.log(`📨 [DocumentsViewProvider] ⚡ RAW MESSAGE RECEIVED:`, JSON.stringify(data));
      console.log(`📨 [DocumentsViewProvider] Message type: "${data.type}"`);
      console.log(`📨 [DocumentsViewProvider] Message payload:`, data.payload);
      try {
        console.log(`📨 [DocumentsViewProvider] Received message: ${data.type}`, data);
        console.log(`📨 [DocumentsViewProvider] About to enter switch statement...`);
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
          case 'document/reprocess':
            console.log('🔄 Handling reprocess...');
            await this.handleReprocess(data.payload.fileId, data.payload.filePath);
            break;
          case 'document/view-details':
            console.log('👁️ [DocumentsViewProvider] CASE MATCHED: document/view-details');
            console.log('👁️ [DocumentsViewProvider] Payload:', data.payload);
            console.log('👁️ [DocumentsViewProvider] Calling handleViewDetails...');
            await this.handleViewDetails(data.payload.fileId);
            console.log('👁️ [DocumentsViewProvider] handleViewDetails completed');
            break;
          case 'document/retry':
            console.log('🔄 Handling retry...');
            await this.handleRetry();
            break;
          case 'document/clear':
            console.log('🗑️ Handling clear...');
            await this.handleClear();
            break;
          case 'document/refresh': {
            console.log('🔄 Handling refresh...');
            // Check if message contains pagination params
            const paginationParams = data.payload;
            await this.handleRefresh(paginationParams);
            break;
          }
          case 'webview-ready':
            console.log('✅ [DocumentsViewProvider] Webview reported ready - loading documents');
            // Load documents when webview is ready
            await this.refreshDocumentList();
            break;
          default:
            console.warn(`⚠️ [DocumentsViewProvider] Unknown message type: "${data.type}"`);
            break;
        }
        console.log(`✅ [DocumentsViewProvider] Message handling completed for: ${data.type}`);
      } catch (error) {
        console.error('❌ [DocumentsViewProvider] Error handling webview message:', error);
        console.error('❌ [DocumentsViewProvider] Error stack:', (error as Error).stack);
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    });

    // Keep a reference so it's not GC'd prematurely
    webviewView.onDidDispose(() => {
      try {
        disposeListener.dispose();
      } catch {
        // ignore
      }
    });
    console.log('✅ [DocumentsViewProvider] Message listener registered');
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
        vscode.window.showWarningMessage('No files selected');
        return;
      }

      console.log('🔼 handleUpload: Processing files...', fileUris.map(u => u.fsPath));
      
      for (const fileUri of fileUris) {
        console.log(`🔼 handleUpload: Processing ${fileUri.fsPath}`);
        await this.processFile(fileUri.fsPath);
      }
      
      console.log('🔼 handleUpload: All files processed!');
    } catch (error) {
      console.error('🔼 handleUpload: ERROR -', error);
      vscode.window.showErrorMessage(`Error during upload: ${error}`);
    }
  }

  /**
   * Handles workspace scan
   */
  private async handleScan() {
    console.log('🔍 [DocumentsViewProvider] handleScan started');
    console.log('🔍 [DocumentsViewProvider] Webview available:', !!this._view);
    console.log('🔍 [DocumentsViewProvider] Webview visible:', this._view?.visible);
    
    try {
      // Notifica o webview que o scan começou
      console.log('📤 [DocumentsViewProvider] Sending scan-started message to webview');
      const scanStartedMessage = { type: 'document/scan-started' };
      console.log('📤 [DocumentsViewProvider] Message payload:', JSON.stringify(scanStartedMessage));
      this._view?.webview.postMessage(scanStartedMessage);
      console.log('📤 [DocumentsViewProvider] scan-started message sent');

      console.log('⚡ [DocumentsViewProvider] Executing cappy.scanWorkspace command');
      
      // Execute the command directly - it has its own progress notification
      await vscode.commands.executeCommand('cappy.scanWorkspace');
      
      console.log('✅ [DocumentsViewProvider] cappy.scanWorkspace completed');
      
      // Refresh document list from database
      console.log('🔄 [DocumentsViewProvider] Refreshing document list...');
      await this.refreshDocumentList();
      console.log('✅ [DocumentsViewProvider] Document list refreshed');
      
    } catch (error) {
      console.error('❌ [DocumentsViewProvider] Error during scan:', error);
      vscode.window.showErrorMessage(`Scan failed: ${error}`);
    } finally {
      // Sempre notifica que o scan terminou
      console.log('📤 [DocumentsViewProvider] Sending scan-completed message to webview (finally block)');
      console.log('📤 [DocumentsViewProvider] Webview still available:', !!this._view);
      const scanCompletedMessage = { type: 'document/scan-completed' };
      console.log('📤 [DocumentsViewProvider] Message payload:', JSON.stringify(scanCompletedMessage));
      this._view?.webview.postMessage(scanCompletedMessage);
      console.log('✅ [DocumentsViewProvider] scan-completed message sent successfully');
    }
  }

  /**
   * Starts auto-refresh interval
   */
  private _startAutoRefresh(): void {
    // Clear existing interval if any
    this._stopAutoRefresh();

    console.log(`🔄 [DocumentsViewProvider] Starting auto-refresh (every ${this._refreshIntervalMs}ms)`);
    
    this._refreshIntervalId = setInterval(() => {
      if (this._view?.visible) {
        console.log('🔄 [DocumentsViewProvider] Auto-refreshing document list');
        this.refreshDocumentList().catch(err => {
          console.error('Failed to auto-refresh documents:', err);
        });
      }
    }, this._refreshIntervalMs);
  }

  /**
   * Stops auto-refresh interval
   */
  private _stopAutoRefresh(): void {
    if (this._refreshIntervalId) {
      clearInterval(this._refreshIntervalId);
      this._refreshIntervalId = undefined;
      console.log('⏹️ [DocumentsViewProvider] Stopped auto-refresh');
    }
  }

  /**
   * Refreshes document list from database and sends to webview
   */
  private async refreshDocumentList(paginationParams?: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: 'id' | 'created_at' | 'updated_at';
    sortOrder?: 'asc' | 'desc';
  }) {
    console.log('🔄 [DocumentsViewProvider] ============================================');
    console.log('🔄 [DocumentsViewProvider] REFRESH DOCUMENT LIST CALLED');
    console.log('🔄 [DocumentsViewProvider] Pagination params:', paginationParams);
    console.log('🔄 [DocumentsViewProvider] File database available:', !!this._fileDatabase);
    console.log('🔄 [DocumentsViewProvider] Webview available:', !!this._view);
    console.log('🔄 [DocumentsViewProvider] ============================================');
    
    // Get documents from file metadata database
    if (!this._fileDatabase) {
      console.error('❌ [DocumentsViewProvider] No file database available - file processing system may not be initialized yet');
      console.error('❌ [DocumentsViewProvider] Please wait for the file processing system to initialize or run "Cappy: Start File Processing" command');
      this._view?.webview.postMessage({
        type: 'document/list',
        payload: { documents: [], total: 0, page: 1, limit: 10, totalPages: 0 }
      });
      return;
    }

    try {
      // ALWAYS use pagination - use defaults if not provided
      const { page = 1, limit = 10, status, sortBy = 'updated_at', sortOrder = 'desc' } = paginationParams || {};
      
      console.log('📊 [DocumentsViewProvider] Fetching paginated files:', { page, limit, status, sortBy, sortOrder });
      
      const result = await this._fileDatabase.getFilesPaginated({
        page,
        limit,
        status: status as FileProcessingStatus | undefined,
        sortBy,
        sortOrder
      });

      console.log(`📊 [DocumentsViewProvider] Found ${result.files.length} files (page ${result.page}/${result.totalPages}, total: ${result.total})`);
      
      // Convert database records to DocumentItem format
      const documents: DocumentItem[] = result.files.map((file: FileMetadata) => this.mapFileToDocument(file));
      
      // Update internal documents map for the current page
      for (const doc of documents) {
        this.documents.set(doc.id, doc);
      }
      
      // Send paginated result to webview
      console.log(`📤 [DocumentsViewProvider] ============================================`);
      console.log(`📤 [DocumentsViewProvider] SENDING DOCUMENTS TO WEBVIEW`);
      console.log(`📤 [DocumentsViewProvider] Documents count: ${documents.length}`);
      console.log(`📤 [DocumentsViewProvider] Total: ${result.total}`);
      console.log(`📤 [DocumentsViewProvider] Page: ${result.page}/${result.totalPages}`);
      console.log('📤 [DocumentsViewProvider] Webview exists:', !!this._view);
      console.log('📤 [DocumentsViewProvider] Webview visible:', this._view?.visible);
      console.log(`📤 [DocumentsViewProvider] Sample documents:`, documents.slice(0, 2));
      console.log(`📤 [DocumentsViewProvider] ============================================`);
      
      if (!this._view) {
        console.error('❌ [DocumentsViewProvider] Cannot send message - webview is undefined!');
        return;
      }
      
      const messagePayload = {
        type: 'document/list',
        payload: { 
          documents,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };
      
      console.log('📤 [DocumentsViewProvider] About to call postMessage with:', JSON.stringify(messagePayload).substring(0, 500));
      
      this._view.webview.postMessage(messagePayload);
      
      console.log('✅ [DocumentsViewProvider] ============================================');
      console.log('✅ [DocumentsViewProvider] POST MESSAGE CALLED SUCCESSFULLY');
      console.log('✅ [DocumentsViewProvider] ============================================');
    } catch (error) {
      console.error('❌ [DocumentsViewProvider] Error loading documents from database:', error);
      this._view?.webview.postMessage({
        type: 'document/list',
        payload: { documents: [], total: 0, page: 1, limit: 10, totalPages: 0 }
      });
    }
  }

  private mapFileToDocument(file: FileMetadata): DocumentItem {
    // Map database status to DocumentStatus
    let status: DocumentStatus = 'pending';
    if (file.status === 'completed' || file.status === 'processed') {
      status = 'completed';
    } else if (file.status === 'processing') {
      status = 'processing';
    } else if (file.status === 'failed' || file.status === 'error') {
      status = 'failed';
    }
    
    return {
      id: file.id,
      fileName: file.fileName,
      filePath: file.filePath,
      summary: file.errorMessage || '',
      status,
      length: file.fileSize || 0,
      chunks: file.chunksCount || 0,
      created: file.processingStartedAt || new Date().toISOString(),
      updated: file.processingCompletedAt || new Date().toISOString(),
      trackId: file.id,
      processingStartTime: file.processingStartedAt,
      processingEndTime: file.processingCompletedAt,
      currentStep: file.currentStep,
      progress: file.progress
    };
  }

  /**
   * Handles processing a specific file
   */
  private async handleProcess(fileUri: string) {
    await this.processFile(fileUri);
  }

  /**
   * Handles reprocessing a file by setting its status to pending
   */
  private async handleReprocess(fileId: string, filePath: string) {
    console.log(`🔄 [DocumentsViewProvider] handleReprocess: ${fileId} (${filePath})`);
    
    if (!this._fileDatabase) {
      console.error('❌ [DocumentsViewProvider] No file database available');
      vscode.window.showErrorMessage('File processing system not initialized');
      return;
    }

    try {
      // Update file status to 'pending' so it will be picked up by the queue
      await this._fileDatabase.updateFile(fileId, {
        status: 'pending',
        currentStep: 'Queued for reprocessing',
        progress: 0,
        errorMessage: undefined
      });

      console.log(`✅ [DocumentsViewProvider] File ${fileId} marked as pending for reprocessing`);
      vscode.window.showInformationMessage(`File queued for reprocessing: ${path.basename(filePath)}`);
      
      // Refresh the document list to show updated status
      await this.refreshDocumentList();
    } catch (error) {
      console.error('❌ [DocumentsViewProvider] Error reprocessing file:', error);
      vscode.window.showErrorMessage(`Failed to reprocess file: ${error}`);
    }
  }

  /**
   * Handles viewing document details (embeddings, graph node, relationships)
   */
  private async handleViewDetails(fileId: string) {
    console.log(`👁️ [DocumentsViewProvider] ========================================`);
    console.log(`👁️ [DocumentsViewProvider] handleViewDetails CALLED`);
    console.log(`👁️ [DocumentsViewProvider] fileId: ${fileId}`);
    console.log(`👁️ [DocumentsViewProvider] _graphStore available: ${!!this._graphStore}`);
    console.log(`👁️ [DocumentsViewProvider] _fileDatabase available: ${!!this._fileDatabase}`);
    console.log(`👁️ [DocumentsViewProvider] ========================================`);
    
    if (!this._graphStore) {
      console.error('❌ [DocumentsViewProvider] No graph store available');
      this._view?.webview.postMessage({
        type: 'document/details',
        payload: {
          embeddings: [],
          graphNode: null,
          relationships: []
        }
      });
      return;
    }

    try {
      // Get file metadata to find file path
      console.log(`🔍 [DocumentsViewProvider] Fetching file metadata for: ${fileId}`);
      const file = await this._fileDatabase?.getFile(fileId);
      console.log(`🔍 [DocumentsViewProvider] File metadata:`, file);
      if (!file) {
        console.error('❌ [DocumentsViewProvider] File not found:', fileId);
        this._view?.webview.postMessage({
          type: 'document/details',
          payload: {
            embeddings: [],
            graphNode: null,
            relationships: []
          }
        });
        return;
      }

      const graphStore = this._graphStore as {
        getFileChunks?: (filePath: string) => Promise<Array<{
          id: string;
          content: string;
          embedding?: number[];
          metadata?: Record<string, unknown>;
        }>>;
        getNode?: (nodeId: string) => Promise<{
          id: string;
          type: string;
          properties: Record<string, unknown>;
        } | null>;
        getRelationships?: (nodeId: string) => Promise<Array<{
          from: string;
          to: string;
          type: string;
        }>>;
      };

      // Get chunks/embeddings for this file
      console.log(`🔍 [DocumentsViewProvider] Getting file chunks for: ${file.filePath}`);
      console.log(`🔍 [DocumentsViewProvider] graphStore.getFileChunks exists: ${!!graphStore.getFileChunks}`);
      const chunks = graphStore.getFileChunks 
        ? await graphStore.getFileChunks(file.filePath)
        : [];
      console.log(`✅ [DocumentsViewProvider] Found ${chunks.length} chunks`);

      // Get graph node for this file (use file ID as node ID)
      console.log(`🔍 [DocumentsViewProvider] Getting graph node for: ${fileId}`);
      console.log(`🔍 [DocumentsViewProvider] graphStore.getNode exists: ${!!graphStore.getNode}`);
      const graphNode = graphStore.getNode 
        ? await graphStore.getNode(fileId)
        : null;
      console.log(`✅ [DocumentsViewProvider] Graph node found: ${!!graphNode}`);

      // Get relationships if we have a node
      console.log(`🔍 [DocumentsViewProvider] Getting relationships...`);
      const relationships = graphNode && graphStore.getRelationships
        ? await graphStore.getRelationships(graphNode.id)
        : [];
      console.log(`✅ [DocumentsViewProvider] Found ${relationships.length} relationships`);

      console.log(`✅ [DocumentsViewProvider] SUMMARY: ${chunks.length} chunks, node: ${!!graphNode}, ${relationships.length} relationships`);

      // Send details to webview
      console.log(`📤 [DocumentsViewProvider] Sending details to webview...`);
      console.log(`📤 [DocumentsViewProvider] Webview available: ${!!this._view}`);
      const payload = {
        embeddings: chunks.map(c => ({
          chunkId: c.id,
          content: c.content,
          embedding: c.embedding || []
        })),
        graphNode,
        relationships
      };
      console.log(`📤 [DocumentsViewProvider] Payload:`, JSON.stringify(payload, null, 2).substring(0, 500));
      this._view?.webview.postMessage({
        type: 'document/details',
        payload
      });
      console.log(`✅ [DocumentsViewProvider] Message sent to webview!`);
    } catch (error) {
      console.error('❌ [DocumentsViewProvider] Error fetching document details:', error);
      console.error('❌ [DocumentsViewProvider] Error stack:', (error as Error).stack);
      this._view?.webview.postMessage({
        type: 'document/details',
        payload: {
          embeddings: [],
          graphNode: null,
          relationships: []
        }
      });
    }
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

    // Execute internal processing command with progress updates
    try {
      // Mark as processing
      doc.status = 'processing';
      doc.currentStep = 'Initializing...';
      doc.progress = 5;
      doc.processingStartTime = now;
      console.log('⚙️ processFile: Updated status to processing');
      this.updateDocument(doc);

      await vscode.commands.executeCommand('cappy.processSingleFileInternal', {
        filePath,
        onProgress: (step: string, percent: number) => {
          doc.currentStep = step;
          doc.progress = percent;
          doc.updated = new Date().toLocaleString('pt-BR');
          this.updateDocument(doc);
        }
      });

      // Mark as completed
      doc.status = 'completed';
      doc.currentStep = 'Completed';
      doc.progress = 100;
      doc.processingEndTime = new Date().toLocaleString('pt-BR');
      doc.summary = `${fileName} - Successfully processed`;
      console.log('✅ processFile: Processing completed successfully');
      this.updateDocument(doc);

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
  private async handleRefresh(paginationParams?: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: 'id' | 'created_at' | 'updated_at';
    sortOrder?: 'asc' | 'desc';
  }) {
    console.log('🔄 [DocumentsViewProvider] handleRefresh called - loading from database', paginationParams);
    // Refresh from database with pagination
    await this.refreshDocumentList(paginationParams);
  }

  /**
   * Gets the HTML content for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    // IMPORTANT: Vite outputs 'chat.js' and 'chat.css' for the unified Chat/Documents entry
    // (see vite.config.ts rollupOptions.input). There is no 'main.js' in out/.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'chat.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'chat.css')
    );

    const nonce = (() => {
      let text = '';
      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return text;
    })();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource}; connect-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>Cappy Documents</title>
  <script nonce="${nonce}">
    // CRITICAL: Initialize vscodeApi BEFORE any other script loads
    (function() {
      try {
        console.log('[Documents Webview] 🚀 Initializing vscodeApi...');
        const vscode = acquireVsCodeApi();
        window.vscodeApi = vscode;
        console.log('[Documents Webview] ✅ vscodeApi ready:', !!window.vscodeApi);
        
        // Notify extension that webview is ready
        window.vscodeApi.postMessage({ type: 'webview-ready' });
        console.log('[Documents Webview] 📤 Sent webview-ready message');
      } catch (e) {
        console.error('[Documents Webview] ❌ Failed to acquire VS Code API:', e);
      }
    })();
  </script>
</head>
<body>
  <div id="root" data-page="documents"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
