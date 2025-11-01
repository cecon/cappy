# Cappy 🧠

**Context Engine for AI Agents**

Stop fighting with AI tools that don't understand your codebase. Cappy builds a living knowledge graph of your project so AI agents actually know where things are and how they connect.

[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)

---

## The Problem

You're building with AI tools but:
- 🔄 Constantly copy-pasting code into ChatGPT for context
- 🤷 AI suggests changes in the wrong files
- 😤 Copilot doesn't understand how your modules relate
- ⏰ Spend more time explaining your codebase than coding

**Why?** LLMs are great at code patterns but terrible at understanding YOUR specific project structure.

---

## The Solution

Cappy creates two intelligent databases of your codebase:

1. **🕸️ Knowledge Graph** - Maps entities and relationships  
   *(UserService → UserRepository → Database)*

2. **🔍 Vector Database** - Semantic search across code and docs  
   *(Find "where we validate emails" instantly)*

When you ask "add CPF validation like we do for email", Cappy knows:
- ✅ Where email validation lives
- ✅ Which files import it  
- ✅ The pattern you use
- ✅ Where to put the new validation

---

## Real-World Impact

Used internally to power autonomous development agents:

| Without Cappy | With Cappy |
|--------------|-----------|
| 30% success rate | **70% success rate** |
| Generic suggestions | Context-aware solutions |
| Wrong file locations | Knows exact structure |
| Wastes expensive tokens | Efficient, targeted context |

---

## How It Works
```
1. 📂 Scans your workspace
   ↓
2. 🧩 Extracts entities (classes, functions, modules)
   ↓
3. 🔗 Maps relationships (imports, calls, dependencies)
   ↓
4. 💾 Builds Graph DB + Vector DB
   ↓
5. 🤖 AI tools access rich context via MCP
```

---

## Features

### 🗺️ **Interactive Knowledge Graph**
- Visualize your codebase structure
- See how components relate
- Click to navigate code

### 🔍 **Semantic Code Search**
- Natural language queries
- Find by intent, not just keywords
- Search across code + docs

### 🤖 **AI Agent Integration**
- MCP (Model Context Protocol) tools
- Enriched context for LLMs
- Automatic todo list generation

### 📚 **Smart Documentation**
- Auto-chunks markdown with overlap
- Extracts entities from docs
- Links docs to code

### ⚡ **Real-Time Updates**
- Watches file changes
- Incremental graph updates
- Always in sync

---

## Installation

### 1. Install Extension
```bash
# From VSCode Marketplace
code --install-extension eduardocecon.cappy
```

Or search "Cappy" in VSCode Extensions

### 2. Configure API Key
```json
// settings.json
{
  "cappy.openaiApiKey": "sk-..."
}
```

### 3. Initialize Workspace

1. Open your project in VSCode
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type **"Cappy: Initialize Workspace"**
4. Cappy creates `.cappy/` folder and adds `.cappy/data/` to `.gitignore`
5. Choose to start file processing or run **"Cappy: Scan Workspace"** later

> 💡 **Note:** Cappy only activates in workspaces where you explicitly initialize it. This prevents automatic folder creation in all your projects.

---

## Usage

### Chat with Your Codebase
```
You: "Where do we validate user emails?"
Cappy: Found in src/validators/email.ts, used by UserService and AuthController

You: "Add CPF validation following the same pattern"
Cappy: [generates todo list with exact file locations and relationships]
```

### View Knowledge Graph

`Cmd+Shift+P` → "Cappy: Show Graph"

Navigate your codebase visually - see imports, dependencies, call chains.

### Semantic Search

`Cmd+Shift+P` → "Cappy: Search Codebase"

Find code by what it DOES, not what it's named.

---

## Use Cases

### 🚀 **Onboarding**
New dev? Ask Cappy "how does authentication work?" - get instant architecture overview with code links.

### 🤖 **Autonomous Agents**  
Running agents like OpenHands? Give them Cappy's context - watch success rates jump from 30% to 70%.

### 🔍 **Code Review**
"What files will this change affect?" - Cappy shows the dependency graph.

### 📖 **Documentation**
Cappy keeps docs linked to code. Change a function? See which docs reference it.

### 🧪 **Refactoring**
"Where is this function called?" - instant answer with full context.

---

## Configuration
```json
{
  // Required
  "cappy.openaiApiKey": "sk-...",
  
  // Optional
  "cappy.model": "gpt-4o-mini",
  "cappy.chunkSize": 1000,
  "cappy.chunkOverlap": 200,
  "cappy.excludePatterns": ["node_modules", "dist", ".git"],
  "cappy.graphDepth": 3
}
```

---

## Architecture
```
┌─────────────────────────────────────────┐
│           VSCode Extension              │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐      ┌──────────────┐   │
│  │ File     │─────▶│ Entity       │   │
│  │ Watcher  │      │ Extractor    │   │
│  └──────────┘      └──────────────┘   │
│                           │            │
│                           ▼            │
│         ┌─────────────────────────┐   │
│         │   Graph DB (Local)      │   │
│         │   - Entities            │   │
│         │   - Relationships       │   │
│         └─────────────────────────┘   │
│                           │            │
│                           ▼            │
│         ┌─────────────────────────┐   │
│         │  Vector DB (Local)      │   │
│         │   - Code embeddings     │   │
│         │   - Doc embeddings      │   │
│         └─────────────────────────┘   │
│                           │            │
│                           ▼            │
│         ┌─────────────────────────┐   │
│         │   MCP Server            │   │
│         │   - Expose tools        │   │
│         │   - Serve context       │   │
│         └─────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
                    │
                    ▼
         ┌────────────────────┐
         │  AI Agent / Chat   │
         └────────────────────┘
```

**Key Design Decisions:**

- **Local-first**: All data stays on your machine
- **Incremental updates**: Only processes changed files
- **Multi-DB**: Graph for structure, Vector for semantics
- **MCP Standard**: Works with any MCP-compatible AI tool

---

## Roadmap

### ✅ Done
- [x] Graph DB with entity extraction
- [x] Vector DB with semantic search
- [x] MCP server integration
- [x] File watcher with incremental updates
- [x] Chat interface with context

### 🚧 In Progress
- [ ] Interactive graph visualization
- [ ] Multi-language support (currently optimized for JS/TS)
- [ ] Team sync (share graph across team)

### 🔮 Planned
- [ ] Cloud-hosted graphs (optional)
- [ ] Custom entity extractors
- [ ] Integration with Jira/Linear
- [ ] Analytics dashboard
- [ ] Pre-built patterns library

---

## FAQ

**Q: Does my code leave my machine?**  
A: Only for LLM API calls (OpenAI). The databases are 100% local. You can use local LLMs if preferred.

**Q: How big can my project be?**  
A: Tested on projects up to 500k LOC. Scan time scales linearly (~1 min per 50k LOC).

**Q: Which languages are supported?**  
A: Currently optimized for JavaScript/TypeScript. Python, Go, Java support coming soon.

**Q: Can I use this with Cursor/Copilot?**  
A: Yes! Cappy exposes MCP tools that any AI assistant can use.

**Q: Is it free?**  
A: Extension is free. You pay only for your OpenAI API usage (~$0.01-0.10 per scan depending on project size).

**Q: Can I run this on CI/CD?**  
A: Not yet, but planned. Would enable "graph as documentation" in your repo.

---

## Enterprise / Agent Service

Using Cappy to power autonomous dev agents?  

We offer a **hosted agent service** that uses Cappy's context engine to:
- Pick up tasks from Jira/Linear
- Develop, test, and open PRs
- 70%+ success rate on CRUD/integration tasks

**Interested?** Email: [seu-email@domain.com] or [link to landing page]

---

## Contributing

Contributions welcome! This is a passion project that solves a real problem.

### Areas needing help:
- Language parsers (Python, Java, Go, Rust)
- Graph visualization improvements
- Documentation
- Test coverage

See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Tech Stack

- **Extension**: TypeScript + VSCode API
- **Graph DB**: [your choice - Neo4j? Custom?]
- **Vector DB**: [your choice - ChromaDB? LanceDB?]
- **LLM**: OpenAI GPT-4o-mini (configurable)
- **MCP**: Model Context Protocol for tool exposure

---

## License

MIT - see [LICENSE](LICENSE)

---

## Credits

Built by [@cecon](https://github.com/cecon) to stop copying code into ChatGPT 1000 times a day.

If Cappy saves you time, consider:
- ⭐ Starring the repo
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🔀 Contributing code

---

**Stop explaining your codebase. Let Cappy do it.**

[Install Now](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy) | [Documentation](link) | [Discord](link) | [Twitter](link)