import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';

const ApiPage: React.FC = () => {
  return (
    <div className="webui-page">
      <div className="webui-section space-y-6">
        <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <Card className="shadow-xl border border-border/60">
            <CardHeader className="border-b border-border/40 pb-5">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <span>📡</span>
                <span>Cappy Graph API</span>
              </CardTitle>
              <CardDescription className="mt-2 text-sm leading-relaxed">
                REST endpoints to interact with the knowledge graph programmatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                      POST
                    </span>
                    <h3 className="font-semibold text-lg text-foreground">/api/graph/load</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Load batches of nodes + edges</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Load the graph with optional filters and pagination.
                </p>
                <pre className="mt-4 rounded-xl bg-black/50 p-4 text-xs leading-relaxed text-emerald-100">
{`{
  "filter": {
    "nodeTypes": ["document", "entity"],
    "minConfidence": 0.8
  },
  "maxNodes": 500
}`}
                </pre>
              </div>

              <div className="rounded-2xl border border-sky-400/35 bg-sky-500/5 p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-sky-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-200">
                      POST
                    </span>
                    <h3 className="font-semibold text-lg text-foreground">/api/graph/search</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Semantic + lexical search</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Search nodes and edges with hybrid retrieval modes.
                </p>
                <pre className="mt-4 rounded-xl bg-black/50 p-4 text-xs leading-relaxed text-sky-100">
{`{
  "query": "authentication",
  "mode": "fuzzy",
  "maxResults": 20
}`}
                </pre>
              </div>

              <div className="rounded-2xl border border-purple-400/35 bg-purple-500/5 p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-purple-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-100">
                      POST
                    </span>
                    <h3 className="font-semibold text-lg text-foreground">/api/graph/metrics</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Insights & scoring</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Calculate PageRank, clustering coefficients and betweenness.
                </p>
                <pre className="mt-4 rounded-xl bg-black/50 p-4 text-xs leading-relaxed text-purple-100">
{`{
  "includePageRank": true,
  "includeClustering": true,
  "includeBetweenness": false
}`}
                </pre>
              </div>

              <div className="rounded-2xl border border-orange-400/35 bg-orange-500/5 p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-orange-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-100">
                      POST
                    </span>
                    <h3 className="font-semibold text-lg text-foreground">/api/graph/export</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Share & integrate</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Export snapshots in JSON, GraphML, GEXF, DOT or CSV formats.
                </p>
                <pre className="mt-4 rounded-xl bg-black/50 p-4 text-xs leading-relaxed text-orange-100">
{`{
  "format": "json" | "graphml" | "gexf" | "dot" | "csv",
  "includeMetadata": true
}`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg border border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  🔑 Authentication
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground space-y-3">
                <p>Requests inherit the authenticated VS Code session.</p>
                <p>No API keys needed. Tokens rotate automatically.</p>
                <p>
                  Use the <code className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-emerald-100">Authorization: Bearer &#123;token&#125;</code> header when calling from external clients.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  ⏱️ Rate Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
                <p>• 120 requests / minute per workspace.</p>
                <p>• Burst handling with graceful degradation.</p>
                <p>• Contact the team for enterprise tiers.</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  🧰 SDK & Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
                <p>• JavaScript client (`@cappy/graph-sdk`).</p>
                <p>• Postman collection available in the docs.</p>
                <p>• Webhooks for incremental sync coming soon.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiPage;
