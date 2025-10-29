import React from 'react';
import { Card, CardContent } from '../../../primitives';

const RetrievalPage: React.FC = () => {
  return (
    <div className="webui-page">
      <div className="webui-section space-y-6">
        <Card className="shadow-lg border border-border/60">
          <CardContent className="pt-6 space-y-2">
            <h2 className="text-xl font-semibold">🔍 Retrieval</h2>
            <p className="text-sm text-muted-foreground">
              Retrieval tooling is being migrated. This is a placeholder UI.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RetrievalPage;
