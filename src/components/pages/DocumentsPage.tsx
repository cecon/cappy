import React, { useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import Button from '../ui/Button';

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
  summary: string;
  status: DocumentStatus;
  length: number;
  chunks: number;
  created: Date;
  updated: Date;
  trackId?: string;
  processingStartTime?: string;
  selected: boolean;
}

const DocumentsPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFileName, setShowFileName] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 'doc-f78d02f794784279e2c690006fd9111b',
      fileName: 'README.md',
      summary: '# React + TypeScript + Vite\n\nThis template provides a minimal setup to get React working in Vite with HMR and some ESLint rules...',
      status: 'processing',
      length: 2626,
      chunks: 1,
      created: new Date('2025-10-16T16:03:28'),
      updated: new Date('2025-10-16T16:03:28'),
      trackId: 'upload_20251016_190328_8ca7b860',
      processingStartTime: '16/10/2025, 16:03:28',
      selected: false
    }
  ]);

  const vscodeApi = useMemo(() => {
    if (typeof window !== 'undefined') {
      const w = window as WindowWithVSCode & { acquireVsCodeApi?: () => VSCodeApi };
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
    vscodeApi?.postMessage({ type, payload });
  };

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
        compareValue = a.created.getTime() - b.created.getTime();
      } else if (sortField === 'updated') {
        compareValue = a.updated.getTime() - b.updated.getTime();
      }
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
  }, [documents, statusFilter, sortField, sortOrder]);

  const handleUpload = () => {
    fileInputRef.current?.click();
    postMessage('documents/upload-requested');
  };

  const handleFilesSelected: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    postMessage('documents/upload-selected', {
      files: Array.from(files).map((file) => ({ name: file.name, type: file.type, size: file.size })),
    });
    event.target.value = '';
  };

  const handleScan = () => {
    postMessage('documents/scan-workspace');
  };

  const handleRetry = () => {
    const failedDocs = documents.filter((d) => d.status === 'failed');
    if (failedDocs.length > 0) {
      postMessage('documents/retry-failed', { documentIds: failedDocs.map((d) => d.id) });
    }
  };

  const handlePipeline = () => {
    postMessage('documents/view-pipeline');
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all documents?')) {
      setDocuments([]);
      postMessage('documents/clear-all');
    }
  };

  const handleRefresh = () => {
    postMessage('documents/refresh');
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

  const formatDate = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'processing':
        return '⟳';
      case 'failed':
        return '✗';
      case 'pending':
        return '○';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
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
              <Button variant="outline" onClick={handleScan} className="h-9">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scan
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
            <CardHeader className="flex-none py-2 px-4">
              <div className="flex justify-between items-center">
                <CardTitle className="leading-none font-semibold">Uploaded Documents</CardTitle>
                <div className="flex items-center gap-2">
                  {/* Filtros de status */}
                  <div className="flex gap-1">
                    <Button
                      variant={statusFilter === 'all' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('all')}
                      className="h-9"
                    >
                      All ({stats.all})
                    </Button>
                    <Button
                      variant={statusFilter === 'completed' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('completed')}
                      className={`h-9 ${stats.completed === 0 ? 'text-gray-500' : ''}`}
                    >
                      Completed ({stats.completed})
                    </Button>
                    <Button
                      variant={statusFilter === 'preprocessed' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('preprocessed')}
                      className={`h-9 ${stats.preprocessed === 0 ? 'text-gray-500' : ''}`}
                    >
                      Preprocessed ({stats.preprocessed})
                    </Button>
                    <Button
                      variant={statusFilter === 'processing' ? 'secondary' : 'outline'}
                      onClick={() => setStatusFilter('processing')}
                      className={`h-9 ${stats.processing > 0 ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 font-medium border-blue-400 dark:border-blue-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      Processing ({stats.processing})
                    </Button>
                    <Button
                      variant={statusFilter === 'pending' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('pending')}
                      className={`h-9 ${stats.pending === 0 ? 'text-gray-500' : ''}`}
                    >
                      Pending ({stats.pending})
                    </Button>
                    <Button
                      variant={statusFilter === 'failed' ? 'primary' : 'outline'}
                      onClick={() => setStatusFilter('failed')}
                      className={`h-9 ${stats.failed === 0 ? 'text-gray-500' : ''}`}
                    >
                      Failed ({stats.failed})
                    </Button>
                  </div>

                  <Button variant="ghost" onClick={handleRefresh} className="h-9">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="toggle-filename-btn" className="text-sm text-gray-500">
                    File Name
                  </label>
                  <Button
                    id="toggle-filename-btn"
                    variant="outline"
                    onClick={() => setShowFileName(!showFileName)}
                    className="h-9"
                  >
                    {showFileName ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <div className="flex-1 relative p-0">
              <div className="absolute inset-0 flex flex-col p-0">
                <div className="absolute inset-[-1px] flex flex-col p-0 border rounded-md border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="sticky top-0 bg-background z-10 shadow-sm">
                        <tr className="border-b bg-card/95 backdrop-blur shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">
                          <th
                            className="h-10 px-2 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 select-none"
                            onClick={() => handleSort('id')}
                          >
                            <div className="flex items-center">
                              ID
                              {sortField === 'id' && (
                                <span className="ml-1">
                                  {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                            Summary
                          </th>
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                            Length
                          </th>
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">
                            Chunks
                          </th>
                          <th
                            className="h-10 px-2 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 select-none"
                            onClick={() => handleSort('created')}
                          >
                            <div className="flex items-center">
                              Created
                              {sortField === 'created' && (
                                <span className="ml-1">
                                  {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="h-10 px-2 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 select-none"
                            onClick={() => handleSort('updated')}
                          >
                            <div className="flex items-center">
                              Updated
                              {sortField === 'updated' && (
                                <span className="ml-1">
                                  {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                          <th className="h-10 px-2 w-16 text-center align-middle font-medium text-muted-foreground">
                            Select
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-sm overflow-auto">
                        {filteredDocuments.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-muted-foreground">
                              No documents found. Upload files to get started.
                            </td>
                          </tr>
                        ) : (
                          filteredDocuments.map((doc) => (
                            <tr key={doc.id} className="border-b hover:bg-muted/50 transition-colors">
                              <td className="p-2 align-middle truncate font-mono max-w-[250px]">
                                <div className="group relative">
                                  <div className="truncate">
                                    {showFileName ? doc.fileName : doc.id}
                                  </div>
                                  {!showFileName && (
                                    <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded px-2 py-1 whitespace-nowrap z-50">
                                      {doc.fileName}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 align-middle max-w-xs truncate">
                                <div className="group relative">
                                  <div className="truncate">{truncateText(doc.summary, 100)}</div>
                                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded px-2 py-1 max-w-md z-50">
                                    {doc.summary}
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 align-middle">
                                <div className="group relative flex items-center">
                                  <span className={getStatusColor(doc.status)}>
                                    {getStatusIcon(doc.status)} {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                                  </span>
                                  {doc.trackId && (
                                    <>
                                      <svg className="ml-2 h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4M12 8h.01" />
                                      </svg>
                                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded px-2 py-1 whitespace-nowrap z-50">
                                        Track ID: {doc.trackId}
                                        {doc.processingStartTime && (
                                          <div className="mt-1">Started: {doc.processingStartTime}</div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 align-middle">{doc.length.toLocaleString()}</td>
                              <td className="p-2 align-middle">{doc.chunks}</td>
                              <td className="p-2 align-middle truncate">{formatDate(doc.created)}</td>
                              <td className="p-2 align-middle truncate">{formatDate(doc.updated)}</td>
                              <td className="p-2 align-middle text-center">
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={doc.selected}
                                  onClick={() => toggleDocumentSelection(doc.id)}
                                  className={`h-4 w-4 shrink-0 rounded-sm border mx-auto ${
                                    doc.selected
                                      ? 'bg-muted text-muted-foreground border-primary'
                                      : 'border-primary'
                                  }`}
                                >
                                  {doc.selected && (
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsPage;
