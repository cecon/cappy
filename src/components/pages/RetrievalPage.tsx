import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Button from '../ui/Button';

const RetrievalPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col p-6 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Retrieval Testing</CardTitle>
          <CardDescription>
            Test different retrieval modes and query strategies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Query Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter your query..."
                className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button variant="primary">
                Search
              </Button>
            </div>

            {/* Mode Selection */}
            <div className="flex gap-2">
              <span className="text-sm font-medium">Mode:</span>
              <Button variant="outline" size="sm">Local</Button>
              <Button variant="outline" size="sm">Global</Button>
              <Button variant="primary" size="sm">Hybrid</Button>
              <Button variant="outline" size="sm">Mix</Button>
            </div>

            {/* Results Placeholder */}
            <div className="mt-4 border rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">🔎</div>
              <p className="text-sm text-muted-foreground">
                Enter a query to see results
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📜 Query History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No queries yet
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RetrievalPage;
