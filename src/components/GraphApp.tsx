import { useState } from 'react';
import { Tabs, TabsContent } from './ui/Tabs';
import Header from './layout/Header';
import './WebUI.css';
import DocumentsPage from './pages/DocumentsPage';
import GraphPage from './pages/GraphPage';
import RetrievalPage from './pages/RetrievalPage';
import ApiPage from './pages/ApiPage';

function GraphApp() {
  const [currentTab, setCurrentTab] = useState('knowledge-graph');

  return (
    <div className="webui-shell text-foreground">
      <div className="webui-content">
        <Tabs
          value={currentTab}
          defaultValue="knowledge-graph"
          onValueChange={setCurrentTab}
          className="flex h-full flex-col"
        >
          <Header currentTab={currentTab} onTabChange={setCurrentTab} />

          <div className="flex-1 overflow-hidden">
            <TabsContent
              value="documents"
              className="h-full overflow-auto"
            >
              <DocumentsPage />
            </TabsContent>

            <TabsContent
              value="knowledge-graph"
              className="h-full overflow-auto"
            >
              <GraphPage />
            </TabsContent>

            <TabsContent
              value="retrieval"
              className="h-full overflow-auto"
            >
              <RetrievalPage />
            </TabsContent>

            <TabsContent
              value="api"
              className="h-full overflow-auto"
            >
              <ApiPage />
            </TabsContent>
          </div>
        </Tabs>

        {/* Status Bar */}
        <div className="webui-status">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-400" />
            <span>Ready</span>
          </div>
          <span className="ml-auto">Cappy v3.0.4</span>
        </div>
      </div>
    </div>
  );
}

export default GraphApp;
