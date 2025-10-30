import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../../../primitives';

type VSCodeApi = { postMessage: (message: unknown) => void };
type WindowWithVSCode = Window & { vscodeApi?: VSCodeApi };

interface RetrievedContext {
  id: string;
  content: string;
  source: 'code' | 'documentation' | 'task' | 'prevention' | 'metadata';
  score: number;
  filePath?: string;
  metadata: {
    title?: string;
    category?: string;
    keywords?: string[];
    type?: string;
  };
  snippet?: string;
}

interface RetrievalResult {
  contexts: RetrievedContext[];
  metadata: {
    query: string;
    strategy: string;
    totalFound: number;
    returned: number;
    executionTime: number;
  };
}

const RetrievalPage: React.FC = () => {
  const vscodeApi = useMemo(() => {
    if (globalThis.window !== undefined) {
      const w = globalThis.window as WindowWithVSCode & { acquireVsCodeApi?: () => VSCodeApi };
      if (w.vscodeApi) return w.vscodeApi;
      if (typeof w.acquireVsCodeApi === 'function') {
        const api = w.acquireVsCodeApi();
        w.vscodeApi = api;
        return api;
      }
    }
    return undefined;
  }, []);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>(['code', 'documentation', 'prevention']);
  const [strategy, setStrategy] = useState<'hybrid' | 'semantic' | 'keyword' | 'graph'>('hybrid');
  const [maxResults, setMaxResults] = useState(10);
  const [minScore, setMinScore] = useState(0.5);

  const handleSearch = useCallback(() => {
    if (!query.trim() || !vscodeApi) return;
    
    setIsSearching(true);
    setError(null);
    
    console.log('[RetrievalPage] Sending search request:', {
      query,
      strategy,
      maxResults,
      minScore,
      sources: selectedSources
    });
    
    vscodeApi.postMessage({
      type: 'retrieval/search',
      payload: {
        query: query.trim(),
        options: {
          strategy,
          maxResults,
          minScore,
          sources: selectedSources,
          rerank: true,
          includeRelated: true
        }
      }
    });
  }, [query, vscodeApi, strategy, maxResults, minScore, selectedSources]);

  useEffect(() => {
    function handler(event: MessageEvent) {
      if (event.origin !== globalThis.window.origin) {
        return;
      }
      
      const message = event.data as {
        type?: string;
        payload?: unknown;
        error?: string;
      };
      
      console.log('[RetrievalPage] Received message:', message.type);
      
      if (message.type === 'retrieval/result') {
        console.log('[RetrievalPage] Search result:', message.payload);
        setResult(message.payload as RetrievalResult);
        setIsSearching(false);
      } else if (message.type === 'retrieval/error') {
        console.error('[RetrievalPage] Search error:', message.error);
        setError(message.error || 'Unknown error');
        setIsSearching(false);
      }
    }
    
    globalThis.window.addEventListener('message', handler);
    return () => globalThis.window.removeEventListener('message', handler);
  }, []);

  const toggleSource = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'code': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'documentation': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'prevention': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'task': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <div className="webui-page h-full flex flex-col">
      <div className="webui-section flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* Search Bar */}
        <Card className="shadow-lg border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <span>🔍</span>
              <span>Hybrid Retrieval</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Search across code, documentation, prevention rules, and tasks using hybrid retrieval strategies
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter your search query..."
                className="flex-1 px-4 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSearching}
              />
              <Button 
                variant="primary" 
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                className="px-6"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/40">
              <div className="space-y-2">
                <div className="text-sm font-medium">Sources</div>
                <div className="flex flex-wrap gap-2">
                  {['code', 'documentation', 'prevention', 'task'].map(source => (
                    <Button
                      key={source}
                      variant={selectedSources.includes(source) ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => toggleSource(source)}
                      className="text-xs"
                    >
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="strategy-select" className="text-sm font-medium">Strategy</label>
                <select
                  id="strategy-select"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as typeof strategy)}
                  className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
                >
                  <option value="hybrid">Hybrid (All strategies)</option>
                  <option value="semantic">Semantic Only</option>
                  <option value="keyword">Keyword Only</option>
                  <option value="graph">Graph Traversal</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="max-results-slider" className="text-sm font-medium">Max Results: {maxResults}</label>
                <input
                  id="max-results-slider"
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number.parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="min-score-slider" className="text-sm font-medium">Min Score: {minScore.toFixed(2)}</label>
                <input
                  id="min-score-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={minScore}
                  onChange={(e) => setMinScore(Number.parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {error && (
            <Card className="shadow-lg border border-red-500/50 bg-red-500/5">
              <CardContent className="pt-6">
                <p className="text-red-600 dark:text-red-400">❌ {error}</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              {/* Metadata */}
              <Card className="shadow-lg border border-border/60">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Strategy</div>
                      <div className="font-semibold">{result.metadata.strategy}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Found</div>
                      <div className="font-semibold">{result.metadata.totalFound}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Returned</div>
                      <div className="font-semibold">{result.metadata.returned}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Time</div>
                      <div className="font-semibold">{result.metadata.executionTime}ms</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Query</div>
                      <div className="font-semibold truncate">{result.metadata.query}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results List */}
              {result.contexts.length === 0 ? (
                <Card className="shadow-lg border border-border/60">
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No results found. Try adjusting your query or filters.
                  </CardContent>
                </Card>
              ) : (
                result.contexts.map((context, idx) => (
                  <Card key={context.id} className="shadow-lg border border-border/60 hover:border-primary/50 transition-colors">
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">#{idx + 1}</span>
                            {context.metadata.title && (
                              <h3 className="text-lg font-semibold">{context.metadata.title}</h3>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getSourceColor(context.source)}`}>
                              {context.source}
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              Score: {(context.score * 100).toFixed(1)}%
                            </span>
                            {context.metadata.category && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border">
                                {context.metadata.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {context.snippet && (
                        <div className="bg-muted/50 p-3 rounded-md">
                          <pre className="text-xs whitespace-pre-wrap font-mono">{context.snippet}</pre>
                        </div>
                      )}

                      {context.filePath && (
                        <div className="text-xs text-muted-foreground">
                          📁 {context.filePath}
                        </div>
                      )}

                      {context.metadata.keywords && context.metadata.keywords.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Keywords:</span>
                          {context.metadata.keywords.slice(0, 5).map((keyword) => (
                            <span key={`${context.id}-${keyword}`} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-background border border-border">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {!result && !error && !isSearching && (
            <Card className="shadow-lg border border-border/60">
              <CardContent className="pt-6 text-center">
                <div className="space-y-3">
                  <div className="text-6xl opacity-30">🔍</div>
                  <h3 className="text-lg font-semibold">Start Searching</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Enter a query to search across your indexed codebase, documentation, prevention rules, and tasks using hybrid retrieval strategies.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default RetrievalPage;
