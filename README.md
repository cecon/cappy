<div align="center"># React + TypeScript + Vite



# 🦫 CAPPY FrameworkThis template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.



**Context-Aware AI Assistant for VS Code & Cursor**Currently, two official plugins are available:



[![Version](https://img.shields.io/badge/version-3.0.5-blue.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh

[![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0+-green.svg)](https://code.visualstudio.com/)- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

[![Cursor](https://img.shields.io/badge/Cursor-Compatible-orange.svg)](https://cursor.sh/)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)## React Compiler



*Task orchestration, hybrid search, and intelligent context management for AI-assisted development*The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).



[**Install**](#-installation) • [**Quick Start**](#-quick-start) • [**Features**](#-core-features) • [**Documentation**](#-documentation) • [**Contribute**](#-contributing)## Expanding the ESLint configuration



</div>If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:



---```js

export default defineConfig([

## 🎯 What is CAPPY?  globalIgnores(['dist']),

  {

CAPPY is a VS Code extension that provides **intelligent context orchestration** for AI-assisted development. It combines task management, hybrid retrieval (RAG), and semantic understanding to help you work more efficiently with AI coding assistants like GitHub Copilot.    files: ['**/*.{ts,tsx}'],

    extends: [

### The Problem      // Other configs...



AI assistants are powerful but often lack context about:      // Remove tseslint.configs.recommended and replace with this

- Your project's architecture and patterns      tseslint.configs.recommendedTypeChecked,

- Mistakes you've already made and learned from      // Alternatively, use this for stricter rules

- Files and dependencies across your workspace      tseslint.configs.strictTypeChecked,

- Best practices specific to your stack      // Optionally, add this for stylistic rules

      tseslint.configs.stylisticTypeChecked,

### The Solution

      // Other configs...

CAPPY provides:    ],

- 🎯 **Single-Focus Workflow**: Work on one atomic task at a time with full context    languageOptions: {

- 🧠 **Hybrid Retriever**: Hybrid search combining semantic vectors + knowledge graph      parserOptions: {

- 📚 **Workspace Intelligence**: Deep understanding of your codebase structure        project: ['./tsconfig.node.json', './tsconfig.app.json'],

- 🛡️ **Prevention Rules**: Learn from mistakes and avoid repeating them        tsconfigRootDir: import.meta.dirname,

- 🔄 **Context Orchestration**: Right context at the right time      },

      // other options...

---    },

  },

## ✨ Core Features])

```

### 🎯 Task Management

- **Atomic tasks** with XML structure and validationYou can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

- **Context injection** for each task step

- **Prevention rules** applied automatically```js

- **Learning capture** from completed tasks// eslint.config.js

import reactX from 'eslint-plugin-react-x'

### 🧠 Hybrid Retriever - Hybrid Retrievalimport reactDom from 'eslint-plugin-react-dom'

- **Semantic search** using vector embeddings

- **Graph traversal** for relationship discoveryexport default defineConfig([

- **Multi-source fusion** (code + docs + rules + tasks)  globalIgnores(['dist']),

- **Intelligent ranking** with configurable weights  {

    files: ['**/*.{ts,tsx}'],

### 📊 Knowledge Graph    extends: [

- **SQLite-based** graph database with `sqlite-vec` extension      // Other configs...

- **Automatic indexing** of workspace files      // Enable lint rules for React

- **Entity extraction** using LLM      reactX.configs['recommended-typescript'],

- **Relationship mapping** (imports, calls, references)      // Enable lint rules for React DOM

      reactDom.configs.recommended,

### 📁 Workspace Scanner    ],

- **Real-time monitoring** of file changes    languageOptions: {

- **AST parsing** for multiple languages (TS, JS, Python, PHP, etc.)      parserOptions: {

- **Document support** (PDF, Word, Markdown)        project: ['./tsconfig.node.json', './tsconfig.app.json'],

- **Smart chunking** with overlap for better retrieval        tsconfigRootDir: import.meta.dirname,

      },

### 🛠️ Language Model Tools      // other options...

- **Native VS Code integration** via `vscode.lm` API    },

- **GitHub Copilot** integration (no API keys needed)  },

- **Tool confirmation UI** for safe execution])

- **Context retrieval** directly from chat```


---

## 🚀 Installation

### VS Code
```bash
code --install-extension eduardocecon.cappy
```

Or search for "**Cappy**" in the VS Code Extensions marketplace.

### Cursor
Fully compatible! Install from Extensions marketplace or load the `.vsix` file.

---

## 🏁 Quick Start

### 1. Initialize CAPPY in your project
```
Ctrl+Shift+P → "CAPPY: Initialize Project"
```

This creates the `.cappy/` directory with:
- `config.yaml` - Project configuration
- `stack.md` - Technology stack documentation
- `schemas/` - XML validation schemas
- `tasks/` - Active tasks
- `history/` - Completed tasks

### 2. Analyze your stack
```
Ctrl+Shift+P → "CAPPY: Know Stack"
```

CAPPY analyzes your workspace and generates a technology profile.

### 3. Create your first task
```
Ctrl+Shift+P → "CAPPY: New Task"
```

Follow the interactive prompts to create an atomic task.

### 4. Work on the task
```
Ctrl+Shift+P → "CAPPY: Work on Current Task"
```

CAPPY provides context-aware assistance for each step.

### 5. Complete the task
```
Ctrl+Shift+P → "CAPPY: Complete Task"
```

Captures learnings and updates prevention rules automatically.

---

## 📚 Documentation

Documentation is organized in the `docs/` folder:

### 📖 Guides
- [Copilot Integration](docs/guides/COPILOT_INTEGRATION.md) - GitHub Copilot setup
- [OpenAI Setup](docs/guides/OPENAI_SETUP.md) - Alternative LLM setup

### 🎯 Features
- [Hybrid Retriever](docs/features/HYBRID_RETRIEVER.md) - Hybrid search documentation
- [Workspace Scanner](docs/features/WORKSPACE_SCANNER.md) - File indexing system
- [Context Retrieval](docs/features/CONTEXT_RETRIEVAL_TOOL.md) - Language Model Tools

### 🔧 Parsers
- [PDF Support](docs/parsers/PDF_PARSER_IMPLEMENTATION.md)
- [Word Support](docs/parsers/WORD_SUPPORT.md)
- [PHP Support](docs/parsers/PHP_SUPPORT.md)

### 📊 Graph Database
- [Architecture](docs/graph/GRAPH_DATABASE_ARCHITECTURE.md) - Hybrid graph design
- [Module README](docs/graph/GRAPH_MODULE_README.md) - Graph module documentation

### 🛠️ Tools & Testing
- [Language Model Tools](docs/tools/LANGUAGE_MODEL_TOOLS.md)
- [Testing Guide](docs/testing/TESTING_GUIDE.md)

### 🏗️ Architecture
See [docs/architecture/](docs/architecture/) for detailed architectural documentation.

---

## 🏗️ Architecture

CAPPY uses a **hexagonal architecture** with clear separation of concerns:

```
src/
├── domains/          # Domain logic (tasks, chat, graph)
├── adapters/         # External integrations
│   ├── primary/      # UI adapters (webviews, commands)
│   └── secondary/    # Infrastructure (DB, parsers, LLM)
├── services/         # Application services
├── commands/         # VS Code commands
└── utils/           # Shared utilities
```

### Technology Stack
- **TypeScript** - Core language
- **SQLite** with `sqlite-vec` - Vector + graph storage
- **Transformers.js** - Local embeddings
- **VS Code API** - Extension platform
- **GitHub Copilot API** - LLM integration

---

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm or pnpm
- VS Code 1.105.0+

### Build from Source
```bash
# Clone repository
git clone https://github.com/cecon/cappy.git
cd cappy

# Install dependencies
npm install

# Build extension
npm run compile

# Package VSIX
npx @vscode/vsce package

# Install locally
code --install-extension cappy-3.0.5.vsix --force
```

### Run Tests
```bash
npm test
```

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Add tests for new features
- Update documentation
- Keep commits atomic and descriptive

---

## 📋 Commands Reference

| Command | Description |
|---------|-------------|
| `cappy.init` | Initialize CAPPY in project |
| `cappy.knowstack` | Analyze technology stack |
| `cappy.reindex` | Rebuild semantic indexes |
| `cappy.new` | Create new task |
| `cappy.workOnCurrentTask` | Work on active task |
| `cappy.completeTask` | Complete active task |
| `cappy.version` | Show extension version |

> ⚠️ **Important**: All commands must be executed via VS Code Command Palette or API (`vscode.commands.executeCommand`). Never run directly in terminal.

---

## 🌟 Key Differentiators

### vs. Traditional RAG
- **Hybrid search**: Combines vectors + graph + keywords
- **Multi-source**: Code, docs, rules, tasks
- **Workspace-aware**: Understands project structure

### vs. Task Managers
- **AI-first design**: Built for LLM consumption
- **Context orchestration**: Right information at right time
- **Learning system**: Captures and applies learnings

### vs. Code Indexers
- **Semantic understanding**: Not just syntax
- **Entity extraction**: LLM-powered insights
- **Dynamic updates**: Real-time file monitoring

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- GitHub Copilot team for the Language Model API
- VS Code team for the excellent extension platform
- LightRAG project for hybrid retrieval inspiration
- Open source community for valuable feedback

---

## 🔗 Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
- [GitHub Repository](https://github.com/cecon/cappy)
- [Issue Tracker](https://github.com/cecon/cappy/issues)
- [Changelog](CHANGELOG.md)

---

<div align="center">

**Built with ❤️ by developers, for developers**

*Compatible with VS Code and Cursor* 🦫🚀

</div>
