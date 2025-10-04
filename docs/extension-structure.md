# Cappy Extension Structure

## Overview
Cappy 2.9.10+ combines Context Orchestration with Mini-LightRAG hybrid search for intelligent development assistance.

## Directory Structure

```
src/
├── extension.ts              # Main extension entry point
├── commands/                 # VS Code command implementations
│   ├── initCappy.ts         # Project initialization + Mini-LightRAG setup
│   ├── createTaskFile.ts    # Smart task creation with context discovery
│   ├── workOnCurrentTask.ts # Context-aware task execution
│   ├── completeTask.ts      # Learning capture and task finalization
│   ├── knowStack.ts         # Project architecture analysis
│   ├── reindexCommand.ts    # Semantic indexing for context discovery
│   ├── addPreventionRule.ts # Prevention rule management
│   ├── removePreventionRule.ts
│   ├── changeTaskStatus.ts  # Task lifecycle management
│   ├── getActiveTask.ts     # Current task status
│   ├── getNewTaskInstruction.ts # Task creation guidance
│   ├── getVersion.ts        # Extension version info
│   └── telemetryConsent.ts  # Privacy and telemetry
├── models/                   # Data models and types
│   └── cappyConfig.ts       # Configuration schema
├── utils/                    # Utility functions
│   ├── fileManager.ts       # File operations and XSD management
│   ├── outputWriter.ts      # .cappy/output.txt management
│   └── environmentDetector.ts # VS Code vs Cursor detection
├── test/                     # Test suites
│   ├── runTest.ts           # Test runner
│   └── suite/               # Individual test files
└── mini-lightrag/           # Hybrid search engine (NEW in 2.9.10)
    ├── core/                # Schemas, chunking, hashing, ranking
    ├── indexer/             # Incremental document processing
    ├── store/               # LanceDB persistence layer
    ├── graph/               # Graph expansion & subgraph generation
    ├── query/               # Hybrid search orchestration
    ├── tools/               # MCP/LM Tools for LLMs
    └── webview/graph-ui/    # React visualization interface
```

## Mini-LightRAG Architecture (2.9.10+)

### Core Modules
- **core/**: Fundamental data structures and algorithms
- **indexer/**: Document processing with incremental updates
- **store/**: LanceDB vector storage + embeddings
- **graph/**: Relationship mapping and graph traversal
- **query/**: Hybrid search orchestration (vector + graph)
- **tools/**: LLM integration tools (MCP/LM Tools API)
- **webview/**: Interactive graph visualization

### Data Flow
1. **Indexer** → Processes documents → **Store** (LanceDB)
2. **Graph** → Builds relationships → **Store** (nodes/edges)
3. **Query** → Orchestrates search → Vector + Graph results
4. **Tools** → Exposes functionality → LLMs (Copilot/Cursor)
5. **Webview** → Visualizes results → Interactive navigation

## Configuration Files

```
.cappy/
├── config.yaml              # Main configuration
├── stack.md                 # Project knowledge base
├── output.txt               # Command results
├── tasks/                   # Active tasks (XSD-compliant)
├── history/                 # Completed tasks
├── schemas/                 # XSD validation schemas
└── prevention-rules.xml     # Prevention rules database

globalStorage/mini-lightrag/ # Vector & graph data (auto-created)
├── chunks/                  # Embedded content chunks
├── nodes/                   # Graph nodes (docs, symbols)
├── edges/                   # Relationships & connections
├── indexes/                 # HNSW vector indices
├── models/                  # Embedding model cache
├── temp/                    # Temporary processing files
├── config.json             # Mini-LightRAG configuration
└── README.md               # Storage documentation
```

## Runtime Resources

```
resources/
├── templates/              # Template files
│   ├── cappy-config.yaml  # Initial configuration
│   ├── cappy-copilot-instructions.md # Copilot integration
│   ├── task-template.xml  # Task structure template
│   └── prevention-rules.xml # Prevention rules template
└── instructions/           # Methodology documentation
    ├── cappy-methodology.md # Core methodology
    ├── cappy-patterns.md   # Development patterns
    └── script-*.md         # Command-specific scripts
```

## Key Features by Module

### Context Orchestration
- **Semantic task categorization**
- **Automatic context discovery**
- **Prevention rule application**
- **Related task identification**

### Mini-LightRAG
- **Hybrid vector + graph search**
- **Incremental content indexing**
- **Visual graph navigation**
- **LLM tool integration**

### Task Management
- **XSD-compliant task structure**
- **Atomic task execution**
- **Learning capture system**
- **Progress tracking**

### Developer Experience
- **Natural language commands**
- **VS Code + Cursor compatibility**
- **Automatic schema management**
- **Error prevention system**

## Extension Lifecycle

1. **Activation** → Environment detection + auto-updates
2. **Initialization** → Project setup + Mini-LightRAG structure
3. **Context Discovery** → Project analysis + knowledge mapping
4. **Task Creation** → Smart context injection
5. **Execution** → Context-aware development
6. **Learning** → Outcome capture + rule evolution

## Integration Points

### VS Code API
- Command registration and execution
- Webview providers for graph UI
- File system and workspace management
- Extension context and globalStorage

### LLM Integration
- GitHub Copilot Chat integration
- Cursor AI compatibility
- MCP server for tool exposure
- LM Tools API registration

### External Dependencies
- **LanceDB**: Vector database (native binaries)
- **transformers.js**: Local embeddings
- **BLAKE3**: Content hashing
- **React**: UI components
- **Cytoscape.js**: Graph visualization

## Development Guidelines

### Adding New Commands
1. Create command file in `src/commands/`
2. Register in `package.json` contributions
3. Add handler in `extension.ts`
4. Include error handling and output writing

### Extending Mini-LightRAG
1. Follow module boundaries (`core/`, `store/`, etc.)
2. Update corresponding README.md
3. Maintain backward compatibility
4. Add comprehensive documentation

### Testing
1. Add test file in `src/test/suite/`
2. Include integration and unit tests
3. Test VS Code and Cursor compatibility
4. Validate XSD compliance
