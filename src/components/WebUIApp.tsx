import { useState } from 'react';
import { Tabs, TabsContent } from './ui/Tabs';
import Header from './layout/Header';
import './WebUI.css';
import DocumentsPage from './pages/DocumentsPage';
import GraphPage from './pages/GraphPage';
import RetrievalPage from './pages/RetrievalPage';
import ApiPage from './pages/ApiPage';

function WebUIApp() {
  const [currentTab, setCurrentTab] = useState('documents');

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex h-full flex-col">
        <Header currentTab={currentTab} onTabChange={setCurrentTab} />
        
        <div className="relative flex-1 overflow-hidden">
          <TabsContent 
            value="documents" 
            className="absolute inset-0 overflow-auto m-0"
          >
            <DocumentsPage />
          </TabsContent>
          
          <TabsContent 
            value="knowledge-graph" 
            className="absolute inset-0 overflow-auto m-0"
          >
            <GraphPage />
          </TabsContent>
          
          <TabsContent 
            value="retrieval" 
            className="absolute inset-0 overflow-auto m-0"
          >
            <RetrievalPage />
          </TabsContent>
          
          <TabsContent 
            value="api" 
            className="absolute inset-0 overflow-auto m-0"
          >
            <ApiPage />
          </TabsContent>
        </div>
      </Tabs>

      {/* Status Bar */}
      <div className="flex h-6 items-center border-t border-border/40 bg-muted px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          <span>Ready</span>
        </div>
        <span className="ml-auto">Cappy v3.0.2</span>
      </div>
    </div>
  );
}

export default WebUIApp;
