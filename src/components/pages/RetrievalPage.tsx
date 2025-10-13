import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Button from '../ui/Button';

const RetrievalPage: React.FC = () => {
  return (
    <div className="webui-page">
      <div className="webui-section space-y-6">
        <div className="grid gap-6 xl:grid-cols-[2.2fr,1fr]">
          <Card className="shadow-xl border border-border/60">
            <CardHeader className="border-b border-border/40 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <span>🔍</span>
                    <span>Retrieval Playground</span>
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-relaxed">
                    Benchmark hybrid retrieval strategies before going to production.
                  </CardDescription>
                </div>
                <span className="webui-chip">Embeddings ready</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="flex flex-col gap-3">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Query</label>
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    type="text"
                    placeholder="e.g. Como a autenticação está implementada?"
                    className="flex-1 h-11 rounded-lg border border-border/60 bg-background/80 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                  <Button variant="primary" className="h-11 px-6">
                    Run search
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Retrieval mode</label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1">
                    🧠 Local
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    🌍 Global
                  </Button>
                  <Button variant="primary" size="sm" className="gap-1">
                    ⚡ Hybrid
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    🧮 Mix
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="webui-callout">
                  <strong>Hybrid</strong> blends local vector similarities with global semantic expansion.
                </div>
                <div className="webui-callout">
                  <strong>Mix</strong> lets you orchestrate multi-prompt strategies and voting.
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-emerald-400/40 bg-emerald-500/5 p-8 text-center">
                <div className="text-5xl mb-3 opacity-50">🔎</div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Execute your first query to inspect ranked passages, scores and metadata.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg border border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  🧪 Evaluation Presets
                </CardTitle>
                <CardDescription>Compare ranking quality across settings</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 text-sm text-muted-foreground">
                <p>• Run k=5 vs k=15 candidate retrieval</p>
                <p>• Switch between cosine and dot-product similarity</p>
                <p>• Toggle entity expansion to capture related content</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  ⚙️ Operators
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm text-muted-foreground">
                <p>• `boost(type:document, weight:1.2)`</p>
                <p>• `filter(confidence &gt;= 0.8)`</p>
                <p>• `expand(depth:2, include:"entity")`</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-lg border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              📜 Query History
            </CardTitle>
            <CardDescription>Recent experiments and their outcomes</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground text-center py-6">
              No queries yet. Run your first retrieval above.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RetrievalPage;
