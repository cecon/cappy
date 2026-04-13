<p align="center">
  <img src="extension/media/icon.png" alt="Cappy" width="120" />
</p>

<h1 align="center">Cappy</h1>

<p align="center">
  <b>The open-source AI agent that turns your IDE into an autonomous development environment.</b><br/>
  <i>Multi-agent swarms · Semantic code search · Persistent memory · Human-in-the-loop safety</i>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy">
    <img src="https://img.shields.io/visual-studio-marketplace/v/eduardocecon.cappy?style=for-the-badge&label=Marketplace&color=007ACC" alt="VS Code Marketplace" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy">
    <img src="https://img.shields.io/visual-studio-marketplace/d/eduardocecon.cappy?style=for-the-badge&label=Downloads&color=4CC61E" alt="Downloads" />
  </a>
  <a href="https://github.com/cecon/cappy/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/cecon/cappy?style=for-the-badge&color=yellow" alt="License" />
  </a>
  <a href="https://github.com/cecon/cappy/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/cecon/cappy/cappy-publish.yml?style=for-the-badge&label=CI&color=success" alt="CI" />
  </a>
</p>

---

## Why Cappy?

Most AI coding tools give you a chatbot. Cappy gives you an **autonomous agent team** that reads your code, understands your architecture, runs commands, and ships features — while you stay in control.

- **Not a copilot.** A full agent loop with 25+ built-in tools.
- **Not a black box.** Every destructive action requires your approval.
- **Not locked-in.** Pick any model on OpenRouter. Extend with MCP servers.

---

## Features

### Multi-Agent Swarms

Go beyond single-agent workflows. Cappy's **Coordinator Mode** decomposes complex tasks into independent sub-tasks and delegates them to parallel worker agents — all coordinated automatically.

| Agent | Role |
|-------|------|
| **Coder** | Writes, edits, and refactors code with full tool access |
| **Planner** | Designs architecture and breaks tasks into actionable steps |
| **Reviewer** | Analyzes code quality, security, and performance |
| **Coordinator** | Orchestrates multi-agent swarms for large-scale tasks |
| **Explorer** | Read-only subagent for codebase and web research |

Agents communicate through a **mailbox-based swarm protocol** with broadcast and point-to-point messaging, enabling real-time collaboration on complex engineering tasks.

### Semantic Code Search (RAG)

Cappy indexes your codebase with **AI embeddings** so you can search by meaning, not just text.

- **Git-aware incremental indexing** — only re-indexes changed files
- **AST-powered dependency extraction** — understands imports, inheritance, and module graphs (TS/JS/Python)
- **Natural language queries** — ask "where is user authentication handled?" and get ranked results
- **Configurable embedding model** — uses `text-embedding-3-small` by default, fully customizable

### 25+ Built-in Tools

Everything you need without leaving the chat:

| Category | Tools |
|----------|-------|
| **File ops** | Read, Write, Edit, Glob, ListDir |
| **Code search** | Grep (ripgrep), Semantic search, RAG search |
| **Web** | WebSearch (DuckDuckGo), WebFetch |
| **Execution** | Bash / PowerShell terminal |
| **Planning** | EnterPlanMode, ExitPlanMode, TodoWrite |
| **Memory** | MemoryList, MemoryRead, MemoryWrite, MemoryDelete |
| **Skills** | ListSkills, ReadSkill, CreateSkill |
| **Multi-agent** | Agent, TeamCreate, SendMessage, ExploreAgent |

### Persistent Project Memory

Cappy remembers what matters across sessions. The memory system stores structured knowledge in `.cappy/memory/`:

- **project-overview** — stack, objective, high-level description
- **architecture** — architectural decisions and patterns
- **conventions** — code style and naming conventions
- **pitfalls** — known issues and gotchas
- **active-workstreams** — current tasks and next steps

Memory is automatically injected into the agent's context, so Cappy gets smarter the more you use it.

### Workspace Skills

Teach Cappy project-specific workflows by creating markdown skill files in `.cappy/skills/`. Skills are automatically discovered and offered to the agent as domain knowledge — perfect for onboarding, deployment playbooks, or custom code generation patterns.

### Human-in-the-Loop Safety

Every destructive operation (file writes, shell commands, MCP tools) requires your explicit approval. Configure per-session or globally:

- **`confirm_each`** (default) — pause before every destructive tool
- **`allow_all`** — trust mode for experienced users

Plan Mode adds an extra guard: the agent can design and reason freely, but all file modifications and shell commands are blocked until you explicitly exit planning.

### Smart Context Management

Cappy's context budget system handles long conversations gracefully:

- **128K token context window** with automatic trimming
- **LLM-based compression** — when messages are dropped, they're summarized and re-injected
- **Intelligent boundary detection** — never breaks mid-conversation or orphans tool results
- **Tool argument recovery** — if the LLM outputs malformed JSON, Cappy auto-repairs it with a fast deterministic call

### MCP Protocol Support

Extend Cappy with any [Model Context Protocol](https://modelcontextprotocol.io/) server:

- Connect multiple servers simultaneously
- SSE and Stdio transport support
- Automatic destructive-tool detection via keyword heuristics
- Sandboxed by chat mode — MCP tools are only available in Agent mode

### Three Chat Modes

| Mode | Description | Tools |
|------|-------------|-------|
| **Agent** | Full autonomous execution | All 25+ native + MCP tools |
| **Ask** | Read-only research | Read, Grep, Glob, Web, Memory, Skills |
| **Plain** | Simple conversation | No tools |

### OpenClaude CLI Integration

Launch the OpenClaude CLI directly from VS Code with workspace-aware configuration. Manage profiles, open documentation, and switch between Cappy's visual interface and the CLI seamlessly.

---

## Requirements

- **VS Code** 1.105.0 or higher
- **Node.js** 20.0.0 or higher
- **pnpm** 10+ (`npm install -g pnpm`)
- **ripgrep** installed and available in `PATH`
- **OpenRouter API key** — get one at [openrouter.ai](https://openrouter.ai/)

---

## Installation

### Via VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for **Cappy**
4. Click **Install**

### Via VSIX (Manual)

1. Download the latest [VSIX release](https://github.com/cecon/cappy/releases/latest)
2. In VS Code: **Extensions → ⋯ → Install from VSIX...**
3. Select the downloaded file

---

## Quick Start

### 1. Get an OpenRouter API Key

1. Create an account at [OpenRouter](https://openrouter.ai/)
2. Generate an API key in your account settings
3. Keep your key private — never commit it to source control

### 2. Configure Cappy

Open the Cappy sidebar and go to the **Config** tab, or edit `.cappy/config.json` directly:

```json
{
  "openrouterApiKey": "or-xxxxxxxxxxxxxxxx",
  "model": "openai/gpt-oss-120b",
  "agent": "coder",
  "rag": {
    "enabled": true,
    "embeddingModel": "text-embedding-3-small"
  },
  "mcpServers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  ]
}
```

**Configuration reference:**

| Key | Description | Default |
|-----|-------------|---------|
| `openrouterApiKey` | Your OpenRouter API key | — |
| `model` | LLM model to use | `openai/gpt-oss-120b` |
| `visionModel` | Vision model for image inputs | `meta-llama/llama-3.2-11b-vision-instruct:free` |
| `contextWindow` | Max context tokens | `128000` |
| `reservedOutputTokens` | Tokens reserved for output | `8192` |
| `agent` | Default agent: `coder`, `planner`, or `reviewer` | `coder` |
| `maxIterations` | Max agent loop iterations | `20` |
| `mcpServers` | External MCP tool servers | `[]` |
| `rag.enabled` | Enable semantic code search | `true` |
| `rag.embeddingModel` | Embedding model | `text-embedding-3-small` |
| `debug` | Verbose logging | `false` |

### 3. Start Building

Open the **Cappy** panel from the Activity Bar, choose your mode, and start chatting.

**Example workflows:**

*Feature implementation with agent swarm*
```
You: "Implement JWT authentication with refresh tokens. 
      Use a coordinator to split the work."
Cappy: [spawns workers for token service, middleware, and tests — 
        runs them in parallel, merges results]
```

*Semantic code search*
```
You: "Find all the places where we handle payment errors"
Cappy: [uses RAG embeddings to locate semantically relevant code, 
        not just exact text matches]
```

*Architecture planning*
```
You: "Plan the migration from REST to GraphQL for the user module"
Cappy: [enters Plan Mode, analyzes dependencies, generates a step-by-step 
        migration plan with file targets and acceptance criteria]
```

*Code review*
```
You: "Review the auth module for security issues"
Cappy: [reads files, analyzes patterns, returns structured feedback 
        with severity ratings]
```

---

## Local Development

### Setup

```bash
git clone https://github.com/cecon/cappy.git
cd cappy
pnpm install
```

### Run in development mode

```bash
pnpm dev          # Start webview (Vite) dev server
```

### Test inside VS Code

1. Open the project folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Cappy will be available in the sidebar of the new window

### Other scripts

```bash
pnpm build        # Build all packages
pnpm typecheck    # Run TypeScript checks across all packages
pnpm package      # Create a .vsix package for distribution
```

---

## Architecture

Cappy is a **pnpm monorepo** with a clean separation of concerns:

```text
cappy/
├── extension/    # VS Code extension host
│   ├── agent/    #   Agent loop, swarm coordination, context management
│   ├── tools/    #   25+ built-in tools
│   ├── mcp/      #   Model Context Protocol client
│   ├── rag/      #   Semantic search & embedding pipeline
│   ├── memory/   #   Persistent project knowledge store
│   └── bridge/   #   Webview communication & event routing
├── webview/      # React + Mantine + Vite chat UI
├── cli-mock/     # Local mock server for browser/dev mode
└── .cappy/       # User config, memory, skills, vector store (not committed)
```

**Runtime flow:**

```text
Webview (React UI)
      ↕  postMessage / onDidReceiveMessage
Extension Host (agent loop)
      ↕  OpenRouter API
   LLM Model
      ↕  MCP client / built-in tools
File system, terminal, external MCP servers
```

The agent loop in `extension/src/agent/loop.ts` orchestrates the conversation: it receives user prompts from the webview, decides which tools to call, applies HITL gating, and streams responses back.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- Follow TypeScript best practices
- Use CSS Modules for webview styling
- Write [Conventional Commits](https://www.conventionalcommits.org/)
- Run `pnpm typecheck` before opening a PR

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

**Happy coding with Cappy! 🚀**
