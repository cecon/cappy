# Cappy 🦫

**Simple AI Chat Assistant for VS Code**

A straightforward chat assistant that helps you code, manage todos, and search your codebase. No complexity, no magic—just a helpful AI companion.

[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)

---

## Why Cappy?

- ✅ **Simple**: Just chat. No setup, no configuration hell.
- ✅ **Smart**: Uses Claude Sonnet 4.5, GPT-4o, or GPT-4 automatically.
- ✅ **Integrated**: Built-in todo list management.
- ✅ **Fast**: Instant activation, zero background processing.
- ✅ **Lightweight**: ~2 MB, minimal memory footprint.

---

## Features

### 💬 Chat with @cappy

Ask questions, get help, discuss code:

```
@cappy explain how authentication works in this codebase
@cappy help me fix this bug in src/auth.ts
@cappy refactor this function to be more readable
```

### ✅ Todo Management

Keep track of tasks without leaving VS Code:

```
@cappy create a todo to implement JWT refresh token
@cappy show my todos
@cappy complete todo abc123
```

### 🔍 Code Search

Search and read files intelligently:

```
@cappy search for "database" in TypeScript files
@cappy read src/main.ts and explain what it does
```

---

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for "Cappy"
4. Click Install

### From VSIX

```bash
# Download latest release
# Then install:
code --install-extension cappy-*.vsix --force
```

### From Source

```bash
git clone https://github.com/cecon/cappy
cd cappy
npm install
npm run build
npm run package
code --install-extension cappy-*.vsix --force
```

---

## Usage

### Quick Start

1. Open any workspace in VS Code
2. Open chat panel (Cmd+I / Ctrl+I)
3. Type `@cappy` followed by your question
4. That's it! 🎉

### Examples

**General Chat:**
```
@cappy what does this file do?
@cappy how can I improve this code?
@cappy explain TypeScript generics
```

**Todo Management:**
```
@cappy create todo: Review PR #123
@cappy list all my todos
@cappy mark todo xyz as complete
```

**Code Search:**
```
@cappy find all uses of "fetchUser"
@cappy show me the authentication logic
@cappy read the config file
```

---

## Configuration

Configure your preferred LLM model:

```json
// settings.json
{
  "cappy.llm.preferredModel": "auto" // or "claude-sonnet", "gpt-4o", "gpt-4"
}
```

**Options:**
- `auto` - Automatically selects best available model (recommended)
- `claude-sonnet` - Claude Sonnet 4.5 (if available)
- `gpt-4o` - GPT-4 Omni
- `gpt-4` - GPT-4

---

## Tools Available

Cappy has access to these tools:

1. **grep_search** - Search text across files
2. **read_file** - Read file contents
3. **create_task_file** - Create XML task files
4. **create_todo** - Create new todo items
5. **list_todos** - List all todos
6. **complete_todo** - Mark todos as complete

Cappy uses these automatically when needed—you don't need to invoke them manually.

---

## Architecture

Simple and clean:

```
Cappy
├── Chat (@cappy)
│   └── Uses best LLM automatically
├── Tools (6 total)
│   ├── grep_search
│   ├── read_file
│   ├── create_task_file
│   └── Todo System (3 tools)
└── Todo Repository (in-memory)
```

See [SIMPLIFIED_ARCHITECTURE.md](SIMPLIFIED_ARCHITECTURE.md) for details.

---

## Performance

- **Activation**: < 1 second ⚡
- **Memory**: 50-100 MB 📉
- **Storage**: < 1 MB
- **Background CPU**: Zero 🔋

---

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- VS Code 1.105.0+

### Setup

```bash
# Install dependencies
npm install

# Build webview
npm run build

# Compile extension
npm run compile-extension

# Run tests
npm test

# Package
npm run package
```

### Project Structure

```
cappy/
├── src/
│   ├── extension.ts                    # Entry point
│   ├── domains/todo/                   # Todo domain
│   ├── nivel1/adapters/vscode/         # VS Code adapters
│   └── nivel2/infrastructure/          # Tools & services
├── docs/                               # Documentation
├── test/                               # Tests
└── package.json                        # Extension manifest
```

---

## Migration from v3.1.2

If you're upgrading from the previous RAG-based version, see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md).

**TL;DR:** We removed all the complexity (RAG, vector stores, graph databases) and kept only what works: simple chat + todos.

---

## FAQ

### Why was it simplified?

The previous version had a complex RAG system (vector stores, graph databases, hybrid retriever) that added more complexity than value. The new version is faster, more reliable, and easier to maintain.

### Are todos persistent?

Currently, todos are stored in memory and cleared on reload. Persistence can be added in a future version if needed.

### Can I use my own LLM?

Cappy uses VS Code's Language Model API, which supports GitHub Copilot models. To use other models, you'd need to modify the source code.

### Does it work in Cursor?

Yes! Cappy is compatible with Cursor (VS Code fork). Just install as you would any VS Code extension.

### Is it free?

The extension is free and open-source. However, you need access to LLM models (Claude, GPT) through GitHub Copilot or similar services.

---

## Roadmap

- [ ] Persistent todo storage (JSON/SQLite)
- [ ] Todo categories and filters
- [ ] Export/import todos
- [ ] Better LLM configuration options
- [ ] Custom tool registration API
- [ ] Workspace-specific settings

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork the repo
# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes
# Commit
git commit -m 'Add amazing feature'

# Push
git push origin feature/amazing-feature

# Open a PR
```

---

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Platform**: VS Code Extension API
- **LLM**: VS Code Language Model API
- **UI**: VS Code Chat Participant API
- **Build**: Vite, TSC

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Credits

Created by [Eduardo Cecon](https://github.com/cecon)

Inspired by the need for simple, effective AI tooling without unnecessary complexity.

---

## Support

- 🐛 [Report a bug](https://github.com/cecon/cappy/issues)
- 💡 [Request a feature](https://github.com/cecon/cappy/issues)
- 📖 [Read the docs](https://github.com/cecon/cappy/tree/main/docs)
- 💬 [Ask a question](https://github.com/cecon/cappy/discussions)

---

**Remember:** Simplicity is the ultimate sophistication. 🦫
