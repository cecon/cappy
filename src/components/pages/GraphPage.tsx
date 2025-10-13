import React from 'react';
import { Card, CardContent } from '../ui/Card';
import Button from '../ui/Button';

const GraphPage: React.FC = () => {
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
                  <Button variant="primary" size="sm" className="gap-1">
                    ⚡ Auto-refresh
                  </Button>
                </div>
              </div>

              <div className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden bg-gradient-to-br from-emerald-500/10 via-transparent to-indigo-500/10">
                <div className="absolute inset-x-6 top-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="webui-chip">No graph loaded</span>
                  <span className="webui-chip">0 nodes · 0 edges</span>
                </div>
                <div className="text-8xl opacity-30 drop-shadow-lg">�</div>
                <div className="text-center space-y-2 px-4">
                  <h3 className="text-xl font-semibold text-foreground">Graph visualization coming next</h3>
                  <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                    The interactive React + Reagraph canvas will render here. Index documents to unlock graph insights, community detection and rich exploration tools.
                  </p>
                </div>
                <Button variant="primary" className="px-6 py-2 text-sm shadow-lg">
                  🚀 Load Graph Snapshot
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
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
