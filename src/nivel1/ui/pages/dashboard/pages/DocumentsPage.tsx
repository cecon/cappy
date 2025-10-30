import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../../../primitives';

type VSCodeApi = { postMessage: (message: unknown) => void };
type WindowWithVSCode = Window & {
  acquireVsCodeApi?: () => VSCodeApi;
  vscodeApi?: VSCodeApi;
};

type DocumentStatus = 'completed' | 'preprocessed' | 'processing' | 'pending' | 'failed';
type StatusFilter = 'all' | DocumentStatus;
type SortField = 'id' | 'created' | 'updated';
type SortOrder = 'asc' | 'desc';

interface Document {
  id: string;
  fileName: string;
  filePath?: string;
  summary: string;
  status: DocumentStatus;
  length: number;
  chunks: number;
  nodesCount?: number;
  relationshipsCount?: number;
  created: string;
  updated: string;
  trackId?: string;
  processingStartTime?: string;
  processingEndTime?: string;
  currentStep?: string;
  progress?: number;
  error?: string;
  selected: boolean;
}

// Moved outside to avoid nested component definition warnings
const Spinner: React.FC<{ readonly size?: number }> = ({ size = 16 }) => (
  <svg
    className="animate-spin"
    style={{ width: size, height: size }}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const DocumentsPage: React.FC = () => {
  console.log('[DocumentsPage] 🚀 Component initialized');
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFileName, setShowFileName] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isScanning, setIsScanning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Dados de exemplo (exatamente como no LightRAG)
  const [documents, setDocuments] = useState<Document[]>([]);
  const lastRequestSignature = useRef<string | null>(null);

  const vscodeApi = useMemo(() => {
    if (typeof globalThis !== 'undefined' && (globalThis as { window?: unknown }).window) {
      const w = (globalThis as { window: unknown }).window as WindowWithVSCode & { acquireVsCodeApi?: () => VSCodeApi };
      if (w.vscodeApi) {
        console.log('[DocumentsPage] ✅ vscodeApi found (already initialized)');
        return w.vscodeApi;
      }
      if (typeof w.acquireVsCodeApi === 'function') {
        console.log('[DocumentsPage] ✅ acquireVsCodeApi found, acquiring...');
        const api = w.acquireVsCodeApi();
        w.vscodeApi = api;
        return api;
      }
    }
    console.log('[DocumentsPage] ⚠️ vscodeApi not available yet');
    return undefined;
  }, []);

  const postMessage = (type: string, payload: Record<string, unknown> = {}) => {
    console.log(`[DocumentsPage] 📤 Posting message to extension: ${type}`, { type, payload });
    console.log(`[DocumentsPage] vscodeApi available:`, !!vscodeApi);
    
    if (!vscodeApi) {
      console.error('[DocumentsPage] ❌ Cannot send message - vscodeApi is undefined!');
      return;
    }
    
    try {
      vscodeApi.postMessage({ type, payload });
      console.log(`[DocumentsPage] ✅ Message sent successfully via postMessage`);
    } catch (error) {
      console.error('[DocumentsPage] ❌ Error calling postMessage:', error);
    }
  };

  // Small helpers to avoid deep nested callbacks inside setState
  // Legacy upload helpers removed with HTTP service deprecation

  // Helpers extracted to reduce nesting
  const setDocsFromStatusResponses = useCallback((statusResponses: Array<Record<string, unknown>>) => {
    interface StatusResponse {
      fileId: string;
      fileName?: string;
      filePath?: string;
      summary?: string;
      status: DocumentStatus;
      chunksCount?: number;
      nodesCount?: number;
      relationshipsCount?: number;
      error?: string;
      progress?: number;
      fileSize?: number;
    }
    const docs: Document[] = (statusResponses as unknown[]).map((raw) => {
      const sr = raw as StatusResponse;
      return {
        id: sr.fileId,
        fileName: sr.fileName || 'Unknown',
        filePath: sr.filePath,
        summary: sr.summary || '',
        status: sr.status,
        length: sr.fileSize || sr.nodesCount || 0,
        chunks: sr.chunksCount ?? 0,
        nodesCount: sr.nodesCount,
        relationshipsCount: sr.relationshipsCount,
        created: new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0],
        progress: sr.progress || 0,
        error: sr.error,
        selected: false,
      };
    });
    setDocuments(docs);
  }, []);

  const updateDocument = useCallback((doc: Document) => {
    setDocuments((prev) => {
      const index = prev.findIndex((d) => d.id === doc.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = { ...doc, selected: prev[index].selected };
        return updated;
      }
      return [...prev, { ...doc, selected: false }];
    });
  }, []);

  const removeDocumentById = useCallback((fileId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== fileId));
  }, []);

  // Load documents from extension via postMessage
  const loadDocuments = useCallback(async (options?: { force?: boolean }) => {
    try {
      if (!vscodeApi) {
        console.log('[DocumentsPage] ⚠️ vscodeApi not available, skipping document load');
        lastRequestSignature.current = null;
        return;
      }
      console.log('[DocumentsPage] Requesting documents from extension with pagination...');
      // Request documents via postMessage with pagination params
      let sortBy: string;
      if (sortField === 'id') {
        sortBy = 'id';
      } else if (sortField === 'created') {
        sortBy = 'created_at';
      } else {
        sortBy = 'updated_at';
      }

      const message = {
        type: 'document/refresh',
        payload: {
          page: currentPage,
          limit: itemsPerPage,
          status: statusFilter === 'all' ? undefined : statusFilter,
          sortBy: sortBy,
          sortOrder: sortOrder
        }
      };
      console.log('[DocumentsPage] 📤 Sending document/refresh message:', message);
      const signature = `${currentPage}|${itemsPerPage}|${statusFilter}|${sortField}|${sortOrder}`;
      if (!options?.force && lastRequestSignature.current === signature) {
        console.log('[DocumentsPage] ⚠️ Skipping duplicate document/refresh request for current filters');
        return;
      }
      vscodeApi.postMessage(message);
      lastRequestSignature.current = signature;
      console.log('[DocumentsPage] ✅ document/refresh message sent');
    } catch (error) {
      console.error('[DocumentsPage] ❌ Error requesting documents:', error);
    }
  }, [vscodeApi, currentPage, itemsPerPage, statusFilter, sortField, sortOrder]);

  // Listen for messages from extension
  useEffect(() => {
    console.log('[DocumentsPage] 🎧 Setting up message listener');
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('[DocumentsPage] 📨 Received message from extension:', message.type, message);
      console.log('[DocumentsPage] 📊 Current isScanning state BEFORE processing:', isScanning);
      
      switch (message.type) {
        case 'document/hello': {
          console.log('[DocumentsPage] 👋 Hello from extension:', message.payload);
          break;
        }
        case 'document/updated': {
          const doc = message.payload.document as Document;
          updateDocument(doc);
          break;
        }
        case 'document/removed': {
          const { fileId } = message as { fileId: string };
          console.log('[DocumentsPage] Removing document from UI:', fileId);
          removeDocumentById(fileId);
          break;
        }
        case 'document/clear-confirmed': {
          console.log('[DocumentsPage] ✅ Clear confirmed by extension');
          // The extension will send document/cleared when done
          break;
        }
        case 'document/cleared': {
          console.log('[DocumentsPage] Documents cleared, resetting UI');
          setDocuments([]);
          break;
        }
        case 'document/list': {
          const payload = message.payload;
          const docs = payload.documents || [];
          setDocuments(docs.map((d: Document) => ({ ...d, selected: false })));
          
          // Update pagination info from server
          const total = payload.total === undefined ? docs.length : payload.total;
          const pages = payload.totalPages === undefined ? 1 : payload.totalPages;
          
          setTotalDocuments(total);
          setTotalPages(pages);
          
          console.log('[DocumentsPage] Received paginated documents:', {
            count: docs.length,
            total: payload.total,
            page: payload.page,
            totalPages: payload.totalPages
          });
          break;
        }
        case 'document/scan-started': {
          console.log('[DocumentsPage] 🚀 Scan STARTED - setting isScanning to TRUE');
          setIsScanning(true);
          break;
        }
        case 'document/scan-completed': {
          console.log('[DocumentsPage] ✅ Scan COMPLETED - setting isScanning to FALSE');
          console.log('[DocumentsPage] 🔄 Reloading documents after scan...');
          setIsScanning(false);
          // Reload documents after scan completes via postMessage
          loadDocuments({ force: true });
          break;
        }
      }
    };

    // Use window.addEventListener for proper VS Code webview message handling
    window.addEventListener('message', handleMessage);
    console.log('[DocumentsPage] ✅ Message listener registered');
    return () => {
      window.removeEventListener('message', handleMessage);
      console.log('[DocumentsPage] 🔌 Message listener removed');
    };
  }, [removeDocumentById, setDocsFromStatusResponses, updateDocument, loadDocuments]);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const all = totalDocuments;
    const completed = documents.filter((d) => d.status === 'completed').length;
    const preprocessed = documents.filter((d) => d.status === 'preprocessed').length;
    const processing = documents.filter((d) => d.status === 'processing').length;
    const pending = documents.filter((d) => d.status === 'pending').length;
    const failed = documents.filter((d) => d.status === 'failed').length;
    return { all, completed, preprocessed, processing, pending, failed };
  }, [documents, totalDocuments]);

  // Reset page quando mudar filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sortField, sortOrder]);

  // Reload documents when pagination/filter/sort changes
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = () => {
    // If running inside VS Code webview, delegate to extension (uses native file picker and internal pipeline)
    if (vscodeApi) {
      console.log('[DocumentsPage] 🆙 handleUpload: Delegating to VS Code extension');
      postMessage('document/upload');
      return;
    }
    // Fallback: browser file input (for standalone preview/dev)
    console.log('🆙 handleUpload: Clicking file input...');
    fileInputRef.current?.click();
  };

    const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    console.log('[DocumentsPage] Files selected:', files.length);

    // Add files to state with pending status
    const now = new Date().toISOString().split('T')[0];
    const newDocuments: Document[] = Array.from(files).map((file, index) => ({
      id: `temp-${Date.now()}-${index}`,
      fileName: file.name,
      filePath: file.name,
      summary: 'Uploading to server...',
      status: 'pending' as const,
      length: file.size,
      chunks: 0,
      created: now,
      updated: now,
      progress: 0,
      selected: false
    }));

    setDocuments(prev => [...prev, ...newDocuments]);

    // Process each file via API
    // Legacy browser upload via HTTP API was removed.
    console.warn('[DocumentsPage] Browser-based upload is disabled. Use the Upload button inside VS Code (delegates to extension).');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // NOTE: Legacy HTTP service removed — no direct uploads via HTTP.
  // Fallback browser upload path is disabled.

  const handleScan = async () => {
    // Use extension-driven scan via postMessage
    console.log('[DocumentsPage] 🔍 handleScan: Delegating to VS Code extension');
    setIsScanning(true);
    postMessage('document/scan');
  };

  const handleRetry = () => {
    const failedDocs = documents.filter((d) => d.status === 'failed');
    if (failedDocs.length > 0) {
      postMessage('document/retry', { documentIds: failedDocs.map((d) => d.id) });
    }
  };

  const reprocessDocument = async (fileId: string) => {
    try {
      const doc = documents.find(d => d.id === fileId);
      if (!doc?.filePath) throw new Error('File path not found');
      // Delegate to extension: it handles processing pipeline internally
      postMessage('document/process', { fileUri: doc.filePath });
    } catch (e) {
      console.error('[DocumentsPage] Reprocess error:', e);
      setDocuments((prev) => prev.map((d) => (d.id === fileId ? { ...d, status: 'failed', summary: `❌ ${String(e)}` } : d)));
    }
  };

  const removeDocument = async (fileId: string, filePath: string) => {
    console.log('[DocumentsPage] Removing document:', fileId, filePath);

    // Use VSCode API for confirmation dialog
    postMessage('document/confirm-remove', { fileId, filePath });
  };

  const handlePipeline = () => {
    postMessage('document/pipeline');
  };

  const handleClear = () => {
    postMessage('document/confirm-clear');
  };

  const handleRefresh = () => {
    postMessage('document/refresh');
  };

  const toggleDocumentSelection = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, selected: !d.selected } : d))
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="webui-page h-full flex flex-col">
      <Card className="flex-1 flex flex-col !rounded-none !overflow-hidden">
        <CardHeader className="py-2 px-6 flex-none border-b border-border/40">
          <CardTitle className="text-lg font-semibold">Document Management</CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex-1 flex flex-col min-h-0 overflow-auto px-6 pb-6">
          {/* Barra de ações */}
          <div className="flex justify-between items-center gap-2 mb-2 mt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleScan} disabled={isScanning} className="h-9">
                {isScanning ? (
                  <>
                    <Spinner size={16} />
                    <span className="ml-2">Scanning...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Scan
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRetry} 
                disabled={stats.failed === 0}
                className="h-9"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </Button>
              <Button 
                variant="outline" 
                onClick={handlePipeline}
                className={`h-9 ${stats.processing > 0 ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 animate-pulse' : ''}`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Pipeline
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClear} className="h-9">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </Button>
              <Button variant="primary" onClick={handleUpload} className="h-9">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>
          </div>

          {/* Tabela de documentos */}
          <Card className="flex-1 flex flex-col border rounded-md min-h-0 mb-2">
            <CardHeader className="flex-none py-3 px-4 border-b border-border/40">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base font-semibold">Uploaded Documents</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={handleRefresh} className="h-8 w-8 p-0" title="Refresh">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </Button>
                  </div>
                </div>
                
                {/* Filtros de status em linha separada */}
                <div className="flex justify-between items-center gap-2">
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant={statusFilter === 'all' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('all')}
                      className="h-8 text-xs px-3"
                    >
                      All ({stats.all})
                    </Button>
                    <Button
                      variant={statusFilter === 'completed' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('completed')}
                      className="h-8 text-xs px-3"
                    >
                      Completed ({stats.completed})
                    </Button>
                    <Button
                      variant={statusFilter === 'preprocessed' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('preprocessed')}
                      className="h-8 text-xs px-3"
                    >
                      Preprocessed ({stats.preprocessed})
                    </Button>
                    <Button
                      variant={statusFilter === 'processing' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('processing')}
                      className="h-8 text-xs px-3"
                    >
                      Processing ({stats.processing})
                    </Button>
                    <Button
                      variant={statusFilter === 'pending' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('pending')}
                      className="h-8 text-xs px-3"
                    >
                      Pending ({stats.pending})
                    </Button>
                    <Button
                      variant={statusFilter === 'failed' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('failed')}
                      className="h-8 text-xs px-3"
                    >
                      Failed ({stats.failed})
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setShowFileName(!showFileName)}
                    className="h-8 text-xs px-3"
                  >
                    {showFileName ? 'Hide' : 'Show'} Filename
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden">
              <div className="w-full h-full overflow-auto p-2">
                <div className="w-full h-full border border-border rounded-md overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-border bg-muted/50">
                        <th
                          className="h-12 px-4 text-left align-middle font-semibold text-sm text-foreground cursor-pointer hover:bg-muted/80 transition-colors select-none"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center gap-2">
                            ID
                            {sortField === 'id' && (
                              <span className="text-primary">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-semibold text-sm text-foreground">
                          Summary
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-semibold text-sm text-foreground">
                          Status
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-semibold text-sm text-foreground">
                          Length
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-semibold text-sm text-foreground">
                          Chunks
                        </th>
                        <th
                          className="h-12 px-4 text-left align-middle font-semibold text-sm text-foreground cursor-pointer hover:bg-muted/80 transition-colors select-none"
                          onClick={() => handleSort('created')}
                        >
                          <div className="flex items-center gap-2">
                            Created
                            {sortField === 'created' && (
                              <span className="text-primary">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="h-12 px-4 text-left align-middle font-semibold text-sm text-foreground cursor-pointer hover:bg-muted/80 transition-colors select-none"
                          onClick={() => handleSort('updated')}
                        >
                          <div className="flex items-center gap-2">
                            Updated
                            {sortField === 'updated' && (
                              <span className="text-primary">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="h-12 px-4 w-40 text-center align-middle font-semibold text-sm text-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* Debug info */}
                      {documents.length === 0 && statusFilter !== 'all' && (
                        <tr>
                          <td colSpan={8} className="h-32 px-4 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <p className="font-medium text-yellow-600 dark:text-yellow-400">No documents match filter</p>
                              <p className="text-sm text-muted-foreground">
                                No documents match the "{statusFilter}" filter
                              </p>
                              <Button variant="outline" onClick={() => setStatusFilter('all')} className="mt-2">
                                Show All Documents
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {documents.length === 0 && statusFilter === 'all' ? (
                          <tr>
                            <td colSpan={8} className="h-32 px-4 text-center text-muted-foreground">
                              <div className="flex flex-col items-center gap-2">
                                <svg className="w-12 h-12 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="font-medium">No documents found</p>
                                <p className="text-sm">Upload files to get started</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <>
                            {documents.map((doc) => {
                              // Extracted from nested ternary for readability
                              let statusClassName = 'bg-muted text-muted-foreground border border-border';
                              if (doc.status === 'completed') {
                                statusClassName = 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20';
                              } else if (doc.status === 'failed') {
                                statusClassName = 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
                              }
                              return (
                                <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                              <td className="h-16 px-4 align-middle">
                                <div className="group relative">
                                  <div className="truncate max-w-[200px] font-mono text-sm">
                                    {showFileName ? doc.fileName : doc.id}
                                  </div>
                                  {!showFileName && (
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg border border-border whitespace-nowrap z-50">
                                      {doc.fileName}
                                      <div className="absolute left-4 top-full w-0 h-0 border-4 border-transparent border-t-popover"></div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="h-16 px-4 align-middle">
                                <div className="group relative">
                                  <div className="truncate max-w-xs text-sm">{truncateText(doc.summary, 80)}</div>
                                  {doc.status === 'processing' && doc.currentStep && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {truncateText(doc.currentStep, 80)}
                                    </div>
                                  )}
                                  {doc.summary.length > 80 && (
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg border border-border max-w-md z-50 whitespace-normal">
                                      {doc.summary}
                                      <div className="absolute left-4 top-full w-0 h-0 border-4 border-transparent border-t-popover"></div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="h-16 px-4 align-middle">
                                <div className="flex items-center gap-2">
                                  {/* Status badge */}
                                  {doc.status === 'processing' ? (
                                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                                      <Spinner size={12} />
                                      <span className="text-xs font-medium text-primary">
                                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${statusClassName}`}>
                                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                                    </span>
                                  )}
                                  {doc.status === 'failed' && doc.error && (
                                    <div className="group/info relative">
                                      <svg className="h-4 w-4 text-red-500 ml-1 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" strokeWidth={2} />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4M12 8h.01" />
                                      </svg>
                                      <div className="invisible group-hover/info:visible absolute left-0 bottom-full mb-2 bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg border border-border whitespace-nowrap z-50">
                                        {doc.error}
                                        <div className="absolute left-4 top-full w-0 h-0 border-4 border-transparent border-t-popover"></div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Progress indicator */}
                                  {doc.trackId && (
                                    <div className="group/info relative">
                                      <svg className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" strokeWidth={2} />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4M12 8h.01" />
                                      </svg>
                                      <div className="invisible group-hover/info:visible absolute left-0 bottom-full mb-2 bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg border border-border whitespace-nowrap z-50">
                                        <div className="font-semibold mb-1">Processing Details</div>
                                        <div className="space-y-1">
                                          <div>Track ID: <span className="font-mono">{doc.trackId}</span></div>
                                          {doc.currentStep && <div>Step: {doc.currentStep}</div>}
                                          {doc.progress !== undefined && <div>Progress: {doc.progress}%</div>}
                                          {doc.processingStartTime && <div>Started: {doc.processingStartTime}</div>}
                                          {doc.processingEndTime && <div>Finished: {doc.processingEndTime}</div>}
                                        </div>
                                        <div className="absolute left-4 top-full w-0 h-0 border-4 border-transparent border-t-popover"></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="h-16 px-4 align-middle text-sm text-muted-foreground">
                                {doc.length.toLocaleString()}
                                {doc.chunks === 0 && doc.status === 'completed' && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs">No chunks</span>
                                )}
                              </td>
                              <td className="h-16 px-4 align-middle text-sm">
                                <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs min-w-[2rem]">
                                  {doc.chunks}
                                </span>
                              </td>
                              <td className="h-16 px-4 align-middle text-sm text-muted-foreground">{doc.created}</td>
                              <td className="h-16 px-4 align-middle text-sm text-muted-foreground">{doc.updated}</td>
                              <td className="h-16 px-4 align-middle">
                                <div className="flex items-center justify-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={doc.selected}
                                    onChange={() => toggleDocumentSelection(doc.id)}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                                    title={doc.selected ? 'Unselect' : 'Select'}
                                  />
                                  <Button
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => reprocessDocument(doc.id)}
                                    disabled={doc.status === 'processing' || doc.status === 'pending'}
                                    title="Reprocess"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="h-8 px-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                    onClick={() => removeDocument(doc.id, doc.filePath || doc.id)}
                                    disabled={doc.status === 'processing'}
                                    title="Remove file and clean graph data"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </tbody>
                </table>
                </div>

                {/* Paginação */}
                {(documents.length > 0 || totalDocuments > 0) && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalDocuments || documents.length)} of {totalDocuments || documents.length} files
                      </span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 text-sm border border-border rounded-md bg-background"
                      >
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages || 1, prev + 1))}
                        disabled={currentPage === (totalPages || 1)}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages || 1)}
                        disabled={currentPage === (totalPages || 1)}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsPage;
