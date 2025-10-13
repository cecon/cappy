import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';

const ApiPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col p-6 gap-4 overflow-auto">
      <Card>
        <CardHeader>
          <CardTitle>📡 API Documentation</CardTitle>
          <CardDescription>
            REST API endpoints and usage examples
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Endpoint: Load Graph */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <h3 className="font-semibold mb-2">POST /api/graph/load</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Load graph data with optional filters
              </p>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                {`{
  "filter": {
    "nodeTypes": ["document", "entity"],
    "minConfidence": 0.8
  },
  "maxNodes": 500
}`}
              </div>
            </div>

            {/* Endpoint: Search */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold mb-2">POST /api/graph/search</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Search nodes and edges in the graph
              </p>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                {`{
  "query": "authentication",
  "mode": "fuzzy",
  "maxResults": 20
}`}
              </div>
            </div>

            {/* Endpoint: Calculate Metrics */}
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold mb-2">POST /api/graph/metrics</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Calculate graph metrics (PageRank, Clustering, etc.)
              </p>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                {`{
  "includePageRank": true,
  "includeClustering": true,
  "includeBetweenness": false
}`}
              </div>
            </div>

            {/* Endpoint: Export */}
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="font-semibold mb-2">POST /api/graph/export</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Export graph in various formats
              </p>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                {`{
  "format": "json" | "graphml" | "cytoscape" | "gexf" | "dot" | "csv",
  "includeMetadata": true
}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🔑 Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All API requests require authentication via VS Code extension context.
            No additional API keys needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiPage;
