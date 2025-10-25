import { useState, useEffect, useMemo } from 'react';
import { Card } from '../../primitives/Card';
import Button from '../../primitives/Button';
import GraphVisualizer from '../../graph/GraphVisualizer';

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
  // NOVO: Pipeline de filtragem
  pipeline?: {
    original: unknown[];
    filtered: unknown[];
    deduplicated: unknown[];
    normalized: unknown[];
    enriched: unknown[];
    stats: {
      totalRaw: number;
      totalFiltered: number;
      discardedCount: number;
      deduplicatedCount: number;
      finalCount: number;
      processingTimeMs: number;
    };
  };
}

export default function DebugPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
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
        console.log('[DebugPage] Has pipeline?', !!message.payload.pipeline);
        if (message.payload.pipeline) {
          console.log('[DebugPage] Pipeline keys:', Object.keys(message.payload.pipeline));
          console.log('[DebugPage] Pipeline stats:', message.payload.pipeline.stats);
        }
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

          {/* Results Card */}
          <Card className="p-6">
            {analysis.error ? (
              <div className="text-red-500">
                <h3 className="font-semibold mb-2">Error</h3>
                <p>{analysis.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analysis.pipeline ? (
                      <>
                        <h3 className="text-lg font-semibold mb-4">🔄 Pipeline de Filtragem de Entidades</h3>
                    
                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-muted p-4 rounded-md">
                        <div className="text-2xl font-bold text-blue-400">{analysis.pipeline.stats.totalRaw}</div>
                        <div className="text-xs text-muted-foreground">Entidades Brutas</div>
                      </div>
                      <div className="bg-muted p-4 rounded-md">
                        <div className="text-2xl font-bold text-green-400">{analysis.pipeline.stats.finalCount}</div>
                        <div className="text-xs text-muted-foreground">Entidades Finais</div>
                      </div>
                      <div className="bg-muted p-4 rounded-md">
                        <div className="text-2xl font-bold text-yellow-400">{analysis.pipeline.stats.discardedCount}</div>
                        <div className="text-xs text-muted-foreground">Descartadas</div>
                      </div>
                      <div className="bg-muted p-4 rounded-md">
                        <div className="text-2xl font-bold text-purple-400">{analysis.pipeline.stats.deduplicatedCount}</div>
                        <div className="text-xs text-muted-foreground">Mescladas</div>
                      </div>
                      <div className="bg-muted p-4 rounded-md">
                        <div className="text-2xl font-bold text-orange-400">
                          {((1 - analysis.pipeline.stats.finalCount / analysis.pipeline.stats.totalRaw) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Taxa de Compressão</div>
                      </div>
                      <div className="bg-muted p-4 rounded-md">
                        <div className="text-2xl font-bold text-cyan-400">{analysis.pipeline.stats.processingTimeMs}ms</div>
                        <div className="text-xs text-muted-foreground">Tempo de Processamento</div>
                      </div>
                    </div>

                    {/* Pipeline Flow */}
                    <div className="space-y-6">
                      {/* Etapa 1: Raw Entities */}
                      <div className="border border-border rounded-md p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <span className="text-blue-400">1️⃣</span>
                          Entidades Brutas (AST)
                          <span className="text-xs bg-blue-900/30 px-2 py-1 rounded">{analysis.pipeline.original.length}</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Todas as entidades extraídas do AST sem nenhum filtro
                        </p>
                        <details className="text-xs">
                          <summary className="cursor-pointer hover:text-primary">Ver detalhes</summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(analysis.pipeline.original, null, 2)}
                          </pre>
                        </details>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center text-muted-foreground">
                        <span>↓ Filtro de Relevância ↓</span>
                      </div>

                      {/* Etapa 2: Filtered */}
                      <div className="border border-border rounded-md p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <span className="text-green-400">2️⃣</span>
                          Entidades Filtradas
                          <span className="text-xs bg-green-900/30 px-2 py-1 rounded">{analysis.pipeline.filtered.length}</span>
                          <span className="text-xs text-red-400">(-{analysis.pipeline.stats.discardedCount})</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          ❌ Descartadas: variáveis locais, tipos primitivos, imports de assets
                        </p>
                        <details className="text-xs">
                          <summary className="cursor-pointer hover:text-primary">Ver detalhes</summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(analysis.pipeline.filtered, null, 2)}
                          </pre>
                        </details>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center text-muted-foreground">
                        <span>↓ Deduplicação ↓</span>
                      </div>

                      {/* Etapa 3: Deduplicated */}
                      <div className="border border-border rounded-md p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <span className="text-purple-400">3️⃣</span>
                          Entidades Deduplicadas
                          <span className="text-xs bg-purple-900/30 px-2 py-1 rounded">{analysis.pipeline.deduplicated.length}</span>
                          <span className="text-xs text-purple-400">(-{analysis.pipeline.stats.deduplicatedCount})</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          🔗 Mesclados: imports do mesmo pacote, entidades duplicadas
                        </p>
                        <details className="text-xs">
                          <summary className="cursor-pointer hover:text-primary">Ver detalhes</summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(analysis.pipeline.deduplicated, null, 2)}
                          </pre>
                        </details>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center text-muted-foreground">
                        <span>↓ Normalização ↓</span>
                      </div>

                      {/* Etapa 4: Normalized */}
                      <div className="border border-border rounded-md p-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <span className="text-yellow-400">4️⃣</span>
                          Entidades Normalizadas
                          <span className="text-xs bg-yellow-900/30 px-2 py-1 rounded">{analysis.pipeline.normalized.length}</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          📦 Adicionado: package info, categorias (internal/external/builtin), paths normalizados
                        </p>
                        <details className="text-xs">
                          <summary className="cursor-pointer hover:text-primary">Ver detalhes</summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(analysis.pipeline.normalized, null, 2)}
                          </pre>
                        </details>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center text-muted-foreground">
                        <span>↓ Enriquecimento ↓</span>
                      </div>

                      {/* Etapa 5: Enriched (Final) */}
                      <div className="border border-green-500/50 rounded-md p-4 bg-green-900/10">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <span className="text-green-400">5️⃣</span>
                          Entidades Enriquecidas (SALVAS NO BANCO)
                          <span className="text-xs bg-green-900/30 px-2 py-1 rounded">{analysis.pipeline.enriched.length}</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          ✨ Adicionado: relacionamentos, confiança, documentação
                        </p>
                        <details className="text-xs">
                          <summary className="cursor-pointer hover:text-primary">Ver detalhes</summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(analysis.pipeline.enriched, null, 2)}
                          </pre>
                        </details>

                        {/* Graph Visualization */}
                        <div className="mt-6">
                          <h5 className="font-semibold mb-2 flex items-center gap-2">
                            <span className="text-cyan-400">🕸️</span>
                            Visualização de Grafo (Entidades e Relacionamentos)
                          </h5>
                          <GraphFromPipeline analysis={analysis} />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    <p className="text-lg mb-2">⚠️ Pipeline não disponível</p>
                    <p className="text-sm">
                      O arquivo foi analisado com o sistema antigo.
                      <br />
                      Recarregue a janela (Ctrl+R) e tente novamente para ver o pipeline de filtragem.
                    </p>
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

// ----- Graph adapter from pipeline -----
type GraphNode = { id: string; label: string; type?: 'file' | 'chunk' | 'workspace' };
type GraphEdge = { id: string; source: string; target: string; label?: string };
type PipelineRelationship = { target: string; type: string; confidence?: number };
type PipelineEntity = { name: string; type: string; relationships?: PipelineRelationship[] };

function GraphFromPipeline({ analysis }: { analysis: FileAnalysis }) {
  const data = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    if (!analysis?.pipeline) return { nodes, edges };

    // File node
    const fileNodeId = `file:${analysis.fileName}`;
    nodes.push({ id: fileNodeId, label: analysis.fileName, type: 'file' });

    const ensureNode = (id: string, label?: string, type: 'file' | 'chunk' | 'workspace' = 'chunk') => {
      if (!nodes.find(n => n.id === id)) {
        nodes.push({ id, label: label || id, type });
      }
    };

    const addEdge = (source: string, target: string, label?: string) => {
      const id = `${source}->${target}:${label || 'rel'}`;
      if (!edges.find(e => e.id === id)) {
        edges.push({ id, source, target, label });
      }
    };

    // Create entity nodes and link to file
  for (const e of analysis.pipeline.enriched as Array<PipelineEntity>) {
      const entityId = `entity:${e.name}:${e.type}`;
      const entityLabel = `${e.name} (${e.type})`;
      ensureNode(entityId, entityLabel, 'chunk');
      addEdge(fileNodeId, entityId, 'contains');

      // Relationships
      if (Array.isArray(e.relationships)) {
        for (const r of e.relationships) {
          // Normalize target id
          const targetId = String(r.target).startsWith('entity:')
            ? String(r.target)
            : `entity:${String(r.target)}`;
          ensureNode(targetId, String(r.target), 'chunk');
          addEdge(entityId, targetId, r.type);
        }
      }
    }

    return { nodes, edges };
  }, [analysis]);

  if (!analysis?.pipeline) return null;

  return (
    <div className="mt-2">
      <GraphVisualizer nodes={data.nodes} edges={data.edges} />
    </div>
  );
}
