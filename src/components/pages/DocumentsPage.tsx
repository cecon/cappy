import React, { useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Button from '../ui/Button';

interface VSCodeApi {
  postMessage: (message: Record<string, unknown>) => void;
}

const DocumentsPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [recentActions, setRecentActions] = useState<string[]>([]);

  const vscodeApi = useMemo(() => {
    if (typeof window !== 'undefined' && 'acquireVsCodeApi' in window) {
      const acquire = (window as typeof window & { acquireVsCodeApi?: () => VSCodeApi }).acquireVsCodeApi;
      return acquire ? acquire() : undefined;
    }
    return undefined;
  }, []);

  const registerAction = (message: string) => {
    setRecentActions((prev) => [message, ...prev].slice(0, 5));
  };

  const postMessage = (type: string, payload: Record<string, unknown> = {}) => {
    vscodeApi?.postMessage({ type, payload });
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
    registerAction('📤 Upload dialog opened');
    postMessage('documents/upload-requested');
  };

  const handleFilesSelected: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const names = Array.from(files)
      .map((file) => file.name)
      .slice(0, 3)
      .join(', ');

    registerAction(`✅ Ready to ingest ${files.length} file(s): ${names}${files.length > 3 ? '…' : ''}`);
    postMessage('documents/upload-selected', {
      files: Array.from(files).map((file) => ({ name: file.name, type: file.type, size: file.size })),
    });
    // Reset input so the same file can be picked twice in a row
    event.target.value = '';
  };

  const handleScanWorkspace = () => {
    registerAction('🛠️ Workspace scan triggered');
    postMessage('documents/scan-workspace');
  };

  const handleConfigureSources = () => {
    registerAction('⚙️ Source configuration opened');
    postMessage('documents/configure-sources');
  };

  return (
    <div className="webui-page">
      <div className="webui-section">
        <div className="grid gap-6 xl:grid-cols-[2.1fr,1fr]">
          <Card className="shadow-xl border border-border/60 backdrop-blur-sm">
            <CardHeader className="border-b border-border/40 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <span>📁</span>
                    <span>Document Manager</span>
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-relaxed">
                    Upload, index and monitor documents powering your knowledge graph
                  </CardDescription>
                </div>
                <span className="webui-chip">Workspace Connected</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-8 lg:grid-cols-[1.4fr,1fr]">
                <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-emerald-400/40 bg-emerald-500/5 py-16 text-center">
                  <div className="text-7xl opacity-50 drop-shadow">📄</div>
                  <h3 className="text-xl font-semibold text-foreground">
                    Drop files here or choose an action
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    Drag & drop files, paste snippets, or scan your workspace to keep the graph fresh.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                      />
                      <Button variant="primary" className="px-6 py-2 shadow-md" onClick={handleUpload}>
                      📤 Upload Documents
                    </Button>
                      <Button variant="outline" className="px-6 py-2" onClick={handleScanWorkspace}>
                      🔍 Scan Workspace
                    </Button>
                      <Button variant="ghost" className="px-6 py-2 text-muted-foreground" onClick={handleConfigureSources}>
                      ➕ Configure Sources
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="webui-callout">
                    <strong>Auto-ingestion disabled.</strong> Schedule a nightly sync or push new content manually.
                  </div>
                  <Card className="border border-border/60 shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        ⚡ Quick Actions
                      </CardTitle>
                      <CardDescription>Kickstart ingestion workflows</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <Button variant="outline" className="w-full justify-between text-sm">
                        Sync Git repository <span>↗</span>
                      </Button>
                      <Button variant="outline" className="w-full justify-between text-sm">
                        Import Notion space <span>↗</span>
                      </Button>
                      <Button variant="outline" className="w-full justify-between text-sm">
                        Connect S3 bucket <span>↗</span>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg border border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  🚀 Ingestion Pipeline
                </CardTitle>
                <CardDescription>Track the journey from raw files to graph entities</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="webui-timeline">
                  <li>
                    <strong>Collect Sources</strong>
                    <span className="block text-xs text-muted-foreground">Upload files, connect repositories, watch folders</span>
                  </li>
                  <li>
                    <strong>Chunk & Embed</strong>
                    <span className="block text-xs text-muted-foreground">Split content, generate embeddings, enrich metadata</span>
                  </li>
                  <li>
                    <strong>Update Graph</strong>
                    <span className="block text-xs text-muted-foreground">Merge entities, link relationships, compute metrics</span>
                  </li>
                </ol>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  🔔 Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 text-sm text-muted-foreground">
                {recentActions.length === 0 ? (
                  <p>No ingestion activity yet. Start by importing your first data source.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentActions.map((action, index) => (
                      <li key={`${action}-${index}`} className="flex items-center gap-2">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-lg border border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              📊 Index Health
            </CardTitle>
            <CardDescription>Monitoring snapshot of your knowledge base</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="webui-stat-card">
                <div className="value">0</div>
                <div className="label">Documents</div>
              </div>
              <div className="webui-stat-card">
                <div className="value">0</div>
                <div className="label">Chunks</div>
              </div>
              <div className="webui-stat-card">
                <div className="value">0</div>
                <div className="label">Entities</div>
              </div>
              <div className="webui-stat-card">
                <div className="value">0%</div>
                <div className="label">Coverage</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DocumentsPage;
