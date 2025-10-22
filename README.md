# 🦫 Cappy

**AI Coding Companion with Single-Focus Workflow, CappyRAG Hybrid Search, and Automatic Learning from Mistakes**

Cappy is an intelligent VS Code extension that prevents errors, boosts productivity, and orchestrates context for every development task. Compatible with both VS Code and Cursor, Cappy combines advanced AI capabilities with a knowledge graph to understand your codebase deeply.

[![Version](https://img.shields.io/badge/version-3.0.4-blue.svg)](https://github.com/cecon/cappy)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0+-green.svg)](https://code.visualstudio.com/)
[![Cursor](https://img.shields.io/badge/Cursor-Compatible-purple.svg)](https://cursor.sh/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

## ✨ Key Features

### 🧠 **CappyRAG Hybrid Search**
- **Vector Search**: Semantic understanding of your code using embeddings
- **Graph Database**: Structural relationships between files, functions, and concepts
- **Hybrid Queries**: Combines semantic similarity with structural knowledge
- **LanceDB + Kuzu**: High-performance vector and graph storage

### 🎯 **Single-Focus Workflow**
- **Context Orchestration**: Automatically gathers relevant context for each task
- **Smart Filtering**: Focuses on what matters for your current work
- **Distraction Prevention**: Eliminates information overload
- **Task-Aware Intelligence**: Adapts to your development workflow

### 📊 **Interactive Knowledge Graph**
- **Visual Code Exploration**: See relationships between files and functions
- **Dependency Mapping**: Understand how your code connects
- **Architecture Insights**: Discover patterns and potential improvements
- **Real-time Updates**: Graph evolves as your code changes

### 🔍 **Intelligent Workspace Scanner**
- **Automatic Code Analysis**: Parses TypeScript, JavaScript, Markdown, and more
- **Incremental Updates**: Only processes changed files
- **Smart Filtering**: Respects `.gitignore` and `.cappyignore` patterns
- **Batch Processing**: Efficient handling of large codebases

### 🛠️ **Language Model Tools**
- **File Creation**: AI can create files directly in your workspace
- **Web Fetching**: Access external resources and documentation
- **Context-Aware Suggestions**: Recommendations based on your codebase
- **Error Prevention**: Learn from mistakes to avoid future issues

## 📸 Screenshots

### Interactive Knowledge Graph
![Graph Visualization](docs/images/graph-visualization.png)
*Explore your codebase structure with an interactive knowledge graph*

### AI Chat Interface
![Chat Interface](docs/images/chat-interface.png)
*Ask questions about your code and get intelligent responses*

### Workspace Scanner
![Workspace Scanner](docs/images/workspace-scanner.png)
*Automatic analysis and indexing of your entire codebase*

## 🚀 Quick Start

### Installation

1. **From VS Code Marketplace** (Coming Soon)
   ```
   ext install eduardocecon.cappy
   ```

2. **From Source**
   ```bash
   git clone https://github.com/cecon/cappy.git
   cd cappy
   npm install
   npm run compile-extension
   npm run package
   code --install-extension cappy-*.vsix
   ```

### First Steps

1. **Open your project** in VS Code
2. **Scan your workspace**: `Ctrl+Shift+P` → "Cappy: Scan Workspace"
3. **Open the graph**: `Ctrl+Alt+G` or "Cappy: Open Graph"
4. **Start chatting**: Use the Cappy sidebar to ask questions about your code

## 📖 Usage

### Workspace Scanning

The workspace scanner is the foundation of Cappy's intelligence:

```
Ctrl+Shift+P → "Cappy: Scan Workspace"
```

This will:
- 🔍 Discover all files in your project
- 📝 Parse code structure and documentation
- 🧠 Generate embeddings for semantic search
- 📊 Build a knowledge graph of relationships
- 💾 Store everything in local databases

### Graph Visualization

Explore your codebase visually:

```
Ctrl+Alt+G → Opens interactive graph
```

Features:
- **Node Types**: Files, functions, classes, interfaces
- **Relationships**: Dependencies, imports, documentation
- **Filtering**: By file type, confidence, date
- **Expansion**: Explore neighborhoods of related code
- **Metrics**: PageRank, centrality, clustering coefficients

### AI Chat Interface

Ask questions about your code:

```
"Where is the authentication logic implemented?"
"Show me all functions that handle user input"
"What files are related to the payment system?"
"Explain how the graph module works"
```

### Configuration

Create a `.cappyignore` file to exclude files from scanning:

```gitignore
# Temporary files
*.tmp
*.cache

# Large media files
*.mp4
*.avi

# Legacy code
legacy/
deprecated/
```

## 🏗️ Architecture

Cappy is built with Clean Architecture principles:

```
src/
├── domains/           # Business logic and entities
│   ├── chat/         # Chat and conversation management
│   ├── graph/        # Knowledge graph operations
│   └── workspace/    # Workspace analysis
├── adapters/         # External interfaces
│   ├── primary/      # VS Code integration
│   └── secondary/    # Databases, APIs, tools
├── services/         # Application services
└── types/           # TypeScript definitions
```

### Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Vector Database**: LanceDB for embeddings and semantic search
- **Graph Database**: Kuzu (WASM) for relationship mapping
- **AI Integration**: LangChain + LangGraph for agent orchestration
- **UI Components**: Radix UI + Tailwind CSS + Lucide Icons
- **Code Analysis**: TypeScript Compiler API + AST parsing
- **Embeddings**: Xenova Transformers (local) + OpenAI (optional)
- **Testing**: Vitest + Testing Library + Coverage reporting
- **Build Tools**: Vite + ESLint + PostCSS + Autoprefixer

### Key Components

#### CappyRAG System
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Code Files    │───▶│  AST Parser     │───▶│   Chunks        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Knowledge      │◀───│   LanceDB       │◀───│  Embeddings     │
│     Graph       │    │  (Vectors)      │    │   Generator     │
│   (Kuzu)        │    └─────────────────┘    └─────────────────┘
└─────────────────┘
```

#### Workspace Scanner Pipeline
1. **Discovery**: Find all files, apply ignore patterns
2. **Change Detection**: Compare file hashes, identify modifications
3. **Parsing**: Extract AST, JSDoc, markdown content
4. **Chunking**: Split content into semantic units
5. **Embedding**: Generate vector representations
6. **Indexing**: Store in LanceDB with metadata
7. **Graph Building**: Create nodes and relationships in Kuzu

## 🔧 Development

### Prerequisites

- Node.js 18+
- VS Code 1.105.0+
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/cecon/cappy.git
cd cappy

# Install dependencies
npm install

# Build the extension
npm run compile-extension

# Run tests
npm test

# Package for distribution
npm run package
```

### Development Commands

```bash
npm run dev              # Start Vite dev server
npm run build           # Build for production
npm run lint            # Run ESLint
npm run test            # Run tests
npm run test:ui         # Run tests with UI
npm run test:coverage   # Generate coverage report
```

### VS Code Extension Development

```bash
# Compile extension
npm run compile-extension

# Watch for changes
npm run watch

# Package extension
npm run package

# Publish to marketplace
npm run publish
```

## ⚡ Performance & Compatibility

### System Requirements
- **VS Code**: 1.105.0 or higher
- **Node.js**: 18.0 or higher (for development)
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: ~100MB for extension + database storage

### Performance Characteristics
- **Small Projects** (< 100 files): ~10-30 seconds scan time
- **Medium Projects** (100-500 files): ~30 seconds - 2 minutes
- **Large Projects** (> 500 files): ~2-10 minutes
- **Memory Usage**: ~200-500MB during scanning
- **Database Size**: ~1-5MB per 100 files (varies by content)

### Supported File Types
- **Code**: `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.java`, `.cpp`, `.c`, `.cs`
- **Documentation**: `.md`, `.mdx`, `.txt`, `.rst`
- **Configuration**: `.json`, `.yaml`, `.yml`, `.toml`, `.ini`
- **Web**: `.html`, `.css`, `.scss`, `.less`
- **Data**: `.csv`, `.xml` (basic support)

### Editor Compatibility
- ✅ **VS Code**: Full support with all features
- ✅ **Cursor**: Compatible with language model tools
- 🚧 **VS Code Web**: Limited support (no file system access)
- ❌ **Other Editors**: Not supported

## 📚 Documentation

- [Workspace Scanner Guide](docs/WORKSPACE_SCANNER_QUICKSTART.md)
- [Graph Module Documentation](docs/GRAPH_MODULE_README.md)
- [Architecture Overview](docs/architecture/)
- [Development Setup](docs/VALIDATION_GUIDE.md)
- [Testing Guide](docs/TEST_SUMMARY.md)

## ❓ FAQ

### General Questions

**Q: Is Cappy free to use?**
A: Yes, Cappy is open source and free to use under the MIT license.

**Q: Does Cappy send my code to external servers?**
A: By default, Cappy processes everything locally. Only if you configure external AI providers (like OpenAI) will data be sent externally, and only for embedding generation.

**Q: How much storage does Cappy use?**
A: Typically 1-5MB per 100 files, stored locally in your workspace's `.cappy` folder.

**Q: Can I use Cappy offline?**
A: Yes, with local embedding models. Some features may require internet for external AI providers.

### Technical Questions

**Q: Why is the first scan slow?**
A: The initial scan processes all files and generates embeddings. Subsequent scans are incremental and much faster.

**Q: Can I exclude certain files from scanning?**
A: Yes, create a `.cappyignore` file in your project root with patterns to exclude.

**Q: Does Cappy work with large codebases?**
A: Yes, Cappy is designed to handle large projects efficiently with batch processing and incremental updates.

**Q: What happens if I close VS Code during a scan?**
A: Progress is saved incrementally. The next scan will continue from where it left off.

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute
- 🐛 **Report Bugs**: Found an issue? [Open an issue](https://github.com/cecon/cappy/issues)
- 💡 **Suggest Features**: Have an idea? [Start a discussion](https://github.com/cecon/cappy/discussions)
- 📝 **Improve Documentation**: Help make our docs better
- 🧪 **Add Tests**: Increase test coverage
- 🔧 **Fix Issues**: Pick up an issue and submit a PR

### Development Process
1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
4. **Make** your changes
5. **Add** tests for new functionality
6. **Run** tests (`npm test`)
7. **Commit** your changes (`git commit -m 'Add amazing feature'`)
8. **Push** to your branch (`git push origin feature/amazing-feature`)
9. **Open** a Pull Request

### Code Style
- Follow existing TypeScript/React patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Ensure all tests pass
- Follow Clean Architecture principles

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [LangChain](https://langchain.com/) and [LangGraph](https://langchain-ai.github.io/langgraph/)
- Vector storage powered by [LanceDB](https://lancedb.com/)
- Graph database using [Kuzu](https://kuzudb.com/)
- UI components from [Radix UI](https://radix-ui.com/)

## 📞 Support

- 🐛 [Report Issues](https://github.com/cecon/cappy/issues)
- 💬 [Discussions](https://github.com/cecon/cappy/discussions)
- 📧 [Contact](mailto:eduardo@cecon.dev)

---

**Made with ❤️ by [Eduardo Cecon](https://github.com/cecon)**
