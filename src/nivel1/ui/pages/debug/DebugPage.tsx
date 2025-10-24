import { useState, useEffect } from 'react';
import { Card } from '../../primitives/Card';
import Button from '../../primitives/Button';

type VSCodeApi = { postMessage: (message: unknown) => void };
type WindowWithVSCode = Window & {
  acquireVsCodeApi?: () => VSCodeApi;
  vscodeApi?: VSCodeApi;
};

interface ASTNode {
  type: string;
  [key: string]: unknown;
}

interface FileAnalysis {
  fileName: string;
  fileSize: number;
  mimeType: string;
  ast?: ASTNode;
  entities?: unknown[];
  signatures?: unknown[];
  metadata?: Record<string, unknown>;
  error?: string;
}

export default function DebugPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedView, setSelectedView] = useState<'ast' | 'entities' | 'signatures' | 'metadata'>('ast');
  const [vscodeApi, setVscodeApi] = useState<VSCodeApi | null>(null);

  // Initialize VS Code API
  useEffect(() => {
    try {
      const w = (globalThis as { window: unknown }).window as WindowWithVSCode & { acquireVsCodeApi?: () => VSCodeApi };
      
      if (typeof w.acquireVsCodeApi === 'function') {
        const api = w.acquireVsCodeApi();
        w.vscodeApi = api;
        setVscodeApi(api);
        console.log('[DebugPage] VS Code API acquired');
      } else if (w.vscodeApi) {
        setVscodeApi(w.vscodeApi);
        console.log('[DebugPage] VS Code API reused');
      } else {
        console.warn('[DebugPage] VS Code API not available');
      }
    } catch (error) {
      console.error('[DebugPage] Error acquiring VS Code API:', error);
    }
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      // Clear timeout if exists
      const timeoutId = (window as unknown as { _debugAnalysisTimeout?: NodeJS.Timeout })._debugAnalysisTimeout;
      if (timeoutId) {
        clearTimeout(timeoutId);
        delete (window as unknown as { _debugAnalysisTimeout?: NodeJS.Timeout })._debugAnalysisTimeout;
      }
      
      if (message.type === 'debug/analyze-result') {
        console.log('[DebugPage] Received analysis result:', message.payload);
        setAnalysis(message.payload);
        setLoading(false);
      } else if (message.type === 'debug/analyze-error') {
        console.error('[DebugPage] Analysis error:', message.payload);
        setAnalysis({
          fileName: file?.name || 'unknown',
          fileSize: file?.size || 0,
          mimeType: file?.type || 'unknown',
          error: message.payload.error,
        });
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAnalysis(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      console.error('[DebugPage] Cannot analyze: no file selected');
      return;
    }

    if (!vscodeApi) {
      setAnalysis({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        error: 'Not connected to VS Code. Please reload the window (Ctrl+Shift+P → "Developer: Reload Window") to enable backend analysis.',
      });
      return;
    }

    setLoading(true);
    
    // Set a timeout to detect if analysis doesn't respond
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.error('[DebugPage] Analysis timeout - no response from extension');
        setAnalysis({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          error: 'Analysis timeout. The extension might not be responding. Try reloading the window.',
        });
        setLoading(false);
      }
    }, 30000); // 30 second timeout

    try {
      // Read file content
      const fileContent = await file.text();

      console.log('[DebugPage] Sending analyze request to extension');
      
      // Send message to extension for analysis
      vscodeApi.postMessage({
        type: 'debug/analyze',
        payload: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'text/plain',
          content: fileContent
        }
      });
      
      // Clear timeout when we get a response (in useEffect listener)
      // Store timeoutId for cleanup
      (window as unknown as { _debugAnalysisTimeout?: NodeJS.Timeout })._debugAnalysisTimeout = timeoutId;
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[DebugPage] Error analyzing file:', error);
      setAnalysis({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setLoading(false);
    }
  };

  const renderAST = (node: unknown, depth = 0): React.ReactElement => {
    if (!node || typeof node !== 'object') {
      return <span className="text-muted-foreground">{JSON.stringify(node)}</span>;
    }

    const n = node as Record<string, unknown>;
    const indent = depth * 20;

    return (
      <div style={{ marginLeft: `${indent}px` }} className="border-l border-border pl-2 my-1">
        <div className="font-mono text-sm">
          {typeof n.type === 'string' && (
            <span className="text-blue-400 font-semibold">{n.type}</span>
          )}
          {Object.entries(n).map(([key, value]) => {
            if (key === 'type') return null;
            if (Array.isArray(value)) {
              return (
                <div key={key} className="mt-1">
                  <span className="text-purple-400">{key}</span>
                  <span className="text-muted-foreground">: [</span>
                  {value.map((item, idx) => (
                    <div key={idx}>{renderAST(item, depth + 1)}</div>
                  ))}
                  <span className="text-muted-foreground">]</span>
                </div>
              );
            }
            if (typeof value === 'object' && value !== null) {
              return (
                <div key={key} className="mt-1">
                  <span className="text-purple-400">{key}</span>
                  <span className="text-muted-foreground">: {'{'}</span>
                  {renderAST(value, depth + 1)}
                  <span className="text-muted-foreground">{'}'}</span>
                </div>
              );
            }
            return (
              <div key={key} className="mt-1">
                <span className="text-purple-400">{key}</span>
                <span className="text-muted-foreground">: </span>
                <span className="text-green-400">{JSON.stringify(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Debug Tool</h1>
          <p className="text-muted-foreground">
            Upload files to analyze AST, entities, and signatures
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex h-2 w-2 rounded-full ${vscodeApi ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-xs text-muted-foreground">
              {vscodeApi ? 'Connected to VS Code' : 'Running in browser (reload window to connect)'}
            </span>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium mb-2"
            >
              Select File
            </label>
            <input
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              accept=".ts,.tsx,.js,.jsx,.py,.java,.cs,.cpp,.c,.h,.php,.rb,.go,.rs"
            />
          </div>

          {file && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">File:</span> {file.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Size:</span> {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button onClick={handleAnalyze} disabled={loading}>
                {loading ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* View Selector */}
          <div className="flex gap-2">
            <Button
              variant={selectedView === 'ast' ? 'primary' : 'outline'}
              onClick={() => setSelectedView('ast')}
            >
              AST
            </Button>
            <Button
              variant={selectedView === 'entities' ? 'primary' : 'outline'}
              onClick={() => setSelectedView('entities')}
            >
              Entities
            </Button>
            <Button
              variant={selectedView === 'signatures' ? 'primary' : 'outline'}
              onClick={() => setSelectedView('signatures')}
            >
              Signatures
            </Button>
            <Button
              variant={selectedView === 'metadata' ? 'primary' : 'outline'}
              onClick={() => setSelectedView('metadata')}
            >
              Metadata
            </Button>
          </div>

          {/* Results Card */}
          <Card className="p-6">
            {analysis.error ? (
              <div className="text-red-500">
                <h3 className="font-semibold mb-2">Error</h3>
                <p>{analysis.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedView === 'ast' && analysis.ast && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Abstract Syntax Tree</h3>
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-[600px] font-mono text-xs">
                      {renderAST(analysis.ast)}
                    </div>
                  </div>
                )}

                {selectedView === 'entities' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Extracted Entities</h3>
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre className="text-xs">
                        {JSON.stringify(analysis.entities || [], null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {selectedView === 'signatures' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Code Signatures</h3>
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre className="text-xs">
                        {JSON.stringify(analysis.signatures || [], null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {selectedView === 'metadata' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">File Metadata</h3>
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre className="text-xs">
                        {JSON.stringify({
                          fileName: analysis.fileName,
                          fileSize: analysis.fileSize,
                          mimeType: analysis.mimeType,
                          ...analysis.metadata,
                        }, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
