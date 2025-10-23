# 📚 CAPPY Documentation Index

Welcome to the CAPPY Framework documentation! This guide will help you navigate through all available documentation.

---

## 🚀 Getting Started

Start here if you're new to CAPPY:

1. [Main README](../README.md) - Project overview and quick start
2. [Copilot Integration](guides/COPILOT_INTEGRATION.md) - Setup GitHub Copilot integration
3. [OpenAI Setup](guides/OPENAI_SETUP.md) - Alternative LLM configuration

---

## 📁 Documentation Structure

### 🎯 Features
Core functionality documentation:

- **[Hybrid Retriever](features/HYBRID_RETRIEVER.md)** - Hybrid search system
- **[Hybrid Retriever Quickstart](features/HYBRID_RETRIEVER_QUICKSTART.md)** - Quick setup guide
- **[Context Retrieval Tool](features/CONTEXT_RETRIEVAL_TOOL.md)** - Language Model Tools integration
- **[Workspace Scanner](features/WORKSPACE_SCANNER.md)** - File indexing and monitoring
- **[Workspace Scanner Quickstart](features/WORKSPACE_SCANNER_QUICKSTART.md)** - Quick setup
- **[Workspace Scanner Summary](features/WORKSPACE_SCANNER_SUMMARY.md)** - Feature overview
- **[Workspace Scanner TODO](features/WORKSPACE_SCANNER_TODO.md)** - Upcoming features
- **[File Change Management](features/FILE_CHANGE_MANAGEMENT.md)** - Real-time file tracking
- **[External Package Tracking](features/EXTERNAL_PACKAGE_TRACKING.md)** - Dependency resolution
- **[Documents Realtime Feedback](features/DOCUMENTS_REALTIME_FEEDBACK.md)** - Live document updates

### 📊 Graph Database
Knowledge graph and database documentation:

- **[Graph Database Architecture](graph/GRAPH_DATABASE_ARCHITECTURE.md)** - Hybrid design philosophy
- **[Graph Module README](graph/GRAPH_MODULE_README.md)** - Module documentation
- **[Graph Depth Analysis](graph/GRAPH_DEPTH_ANALYSIS.md)** - Query optimization
- **[Graph Diagnostic Summary](graph/GRAPH_DIAGNOSTIC_SUMMARY.md)** - Troubleshooting
- **[Graph Load Subgraph Fix](graph/GRAPH_LOAD_SUBGRAPH_FIX.md)** - Performance improvements
- **[Duplicate Nodes Detection](graph/DUPLICATE_NODES_DETECTION.md)** - Data integrity
- **[Metadata Storage Decision](graph/METADATA_STORAGE_DECISION.md)** - Design decisions
- **[Hybrid Schema V2 Implementation](graph/HYBRID_SCHEMA_V2_IMPLEMENTATION.md)** - Schema design

### 🔧 Parsers
Document and code parsing:

- **[PDF Parser Implementation](parsers/PDF_PARSER_IMPLEMENTATION.md)** - PDF support
- **[PDF Implementation Summary](parsers/PDF_IMPLEMENTATION_SUMMARY.md)** - Feature summary
- **[Word Support](parsers/WORD_SUPPORT.md)** - Word document parsing
- **[Word Implementation Summary](parsers/WORD_IMPLEMENTATION_SUMMARY.md)** - Implementation details
- **[PHP Support](parsers/PHP_SUPPORT.md)** - PHP language support
- **[Code Signature Extraction](parsers/CODE_SIGNATURE_EXTRACTION.md)** - Function signatures
- **[Entity Extraction](parsers/ENTITY_EXTRACTION.md)** - LLM-based entity discovery

### 🛠️ Tools
Language Model Tools and integrations:

- **[Language Model Tools](tools/LANGUAGE_MODEL_TOOLS.md)** - VS Code LM API integration
- **[Native Tool Confirmation](tools/NATIVE_TOOL_CONFIRMATION.md)** - Built-in confirmation system
- **[Tool Confirmation UI](tools/TOOL_CONFIRMATION_UI.md)** - UI implementation
- **[Tool Confirmation Options](tools/TOOL_CONFIRMATION_OPTIONS.md)** - Configuration options

### 🧪 Testing
Testing and validation guides:

- **[Testing Guide](testing/TESTING_GUIDE.md)** - Comprehensive testing documentation
- **[Validation Guide](testing/VALIDATION_GUIDE.md)** - Data validation procedures

### 🏗️ Architecture
Architectural documentation:

- **[Hexagonal Graph Design](architecture/hexagonal-graph-design.md)** - Clean architecture
- **[Chat Documentation](architecture/chat/)** - Chat system architecture
- **[Adapters](architecture/adapters/)** - Adapter pattern implementation

---

## 🔍 Quick Reference by Topic

### Setting Up CAPPY
1. [Main README - Installation](../README.md#-installation)
2. [Main README - Quick Start](../README.md#-quick-start)
3. [Copilot Integration](guides/COPILOT_INTEGRATION.md)

### Understanding the Core
1. [Graph Database Architecture](graph/GRAPH_DATABASE_ARCHITECTURE.md)
2. [Hybrid Retriever](features/HYBRID_RETRIEVER.md)
3. [Workspace Scanner](features/WORKSPACE_SCANNER.md)

### Adding Support for New File Types
1. [Code Signature Extraction](parsers/CODE_SIGNATURE_EXTRACTION.md)
2. [Entity Extraction](parsers/ENTITY_EXTRACTION.md)
3. Review existing parsers: [PDF](parsers/PDF_PARSER_IMPLEMENTATION.md), [Word](parsers/WORD_SUPPORT.md), [PHP](parsers/PHP_SUPPORT.md)

### Working with Language Models
1. [Language Model Tools](tools/LANGUAGE_MODEL_TOOLS.md)
2. [Context Retrieval Tool](features/CONTEXT_RETRIEVAL_TOOL.md)
3. [Copilot Integration](guides/COPILOT_INTEGRATION.md)

### Troubleshooting
1. [Testing Guide](testing/TESTING_GUIDE.md)
2. [Validation Guide](testing/VALIDATION_GUIDE.md)
3. [Graph Diagnostic Summary](graph/GRAPH_DIAGNOSTIC_SUMMARY.md)

---

## 📝 Contributing to Documentation

When adding new documentation:

1. **Place it in the right folder**:
   - `features/` - New features and capabilities
   - `graph/` - Graph database related
   - `parsers/` - File parsing and language support
   - `tools/` - Language Model Tools
   - `testing/` - Testing and validation
   - `guides/` - Setup and configuration guides
   - `architecture/` - Architectural decisions

2. **Update this index** with a link to your new document

3. **Follow the naming convention**:
   - Use UPPER_CASE_WITH_UNDERSCORES.md for technical docs
   - Use kebab-case.md for architectural docs
   - Be descriptive and specific

4. **Include in the document**:
   - Clear title and purpose
   - Table of contents for long docs
   - Code examples where applicable
   - Links to related documentation

---

## 🔗 External Resources

- [VS Code API Documentation](https://code.visualstudio.com/api)
- [GitHub Copilot API](https://docs.github.com/en/copilot)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Transformers.js](https://huggingface.co/docs/transformers.js)

---

## 📮 Need Help?

- [GitHub Issues](https://github.com/cecon/cappy/issues)
- [GitHub Discussions](https://github.com/cecon/cappy/discussions)

---

Last updated: October 22, 2025
