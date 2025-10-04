# Mini-LightRAG API Documentation

## 📋 Overview

This document provides comprehensive API documentation for integrating with Mini-LightRAG programmatically. It covers TypeScript interfaces, command APIs, configuration options, and extension points.

---

## 🏗️ Core Architecture

### System Components

```typescript
interface LightRAGSystem {
  orchestrator: QueryOrchestrator;      // Central coordination
  store: LanceDBStore;                  // Vector storage
  embeddings: EmbeddingService;         // Text to vectors
  chunker: ChunkingService;             // Text segmentation
  graph: LightGraphService;             // Relationship mapping
  indexer: IncrementalIndexer;          // Change detection
  search: HybridSearchService;          // Multi-modal search
  ui: UIManager;                        // Interface management
  performance: PerformanceManager;      // Optimization
}
```

### Data Models

```typescript
interface SearchResult {
  chunk: {
    id: string;                         // Unique chunk identifier
    path: string;                       // File path
    startLine: number;                  // Start line in file
    endLine: number;                    // End line in file
    text: string;                       // Chunk content
    language?: string;                  // Programming language
    fileType: 'code' | 'doc' | 'config' | 'test';
  };
  score: number;                        // Overall relevance (0-1)
  explanation: {
    vectorScore: number;                // Semantic similarity
    graphScore: number;                 // Relationship strength
    freshnessScore: number;             // Recency factor
    whyRelevant: string;                // Human explanation
  };
  relationships?: {
    similarChunks: string[];            // Related chunk IDs
    dependencies: string[];             // Code dependencies
    referencedBy: string[];             // What references this
  };
}

interface SearchContext {
  workspacePath: string;                // Workspace root
  activeDocument?: vscode.TextDocument; // Current file
  cursorContext?: {
    line: number;
    character: number;
    surroundingText: string;            // Context around cursor
    functionName?: string;              // Current function
    className?: string;                 // Current class
  };
  searchHistory?: string[];             // Previous queries
  filters?: {
    fileTypes?: string[];               // Limit to file types
    directories?: string[];             // Limit to directories
    timeRange?: {                       // Limit by modification time
      start: Date;
      end: Date;
    };
  };
}
```

---

## 🔌 Command API

### Core Commands

All LightRAG functionality is accessible via VS Code commands:

```typescript
// Initialize LightRAG system
await vscode.commands.executeCommand('cappy.lightrag.initialize', {
  workspacePath: string;
  config?: Partial<LightRAGConfig>;
});

// Search with query string
await vscode.commands.executeCommand('cappy.lightrag.search', 
  query: string, 
  context?: SearchContext
): Promise<SearchResult[]>;

// Search selected text
await vscode.commands.executeCommand('cappy.lightrag.searchSelection'): Promise<void>;

// Index workspace
await vscode.commands.executeCommand('cappy.lightrag.indexWorkspace', {
  force?: boolean;                      // Force complete reindex
  incremental?: boolean;                // Only index changes
}): Promise<IndexingResult>;

// Get system status
await vscode.commands.executeCommand('cappy.lightrag.status'): Promise<SystemStatus>;

// Quick search dialog
await vscode.commands.executeCommand('cappy.lightrag.quickSearch'): Promise<void>;

// Clear cache
await vscode.commands.executeCommand('cappy.lightrag.clearCache'): Promise<void>;
```

### Advanced Commands

```typescript
// Index specific files
await vscode.commands.executeCommand('cappy.lightrag.indexFiles', {
  files: string[];                      // Array of file paths
  priority?: 'high' | 'normal' | 'low'; // Processing priority
}): Promise<void>;

// Get similar chunks
await vscode.commands.executeCommand('cappy.lightrag.findSimilar', {
  chunkId: string;                      // Reference chunk
  limit?: number;                       // Max results (default: 10)
}): Promise<SearchResult[]>;

// Analyze relationships
await vscode.commands.executeCommand('cappy.lightrag.analyzeRelationships', {
  filePath: string;                     // Target file
  includeTransitive?: boolean;          // Include indirect relationships
}): Promise<RelationshipGraph>;

// Export index data
await vscode.commands.executeCommand('cappy.lightrag.exportIndex', {
  format: 'json' | 'csv';              // Export format
  outputPath: string;                   // Output file path
}): Promise<void>;
```

---

## ⚙️ Configuration API

### Configuration Schema

```typescript
interface LightRAGConfig {
  // Vector settings
  vectorDimension: number;              // 256 | 384 | 512
  indexType: 'HNSW' | 'IVF';          // Index algorithm
  
  // Indexing configuration
  indexing: {
    batchSize: number;                  // Files per batch (50-200)
    maxConcurrency: number;             // Parallel workers (1-8)
    autoIndexOnSave: boolean;           // Index on file save
    autoIndexInterval: number;          // Auto-index interval (ms)
    
    chunkSize: {
      min: number;                      // Min chunk size (100-500)
      max: number;                      // Max chunk size (500-2000)
      overlap: number;                  // Overlap ratio (0.1-0.3)
    };
    
    includePatterns: string[];          // Glob patterns to include
    skipPatterns: string[];             // Glob patterns to skip
    
    languageWeights: {                  // Language-specific weights
      typescript: number;
      javascript: number;
      markdown: number;
      json: number;
      [key: string]: number;
    };
  };
  
  // Search configuration
  search: {
    maxResults: number;                 // Max search results (10-50)
    expandHops: number;                 // Graph traversal depth (1-3)
    
    // Scoring weights (must sum to 1.0)
    vectorWeight: number;               // Semantic similarity (0.4-0.8)
    graphWeight: number;                // Relationship strength (0.1-0.4)
    freshnessWeight: number;            // Recency factor (0.1-0.3)
    
    cacheTimeMinutes: number;           // Result cache TTL (5-60)
    enableQueryExpansion: boolean;      // Auto-expand queries
    enableContextBoost: boolean;        // Boost cursor context
  };
  
  // Performance settings
  performance: {
    enableOptimizations: boolean;       // Enable auto-optimizations
    memoryLimit: string;                // Memory limit ('512MB', '1GB', '2GB')
    cacheStrategy: 'conservative' | 'balanced' | 'aggressive';
    
    batchProcessing: {
      enabled: boolean;
      maxBatchSize: number;
      processingDelay: number;          // Delay between batches (ms)
    };
    
    monitoring: {
      enabled: boolean;
      reportInterval: number;           // Status report interval (ms)
      alertThresholds: {
        memoryUsage: number;            // Memory alert threshold (0.8)
        searchLatency: number;          // Latency alert threshold (ms)
        cacheHitRate: number;           // Cache hit rate threshold (0.7)
      };
    };
  };
  
  // UI configuration
  ui: {
    statusBar: {
      enabled: boolean;
      showDetails: boolean;             // Show detailed status
      updateInterval: number;           // Update interval (ms)
    };
    
    resultsPanel: {
      theme: 'light' | 'dark' | 'auto';
      showScores: boolean;              // Show relevance scores
      showExplanations: boolean;        // Show why results are relevant
      enablePreview: boolean;           // Enable code preview
    };
    
    notifications: {
      enabled: boolean;
      level: 'error' | 'warning' | 'info'; // Notification level
      showProgress: boolean;            // Show indexing progress
    };
  };
}
```

### Configuration Management

```typescript
// Get current configuration
const config = await vscode.commands.executeCommand('cappy.lightrag.getConfig'): Promise<LightRAGConfig>;

// Update configuration
await vscode.commands.executeCommand('cappy.lightrag.updateConfig', {
  config: Partial<LightRAGConfig>;
  merge?: boolean;                      // Merge with existing (default: true)
}): Promise<void>;

// Reset to defaults
await vscode.commands.executeCommand('cappy.lightrag.resetConfig'): Promise<void>;

// Validate configuration
await vscode.commands.executeCommand('cappy.lightrag.validateConfig', {
  config: LightRAGConfig;
}): Promise<ValidationResult>;
```

---

## 📊 Status and Monitoring API

### System Status

```typescript
interface SystemStatus {
  isInitialized: boolean;
  isIndexing: boolean;
  lastIndexTime: Date;
  
  stats: {
    totalFiles: number;                 // Files in workspace
    indexedFiles: number;               // Files in index
    totalChunks: number;                // Total chunks
    indexSize: string;                  // Storage size
  };
  
  performance: {
    avgSearchTime: number;              // Average search time (ms)
    cacheHitRate: number;               // Cache hit rate (0-1)
    memoryUsage: string;                // Current memory usage
    lastOptimization: Date;             // Last optimization run
  };
  
  errors: {
    indexingErrors: string[];           // Recent indexing errors
    searchErrors: string[];             // Recent search errors
    systemErrors: string[];             // System-level errors
  };
  
  health: 'healthy' | 'warning' | 'error'; // Overall health
}

// Get detailed status
const status = await vscode.commands.executeCommand('cappy.lightrag.getStatus'): Promise<SystemStatus>;

// Get performance metrics
const metrics = await vscode.commands.executeCommand('cappy.lightrag.getMetrics'): Promise<PerformanceMetrics>;
```

### Performance Monitoring

```typescript
interface PerformanceMetrics {
  search: {
    totalQueries: number;
    avgLatency: number;                 // Average latency (ms)
    p95Latency: number;                 // 95th percentile
    p99Latency: number;                 // 99th percentile
    errorRate: number;                  // Error rate (0-1)
  };
  
  indexing: {
    filesPerSecond: number;             // Indexing throughput
    avgFileTime: number;                // Average time per file (ms)
    totalIndexTime: number;             // Total indexing time (ms)
    failureRate: number;                // Indexing failure rate (0-1)
  };
  
  memory: {
    currentUsage: string;               // Current usage
    peakUsage: string;                  // Peak usage
    gcFrequency: number;                // Garbage collection frequency
    heapUtilization: number;            // Heap utilization (0-1)
  };
  
  cache: {
    hitRate: number;                    // Overall hit rate (0-1)
    missRate: number;                   // Miss rate (0-1)
    evictionRate: number;               // Eviction rate
    sizeUtilization: number;            // Size utilization (0-1)
  };
}
```

---

## 🔍 Search API

### Search Methods

```typescript
interface SearchAPI {
  // Basic search
  search(query: string, context?: SearchContext): Promise<SearchResult[]>;
  
  // Advanced search with filters
  advancedSearch(params: {
    query: string;
    fileTypes?: string[];               // Filter by file types
    directories?: string[];             // Filter by directories
    dateRange?: [Date, Date];           // Filter by modification date
    minScore?: number;                  // Minimum relevance score
    maxResults?: number;                // Maximum results
  }): Promise<SearchResult[]>;
  
  // Semantic similarity search
  findSimilar(chunkId: string, options?: {
    limit?: number;                     // Max results
    threshold?: number;                 // Similarity threshold
    includeSource?: boolean;            // Include source chunk
  }): Promise<SearchResult[]>;
  
  // Multi-query search
  batchSearch(queries: string[], context?: SearchContext): Promise<SearchResult[][]>;
}

// Access search API
const searchAPI = await vscode.commands.executeCommand('cappy.lightrag.getSearchAPI'): Promise<SearchAPI>;
```

### Query Expansion

```typescript
interface QueryExpansion {
  // Expand query with synonyms and related terms
  expandQuery(query: string): Promise<{
    original: string;
    expanded: string[];
    synonyms: string[];
    relatedTerms: string[];
  }>;
  
  // Get query suggestions
  getSuggestions(partial: string): Promise<string[]>;
  
  // Analyze query intent
  analyzeIntent(query: string): Promise<{
    type: 'code' | 'documentation' | 'configuration' | 'test';
    confidence: number;
    suggestions: string[];
  }>;
}
```

---

## 🗄️ Indexing API

### Index Management

```typescript
interface IndexingAPI {
  // Index specific files
  indexFiles(files: string[], options?: {
    priority?: 'high' | 'normal' | 'low';
    force?: boolean;                    // Force reindex even if unchanged
  }): Promise<IndexingResult>;
  
  // Remove files from index
  removeFiles(files: string[]): Promise<void>;
  
  // Check if file is indexed
  isIndexed(file: string): Promise<boolean>;
  
  // Get indexing progress
  getProgress(): Promise<{
    isRunning: boolean;
    completed: number;
    total: number;
    currentFile: string;
    estimatedTimeRemaining: number;     // Milliseconds
  }>;
  
  // Stop indexing
  stopIndexing(): Promise<void>;
}

interface IndexingResult {
  success: boolean;
  filesProcessed: number;
  chunksCreated: number;
  errors: string[];
  duration: number;                     // Processing time (ms)
}
```

### Incremental Updates

```typescript
interface IncrementalUpdate {
  // Handle file changes
  onFileChanged(file: string): Promise<void>;
  onFileDeleted(file: string): Promise<void>;
  onFileRenamed(oldPath: string, newPath: string): Promise<void>;
  
  // Batch update files
  updateFiles(changes: {
    added: string[];
    modified: string[];
    deleted: string[];
  }): Promise<void>;
  
  // Check for workspace changes
  scanForChanges(): Promise<{
    needsUpdate: string[];
    needsRemoval: string[];
  }>;
}
```

---

## 🎨 UI Extension API

### Custom UI Components

```typescript
interface UIExtension {
  // Register custom result renderer
  registerResultRenderer(
    type: string,
    renderer: (result: SearchResult) => string
  ): void;
  
  // Register custom action
  registerAction(
    name: string,
    action: (result: SearchResult) => Promise<void>
  ): void;
  
  // Add custom status bar item
  addStatusBarItem(
    id: string,
    text: string,
    command?: string
  ): vscode.StatusBarItem;
  
  // Create custom webview panel
  createResultsPanel(
    title: string,
    results: SearchResult[],
    options?: {
      theme?: 'light' | 'dark';
      showScores?: boolean;
    }
  ): Promise<vscode.WebviewPanel>;
}
```

### Event Listeners

```typescript
interface EventAPI {
  // Search events
  onSearchStarted(listener: (query: string) => void): vscode.Disposable;
  onSearchCompleted(listener: (results: SearchResult[]) => void): vscode.Disposable;
  onSearchError(listener: (error: Error) => void): vscode.Disposable;
  
  // Indexing events
  onIndexingStarted(listener: () => void): vscode.Disposable;
  onIndexingProgress(listener: (progress: number) => void): vscode.Disposable;
  onIndexingCompleted(listener: (result: IndexingResult) => void): vscode.Disposable;
  
  // System events
  onStatusChanged(listener: (status: SystemStatus) => void): vscode.Disposable;
  onConfigChanged(listener: (config: LightRAGConfig) => void): vscode.Disposable;
}
```

---

## 🔌 Extension Points

### Plugin Interface

```typescript
interface LightRAGPlugin {
  name: string;
  version: string;
  
  // Plugin lifecycle
  activate(context: LightRAGContext): Promise<void>;
  deactivate(): Promise<void>;
  
  // Optional hooks
  beforeSearch?(query: string, context: SearchContext): Promise<void>;
  afterSearch?(results: SearchResult[]): Promise<SearchResult[]>;
  beforeIndex?(files: string[]): Promise<string[]>;
  afterIndex?(result: IndexingResult): Promise<void>;
}

interface LightRAGContext {
  searchAPI: SearchAPI;
  indexingAPI: IndexingAPI;
  configAPI: ConfigAPI;
  uiAPI: UIExtension;
  eventAPI: EventAPI;
}

// Register plugin
await vscode.commands.executeCommand('cappy.lightrag.registerPlugin', plugin);
```

### Custom Embeddings

```typescript
interface EmbeddingProvider {
  name: string;
  dimensions: number;
  
  // Generate embeddings
  embed(texts: string[]): Promise<number[][]>;
  
  // Embedding configuration
  getConfig(): {
    maxTokens: number;
    batchSize: number;
    model: string;
  };
}

// Register custom embedding provider
await vscode.commands.executeCommand('cappy.lightrag.registerEmbeddingProvider', provider);
```

---

## 🧪 Testing API

### Test Utilities

```typescript
interface TestingAPI {
  // Create test instance
  createTestInstance(config?: Partial<LightRAGConfig>): Promise<LightRAGSystem>;
  
  // Mock data generators
  generateMockChunks(count: number): Promise<SearchResult[]>;
  generateMockWorkspace(structure: WorkspaceStructure): Promise<string>;
  
  // Performance testing
  benchmarkSearch(queries: string[], iterations: number): Promise<BenchmarkResult>;
  benchmarkIndexing(files: string[], iterations: number): Promise<BenchmarkResult>;
  
  // Validation helpers
  validateSearchResults(results: SearchResult[]): ValidationResult;
  validateConfiguration(config: LightRAGConfig): ValidationResult;
}

interface BenchmarkResult {
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number;
  errorRate: number;
}
```

---

## 📝 Type Definitions

### Complete Type Reference

```typescript
// Export all types for external use
export {
  LightRAGConfig,
  SearchResult,
  SearchContext,
  SystemStatus,
  PerformanceMetrics,
  IndexingResult,
  LightRAGPlugin,
  EmbeddingProvider,
  SearchAPI,
  IndexingAPI,
  UIExtension,
  EventAPI,
  TestingAPI
};

// Version information
export const LIGHTRAG_API_VERSION = '1.0.0';
export const SUPPORTED_EXTENSIONS = ['ts', 'js', 'md', 'json', 'txt'];
export const DEFAULT_CONFIG: LightRAGConfig;
```

---

## 🚀 Quick Start Examples

### Basic Integration

```typescript
// Simple search integration
async function searchCodebase(query: string) {
  const results = await vscode.commands.executeCommand(
    'cappy.lightrag.search',
    query
  );
  
  console.log(`Found ${results.length} results for: ${query}`);
  results.forEach(result => {
    console.log(`${result.chunk.path}:${result.chunk.startLine} (${result.score})`);
  });
}

// Status monitoring
async function monitorStatus() {
  const status = await vscode.commands.executeCommand('cappy.lightrag.getStatus');
  console.log(`LightRAG Health: ${status.health}`);
  console.log(`Cache Hit Rate: ${status.performance.cacheHitRate * 100}%`);
}
```

### Advanced Plugin

```typescript
// Example plugin that adds code complexity scoring
class ComplexityPlugin implements LightRAGPlugin {
  name = 'complexity-scorer';
  version = '1.0.0';
  
  async activate(context: LightRAGContext) {
    context.eventAPI.onSearchCompleted(this.scoreComplexity);
  }
  
  async deactivate() {
    // Cleanup
  }
  
  private scoreComplexity = (results: SearchResult[]) => {
    return results.map(result => ({
      ...result,
      complexityScore: this.calculateComplexity(result.chunk.text)
    }));
  };
  
  private calculateComplexity(code: string): number {
    // Simplified complexity calculation
    const lines = code.split('\n').length;
    const branches = (code.match(/if|else|while|for|switch/g) || []).length;
    return (lines + branches * 2) / 10;
  }
}
```

---

## 📞 Support

For API support and questions:
- Check the complete examples in `/docs/mini-lightrag-examples.md`
- Review the troubleshooting guide in `/docs/mini-lightrag-guide.md`
- Monitor system status via the VS Code status bar

---

**API Version: 1.0.0 | Last Updated: October 2025**