# Mini-LightRAG for VS Code - Complete Guide

## 🌟 Overview

Mini-LightRAG is a lightweight, high-performance semantic search system integrated into VS Code through the Cappy extension. It provides intelligent code discovery, contextual search, and knowledge graph capabilities for your workspace.

## 🚀 Quick Start

### Installation & Setup

1. **Initialize LightRAG in your workspace:**
   ```
   Ctrl+Shift+P → "Initialize LightRAG"
   ```

2. **Index your workspace:**
   ```
   Ctrl+Shift+P → "Index Workspace with LightRAG"
   ```

3. **Start searching:**
   ```
   Ctrl+Shift+F → Enter your search query
   ```

### First Search

Try searching for common programming concepts:
- "authentication logic"
- "error handling patterns"
- "database connection"
- "validation functions"

## 🔍 Search Features

### Semantic Understanding

Unlike traditional text search, Mini-LightRAG understands **meaning**:

```typescript
// Traditional search: exact text match
"getUserById" → finds only exact function names

// LightRAG semantic search:
"find user by identifier" → finds:
  - getUserById()
  - findUserByEmail()
  - lookupUserRecord()
  - retrieveUserData()
```

### Context-Aware Results

Search results consider:
- **Vector Similarity**: Semantic meaning of your query
- **Graph Relationships**: Code connections and dependencies
- **Freshness**: Recently modified files get priority
- **Cursor Context**: Your current location in the codebase

### Smart Query Types

#### 1. Concept Queries
```
"user authentication"
"error handling"
"data validation"
"async operations"
```

#### 2. Implementation Queries
```
"how to validate email"
"implement retry logic"
"handle file uploads"
"create API endpoints"
```

#### 3. Pattern Queries
```
"singleton pattern"
"factory method"
"observer pattern"
"dependency injection"
```

## 🎮 User Interface

### Command Palette Integration

Access all LightRAG features via `Ctrl+Shift+P`:

| Command | Description | Shortcut |
|---------|-------------|----------|
| Initialize LightRAG | Setup the system | - |
| Search with LightRAG | Semantic search | `Ctrl+Shift+F` |
| Search Selection | Search selected text | `Ctrl+Shift+S` |
| Index Workspace | Build/rebuild index | - |
| Show LightRAG Status | View system status | - |
| Quick Search | Fast search dialog | `Ctrl+Alt+F` |

### Status Bar Integration

The LightRAG status bar shows:
- 🟢 `$(database) LightRAG (150)` → Ready with 150 chunks indexed
- 🔄 `$(sync~spin) LightRAG 45%` → Indexing in progress
- ❌ `$(error) LightRAG Error` → System error

Click the status bar for detailed information.

### Context Menu

Right-click on selected text:
- **Search Selected with LightRAG** → Search the selected text
- **Search from Here** → Search with current context

### Results Panel

Rich webview panel with:
- **File Navigation** → Click to open files at specific lines
- **Score Breakdown** → See why results were ranked
- **Related Actions** → Find similar, copy path, show in explorer
- **Interactive Preview** → Code snippets with syntax highlighting

## 📊 Advanced Features

### Performance Optimization

Mini-LightRAG includes intelligent optimizations:

#### Smart Caching
- **Search Results**: 5-minute cache for repeated queries
- **Embeddings**: 1-hour cache for processed text
- **System Stats**: 30-second cache for status updates

#### Memory Management
- **Automatic cleanup** when memory usage exceeds 80%
- **Optimized data structures** using Float32Array for vectors
- **Streaming processing** for large files

#### Batch Processing
- **Automatic batching** of embedding operations
- **Configurable batch sizes** for optimal performance
- **Concurrent processing** with controlled parallelism

### Configuration

Customize LightRAG via VS Code settings:

```json
{
  "cappy.lightrag": {
    "vectorDimension": 384,
    "indexType": "HNSW",
    "indexing": {
      "batchSize": 100,
      "maxConcurrency": 4,
      "autoIndexOnSave": true,
      "autoIndexInterval": 300000,
      "skipPatterns": [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/out/**"
      ],
      "includePatterns": [
        "**/*.ts",
        "**/*.js",
        "**/*.md",
        "**/*.txt",
        "**/*.json"
      ]
    },
    "search": {
      "maxResults": 20,
      "expandHops": 2,
      "vectorWeight": 0.6,
      "graphWeight": 0.3,
      "freshnessWeight": 0.1,
      "cacheTimeMinutes": 10
    }
  }
}
```

## 🏗️ Architecture Overview

### System Components

```
Mini-LightRAG Architecture
├── 📊 QueryOrchestrator     → Central coordination
├── 🗄️ LanceDB Store        → Vector storage
├── 🧠 Embedding Service    → MiniLM-L6-v2 embeddings
├── 📄 Chunking Service     → Semantic text chunking
├── 🕸️ LightGraph Service   → Relationship graph
├──  Hybrid Search        → Multi-modal search
├── 🎨 UI Manager           → Rich interface
└── ⚡ Performance Manager  → Optimization
```

### Data Flow

```
1. Text Chunking → Semantic chunks with overlap
2. Embedding Generation → 384D vectors via MiniLM
3. Graph Relationship Detection → Similarity edges
4. Vector Storage → LanceDB with HNSW index
5. Search Query → Hybrid vector + graph search
7. Result Ranking → Vector + Graph + Freshness scores
8. UI Display → Rich webview with actions
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. No Search Results
**Problem**: Search returns no results
**Solutions**:
- Ensure workspace is indexed: `Ctrl+Shift+P` → "Index Workspace"
- Check file patterns in settings
- Try broader search terms
- Verify LightRAG is initialized

#### 2. Slow Performance
**Problem**: Search takes too long
**Solutions**:
- Check memory usage in status bar
- Clear cache: Restart VS Code
- Reduce batch size in settings
- Enable auto-optimization

#### 3. High Memory Usage
**Problem**: Extension uses too much memory
**Solutions**:
- Automatic cleanup will trigger at 80% usage
- Manually restart extension
- Reduce included file patterns
- Check for large files in index

#### 4. Indexing Errors
**Problem**: Files not being indexed
**Solutions**:
- Check file permissions
- Verify file patterns in settings
- Look for binary files in included patterns
- Check VS Code output panel for errors

### Performance Tuning

#### For Large Workspaces (>10k files)
```json
{
  "cappy.lightrag.indexing": {
    "batchSize": 200,
    "maxConcurrency": 2,
    "chunkSize": { "min": 300, "max": 800 }
  }
}
```

#### For Fast Machines
```json
{
  "cappy.lightrag.indexing": {
    "batchSize": 50,
    "maxConcurrency": 8,
    "autoIndexInterval": 180000
  }
}
```

#### For Memory-Constrained Environments
```json
{
  "cappy.lightrag.search": {
    "maxResults": 10,
    "cacheTimeMinutes": 5
  }
}
```

## 📚 API Reference

### Key Interfaces

```typescript
interface SearchContext {
  workspacePath: string;
  activeDocument?: vscode.TextDocument;
  cursorContext?: {
    line: number;
    character: number;
    surroundingText: string;
  };
}

interface SearchResult {
  chunk: {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    text: string;
  };
  score: number;
  explanation: {
    vectorScore: number;
    graphScore: number;
    freshnessScore: number;
    whyRelevant: string;
  };
}
```

### Commands

All LightRAG commands are available programmatically:

```typescript
// Initialize system
await vscode.commands.executeCommand('cappy.lightrag.initialize');

// Search
await vscode.commands.executeCommand('cappy.lightrag.search', 'query text');

// Index workspace
await vscode.commands.executeCommand('cappy.lightrag.indexWorkspace');

// Show status
await vscode.commands.executeCommand('cappy.lightrag.status');
```

## 🎯 Best Practices

### Search Query Optimization

#### Good Queries
✅ `"user authentication middleware"`
✅ `"error handling with try catch"`
✅ `"async function with promise"`
✅ `"database connection pooling"`

#### Avoid
❌ Single letters: `"a"`, `"x"`
❌ Very common words: `"the"`, `"and"`
❌ Variable names only: `"userId"`

### Workspace Organization

#### Recommended Structure
```
project/
├── src/           → Main source code
├── docs/          → Documentation
├── tests/         → Test files
├── configs/       → Configuration files
└── examples/      → Usage examples
```

#### File Naming
- Use descriptive names: `userAuthService.ts` vs `auth.ts`
- Include context in comments
- Maintain consistent patterns

## 🔧 Development & Extension

### Creating Custom Queries

For advanced users, you can extend LightRAG functionality:

```typescript
// Custom search with specific context
const context: SearchContext = {
  workspacePath: workspace.rootPath,
  cursorContext: {
    line: currentLine,
    character: currentChar,
    surroundingText: contextText
  }
};

const results = await lightragSearch(query, context);
```

### Integration with Other Extensions

LightRAG works well with:
- **GitHub Copilot**: Complementary AI assistance
- **GitLens**: Git history and blame integration
- **Error Lens**: Error highlighting and context
- **Bracket Pair Colorizer**: Code structure visualization

## 📈 Performance Metrics

### Typical Performance
- **Search Latency**: < 50ms (cached), < 200ms (fresh)
- **Memory Usage**: 200-500MB for typical workspaces
- **Indexing Speed**: 100-200 files/second
- **Cache Hit Rate**: 80-90% for repeated queries

### Scalability
- **Small Projects** (<1k files): Instant search
- **Medium Projects** (1k-10k files): < 100ms search
- **Large Projects** (10k+ files): < 500ms search

## 🛡️ Privacy & Security

### Data Handling
- **Local Processing**: All data stays on your machine
- **No External Calls**: Embeddings generated locally
- **Workspace Isolation**: Each workspace has isolated index
- **Temporary Storage**: Cache automatically expires

### File Access
- Only reads files included in patterns
- Respects `.gitignore` and VS Code file exclusions
- No modification of source files
- Optional telemetry (can be disabled)

## 🔄 Updates & Maintenance

### Keeping LightRAG Updated
1. **Extension Updates**: Automatic via VS Code
2. **Index Refresh**: Automatic on file changes
3. **Cache Management**: Automatic cleanup
4. **Performance Tuning**: Self-optimizing system

### Manual Maintenance
- **Reindex**: When changing file patterns
- **Clear Cache**: If experiencing issues
- **Reset System**: Reinitialize if needed

---

## 📞 Support & Community

### Getting Help
1. **VS Code Output Panel**: Check "Cappy" channel for logs
2. **Command Palette**: Use "Show LightRAG Status" for diagnostics
3. **Performance Report**: Generated automatically

### Contributing
Mini-LightRAG is part of the Cappy extension ecosystem. Contributions welcome!

---

**Happy Searching! 🔍✨**