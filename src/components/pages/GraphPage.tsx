import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import GraphVisualizer from '../GraphVisualizer';

const GraphPage: React.FC = () => {
  type VSCodeApi = { postMessage: (message: unknown) => void };
  type WindowWithVSCode = Window & { vscodeApi?: VSCodeApi };

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

  const [dbStatus, setDbStatus] = useState<{ exists: boolean; created?: boolean; path?: string } | null>(null);
  const [graph, setGraph] = useState<{ nodes: Array<{ id: string; label: string }>; edges: Array<{ id: string; source: string; target: string; label?: string }> } | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as { type?: string; exists?: boolean; created?: boolean; path?: string; nodes?: Array<{ id: string; label: string }>; edges?: Array<{ id: string; source: string; target: string; label?: string }> };
      if (message?.type === 'db-status') {
        setDbStatus({ exists: !!message.exists, created: !!message.created, path: message.path });
      }
      if (message?.type === 'subgraph') {
        if (message.nodes && message.edges) {
          setGraph({ nodes: message.nodes, edges: message.edges });
        }
      }
    };

    window.addEventListener('message', handler);
    // Ask for current status on mount
    vscodeApi?.postMessage({ type: 'get-db-status' });
    return () => window.removeEventListener('message', handler);
  }, [vscodeApi]);

  const handleResetDb = () => {
    vscodeApi?.postMessage({ type: 'kuzu-reset' });
  };

  const loadGraph = (depth: number) => {
    vscodeApi?.postMessage({ type: 'load-subgraph', depth: Math.min(10, Math.max(0, depth)) });
  };

  const handleAutoRefresh = () => {
    // Recarrega o canvas a partir do banco de dados
    setGraph(null); // Limpa o grafo atual
    vscodeApi?.postMessage({ type: 'get-db-status' }); // Atualiza status do DB
    loadGraph(2); // Recarrega o grafo com profundidade padrão
  };

  return (
    <div className="webui-page">
      <div className="webui-section space-y-6">
        <div className="grid gap-6 xl:grid-cols-[3fr,1.1fr]">
          <Card className="shadow-2xl border border-border/60 overflow-hidden">
            <CardContent className="p-0 flex h-full flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-card/40 px-6 py-5 backdrop-blur-sm">
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-semibold">
                    <span>🌐</span>
                    <span>Knowledge Graph Canvas</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Explore relationships across your indexed sources and entities
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" className="gap-1">
                    🔍 Search
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    🎨 Layout
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    💾 Export
                  </Button>
                  <Button variant="primary" size="sm" className="gap-1" onClick={handleAutoRefresh}>
                    ⚡ Auto-refresh
                  </Button>
                </div>
              </div>

              <div className="relative flex flex-1 flex-col gap-4 overflow-auto bg-gradient-to-br from-emerald-500/10 via-transparent to-indigo-500/10 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="webui-chip">{graph ? 'Subgraph loaded' : 'No graph loaded'}</span>
                  <span className="webui-chip">{graph ? `${graph.nodes.length} nodes · ${graph.edges.length} edges` : '0 nodes · 0 edges'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" onClick={() => loadGraph(2)}>Load Graph</Button>
                  <Button variant="outline" size="sm" onClick={() => loadGraph(4)}>4 levels</Button>
                  <Button variant="outline" size="sm" onClick={() => loadGraph(6)}>6 levels</Button>
                  <Button variant="outline" size="sm" onClick={() => loadGraph(10)}>10 levels</Button>
                </div>
                {graph && graph.nodes.length > 0 ? (
                  <GraphVisualizer nodes={graph.nodes} edges={graph.edges} />
                ) : (
                  <div className="flex flex-1 items-center justify-center text-center">
                    <div className="space-y-3">
                      <div className="text-6xl opacity-30">📊</div>
                      <h3 className="text-lg font-semibold">No graph data yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Click "Load Graph" to visualize the knowledge graph with nodes and relationships
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg border border-border/60">
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  🧪 Kuzu Explorer
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <span className="webui-chip">
                      {dbStatus ? (dbStatus.exists ? 'Ready' : 'Missing') : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Created Now</span>
                    <span className="webui-chip">{dbStatus?.created ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="truncate text-xs text-foreground/80">
                    {dbStatus?.path || '—'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => vscodeApi?.postMessage({ type: 'get-db-status' })}>
                    🔄 Refresh
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleResetDb}>
                    🗑️ Reset DB
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border border-border/60">
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  📊 Graph Summary
                </h3>
                <div className="grid gap-4">
                  <div className="webui-stat-card">
                    <div className="value">0</div>
                    <div className="label">Communities</div>
                  </div>
                  <div className="webui-stat-card">
                    <div className="value">0%</div>
                    <div className="label">Density</div>
                  </div>
                  <div className="webui-stat-card">
                    <div className="value">0</div>
                    <div className="label">Central Nodes</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-border/60">
              <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  🧭 Navigation Tips
                </h3>
                <ul className="space-y-2">
                  <li>• Scroll to zoom, drag canvas to pan across the graph.</li>
                  <li>• Click a node to open the details drawer with related entities.</li>
                  <li>• Use the layout menu to switch between force, radial and tree views.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-lg border border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  🔄 Sync Insights
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep your knowledge graph aligned with the latest indexed sources
                </p>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="webui-chip">Live preview</span>
                <span className="webui-chip">Metrics recalculated hourly</span>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="webui-stat-card">
                <div className="value">0</div>
                <div className="label">Pending Jobs</div>
              </div>
              <div className="webui-stat-card">
                <div className="value">0</div>
                <div className="label">Updated Nodes</div>
              </div>
              <div className="webui-stat-card">
                <div className="value">0</div>
                <div className="label">New Relationships</div>
              </div>
              <div className="webui-stat-card">
                <div className="value">0</div>
                <div className="label">Anomalies</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GraphPage;
