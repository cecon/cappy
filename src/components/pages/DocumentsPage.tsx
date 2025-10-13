import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import Button from '../ui/Button';

const DocumentsPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col p-6 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>📁 Document Manager</CardTitle>
          <CardDescription>
            Upload and manage documents for indexing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-6xl">📄</div>
            <h3 className="text-lg font-semibold">No documents yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Upload documents or scan your workspace to start building your knowledge graph
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="primary">
                Upload Documents
              </Button>
              <Button variant="outline">
                Scan Workspace
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📊 Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Chunks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Entities</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsPage;
