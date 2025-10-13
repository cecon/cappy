import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Button from '../ui/Button';

const GraphPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col p-6 gap-4">
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>🌐 Knowledge Graph</CardTitle>
              <CardDescription>
                Visualize and explore your knowledge graph
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                🔍 Search
              </Button>
              <Button variant="outline" size="sm">
                🎨 Layout
              </Button>
              <Button variant="outline" size="sm">
                💾 Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="flex h-full flex-col items-center justify-center gap-4 border rounded-lg bg-muted/10">
            <div className="text-6xl">📊</div>
            <h3 className="text-lg font-semibold">Graph Visualization</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              React + D3.js/Reagraph visualization will be integrated here.
              Index some documents first to see your knowledge graph.
            </p>
            <Button variant="primary">
              Load Graph
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📊 Graph Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Nodes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Edges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Communities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0%</div>
              <div className="text-sm text-muted-foreground">Density</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GraphPage;
