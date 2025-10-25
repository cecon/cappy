import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../../primitives';

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
  
  // Dados de exemplo (exatamente como no LightRAG)
  const [documents, setDocuments] = useState<Document[]>([]);

  const vscodeApi = useMemo(() => {
    if (typeof globalThis !== 'undefined' && (globalThis as { window?: unknown }).window) {
      const w = (globalThis as { window: unknown }).window as WindowWithVSCode & { acquireVsCodeApi?: () => VSCodeApi };
      if (w.vscodeApi) return w.vscodeApi;
      if (typeof w.acquireVsCodeApi === 'function') {
        const api = w.acquireVsCodeApi();
        w.vscodeApi = api;
        return api;
      }
    }
    return undefined;
  }, []);

  const postMessage = (type: string, payload: Record<string, unknown> = {}) => {
    console.log(`[DocumentsPage] 📤 Posting message to extension: ${type}`, { type, payload });
    console.log(`[DocumentsPage] vscodeApi available:`, !!vscodeApi);
    vscodeApi?.postMessage({ type, payload });
  };

  // Small helpers to avoid deep nested callbacks inside setState
  const makeUploadFailedUpdater = useCallback((tempId: string, error: unknown) => {
    return (prev: Document[]) =>
      prev.map((doc) =>
        doc.id === tempId ? { ...doc, status: 'failed' as const, summary: `❌ Upload failed: ${String(error)}` } : doc,
      );
  }, []);

  const makeEnqueuedUpdater = useCallback((tempId: string, fileId: string) => {
    return (prev: Document[]) =>
      prev.map((doc) =>
        doc.id === tempId ? { ...doc, id: String(fileId), status: 'processing' as const, progress: 0, summary: 'In queue...' } : doc,
      );
  }, []);

  type StatusShape = {
    status: DocumentStatus;
    progress?: number;
    summary?: string;
    error?: string;
    chunksCount?: number;
  };

  const makeStatusUpdater = useCallback((fileId: string, status: StatusShape) => {
    const today = new Date().toISOString().split('T')[0];
    return (prev: Document[]) =>
      prev.map((doc) =>
        doc.id === fileId
          ? {
              ...doc,
              status: status.status,
              progress: status.progress,
              summary: status.error ? `❌ ${status.error}` : status.summary ?? doc.summary,
              chunks: status.chunksCount ?? doc.chunks,
              updated: today,
            }
          : doc,
      );
  }, []);

  const makeFailureUpdater = useCallback((fileId: string, error: unknown) => {
    return (prev: Document[]) =>
      prev.map((doc) => (doc.id === fileId ? { ...doc, status: 'failed' as const, summary: `❌ Error: ${String(error)}` } : doc));
  }, []);

  const makeTimeoutUpdater = useCallback((fileId: string) => {
    return (prev: Document[]) =>
      prev.map((doc) =>
        doc.id === fileId ? { ...doc, status: 'failed' as const, summary: '❌ Timeout: processing took too long' } : doc,
      );
  }, []);

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

  // Load documents from API
  const loadDocuments = useCallback(async () => {
    try {
      console.log('[DocumentsPage] Loading documents from API...');
      const response = await fetch('http://localhost:3456/files/indexed');
      
      if (!response.ok) {
        console.error('[DocumentsPage] Failed to load documents:', response.statusText);
        return;
      }
      
      const statusResponses = await response.json();
      console.log('[DocumentsPage] Loaded', (statusResponses as Array<unknown>).length, 'documents from API');
      setDocsFromStatusResponses(statusResponses as Array<Record<string, unknown>>);
      console.log('[DocumentsPage] Documents loaded successfully');
    } catch (error) {
      console.error('[DocumentsPage] Error loading documents:', error);
      // Silently fail - API might not be running yet
    }
  }, [setDocsFromStatusResponses]);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('[DocumentsPage] 📨 Received message from extension:', message.type, message);
      
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
          // Call API to clear all files from database
          console.log('[DocumentsPage] Clearing all documents...');
          fetch('http://localhost:3456/files/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
            .then(response => response.json())
            .then(result => {
              if (result.success) {
                console.log('[DocumentsPage] ✅ All files cleared from database');
                setDocuments([]);
              } else {
                console.error('[DocumentsPage] ❌ Failed to clear files:', result.error);
              }
            })
            .catch(error => {
              console.error('[DocumentsPage] ❌ Error clearing files:', error);
            });
          break;
        }
        case 'document/cleared': {
          setDocuments([]);
          break;
        }
        case 'document/list': {
          const docs = message.payload.documents || [];
          setDocuments(docs.map((d: Document) => ({ ...d, selected: false })));
          break;
        }
        case 'document/scan-started': {
          setIsScanning(true);
          break;
        }
        case 'document/scan-completed': {
          setIsScanning(false);
          // Reload documents after scan completes
          const reloadAfterScan = async () => {
            try {
              const response = await fetch('http://localhost:3456/files/indexed');
              if (!response.ok) return;
              const statusResponses = (await response.json()) as Array<Record<string, unknown>>;
              setDocsFromStatusResponses(statusResponses);
              console.log('[DocumentsPage] Reloaded', statusResponses.length, 'documents after scan');
            } catch (error) {
              console.error('[DocumentsPage] Failed to reload after scan:', error);
            }
          };
          reloadAfterScan();
          break;
        }
      }
    };

    globalThis.addEventListener('message', handleMessage as EventListener);
    return () => globalThis.removeEventListener('message', handleMessage as EventListener);
  }, [removeDocumentById, setDocsFromStatusResponses, updateDocument]);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const all = documents.length;
    const completed = documents.filter((d) => d.status === 'completed').length;
    const preprocessed = documents.filter((d) => d.status === 'preprocessed').length;
    const processing = documents.filter((d) => d.status === 'processing').length;
    const pending = documents.filter((d) => d.status === 'pending').length;
    const failed = documents.filter((d) => d.status === 'failed').length;
    return { all, completed, preprocessed, processing, pending, failed };
  }, [documents]);

  // Documentos filtrados e ordenados
  const filteredDocuments = useMemo(() => {
    console.log('[DocumentsPage] Computing filteredDocuments, total documents:', documents.length);
    console.log('[DocumentsPage] Documents:', documents);
    
    let filtered = documents;
    if (statusFilter !== 'all') {
      filtered = documents.filter((d) => d.status === statusFilter);
    }
    
    // Ordenação
    return [...filtered].sort((a, b) => {
      let compareValue = 0;
      if (sortField === 'id') {
        compareValue = a.id.localeCompare(b.id);
      } else if (sortField === 'created') {
        compareValue = a.created.localeCompare(b.created);
      } else if (sortField === 'updated') {
        compareValue = a.updated.localeCompare(b.updated);
      }
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
  }, [documents, statusFilter, sortField, sortOrder]);

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
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = newDocuments[i].id;
      
      try {
        // Upload file to API
        await uploadFileToAPI(file, tempId);
      } catch (error) {
        console.error('[DocumentsPage] Upload error:', error);
        setDocuments(makeUploadFailedUpdater(tempId, error));
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFileToAPI = async (file: File, tempId: string): Promise<void> => {
    // Read file as base64
    const reader = new FileReader();
    
    const fileContent = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:*/*;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => {
        const err = reader.error instanceof Error ? reader.error : new Error(String(reader.error ?? 'File read error'));
        reject(err);
      };
      reader.readAsDataURL(file);
    });

    // Upload to API
    const response = await fetch('http://localhost:3456/files/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        filePath: file.name, // Will be saved to temp folder by API
        content: fileContent
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    const fileId = result.fileId;

    console.log('[DocumentsPage] File enqueued:', fileId);

    // Update document with real fileId and start polling
    setDocuments(makeEnqueuedUpdater(tempId, String(fileId)));

    // Start polling for status
    pollFileStatus(String(fileId));
  };

  const pollFileStatus = async (fileId: string): Promise<void> => {
    const pollInterval = 1000; // 1 second
    const maxPolls = 120; // 2 minutes max
    let polls = 0;

    const poll = async () => {
      if (polls >= maxPolls) {
        console.warn('[DocumentsPage] Max polls reached for file:', fileId);
        setDocuments(makeTimeoutUpdater(fileId));
        return;
      }

      try {
        const response = await fetch(`http://localhost:3456/files/status?fileId=${fileId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }

        const status = await response.json();
        
        console.log('[DocumentsPage] Status update for', fileId, ':', status);
        
        // Update document status
        setDocuments(makeStatusUpdater(fileId, status));

        // Continue polling if still processing
        if (status.status === 'processing' || status.status === 'pending') {
          polls++;
          setTimeout(poll, pollInterval);
        } else {
          console.log('[DocumentsPage] File processing finished:', fileId, status.status);
          if (status.error) {
            console.error('[DocumentsPage] Error details:', status.error);
          } else if (status.chunksCount) {
            console.log('[DocumentsPage] ✅ Processed with', status.chunksCount, 'chunks');
          }
        }
      } catch (error) {
        console.error('[DocumentsPage] Status poll error:', error);
        setDocuments(makeFailureUpdater(fileId, error));
      }
    };

    poll();
  };

  const handleScan = async () => {
    // Prefer extension-driven scan when running inside VS Code (more reliable than direct API call)
    if (vscodeApi) {
      console.log('[DocumentsPage] 🔍 handleScan: Delegating to VS Code extension');
      setIsScanning(true);
      postMessage('document/scan');
      return;
    }
    // Fallback to direct API when running outside VS Code
    console.log('[DocumentsPage] 🔍 handleScan called, calling API /scan/workspace');
    setIsScanning(true);
    try {
      const response = await fetch('http://localhost:3456/scan/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`Scan failed: ${response.statusText}`);
      const result = await response.json();
      console.log('[DocumentsPage] ✅ Scan API response:', result);
      // Wait a bit for the scan to populate data, then reload
      setTimeout(async () => {
        try {
          const filesResponse = await fetch('http://localhost:3456/files/indexed');
          if (filesResponse.ok) {
            const statusResponses = await filesResponse.json();
            interface StatusResponse {
              fileId: string;
              fileName?: string;
              filePath?: string;
              summary?: string;
              status: DocumentStatus;
              chunksCount?: number;
              fileSize?: number;
            }
            const docs: Document[] = (statusResponses as StatusResponse[]).map((sr) => ({
              id: sr.fileId,
              fileName: sr.fileName || 'Unknown',
              filePath: sr.filePath,
              summary: sr.summary || '',
              status: sr.status,
              length: sr.fileSize || 0,
              chunks: sr.chunksCount || 0,
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              selected: false,
            }));
            setDocuments(docs);
            console.log('[DocumentsPage] Reloaded', docs.length, 'documents after scan');
          }
        } catch (error) {
          console.error('[DocumentsPage] Failed to reload after scan:', error);
        }
        setIsScanning(false);
      }, 2000);
    } catch (error) {
      console.error('[DocumentsPage] ❌ Scan API error:', error);
      setIsScanning(false);
    }
  };

  const handleRetry = () => {
    const failedDocs = documents.filter((d) => d.status === 'failed');
    if (failedDocs.length > 0) {
      postMessage('document/retry', { documentIds: failedDocs.map((d) => d.id) });
    }
  };

  const reprocessDocument = async (fileId: string) => {
    try {
      // Find the document to get its filePath
      const doc = documents.find(d => d.id === fileId);
      if (!doc?.filePath) {
        throw new Error('File path not found');
      }

      const res = await fetch('http://localhost:3456/files/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: doc.filePath })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reprocess');
      }

      // Optimistically update UI
      setDocuments((prev) =>
        prev.map((d) => (d.id === fileId ? { ...d, status: 'processing', progress: 50, summary: '🔄 Reprocessing...' } : d)),
      );
      
      // Reload documents after a short delay
      setTimeout(() => {
        loadDocuments();
      }, 2000);
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
                      {documents.length > 0 && filteredDocuments.length === 0 && (
                        <tr>
                          <td colSpan={8} className="h-32 px-4 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <p className="font-medium text-yellow-600 dark:text-yellow-400">No documents match filter</p>
                              <p className="text-sm text-muted-foreground">
                                Found {documents.length} total document(s), but none match the "{statusFilter}" filter
                              </p>
                              <Button variant="outline" onClick={() => setStatusFilter('all')} className="mt-2">
                                Show All Documents
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {documents.length === 0 && filteredDocuments.length === 0 ? (
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
                            {filteredDocuments.map((doc) => {
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
                                  {doc.status === 'processing' || doc.status === 'pending' ? (
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
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsPage;
