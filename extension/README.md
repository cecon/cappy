<p align="center">
  <img src="media/icon.png" alt="Cappy" width="120" />
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
</p>

---

## The Problem

You're deep in a coding session. New work arrives from multiple channels. You context-switch between issue tracker, terminal, docs, and the editor. **Flow is lost.**

What if an agent team inside your IDE could plan, execute, and validate tasks — with full project context and your approval?

## The Solution: Meet Cappy

**Cappy** is not just another coding assistant. It's a **full autonomous agent runtime** living inside VS Code — with multi-agent swarms, semantic code search, persistent project memory, and human-in-the-loop safety built in from day one.

Pick any model on OpenRouter. Extend with MCP servers. Stay in control.

---

## Key Features

### Multi-Agent Swarms
*One agent is good. A coordinated team is unstoppable.*

Cappy's **Coordinator Mode** decomposes complex tasks into independent sub-tasks and delegates them to parallel worker agents — automatically.

| Agent | Role |
|-------|------|
| **Coder** | Writes, edits, and refactors code with full tool access |
| **Planner** | Designs architecture and breaks tasks into actionable steps |
| **Reviewer** | Analyzes code quality, security, and performance |
| **Coordinator** | Orchestrates multi-agent swarms for large-scale tasks |
| **Explorer** | Read-only subagent for codebase and web research |

Agents communicate through a **mailbox-based swarm protocol** with broadcast and point-to-point messaging.

### Semantic Code Search (RAG)
*Search by meaning, not just text.*

Cappy indexes your codebase with AI embeddings and understands your architecture:

- **Git-aware incremental indexing** — only re-indexes changed files
- **AST-powered dependency graphs** — understands imports, inheritance, and module structure
- **Natural language queries** — "where is user authentication handled?"
- **Configurable embedding model** — `text-embedding-3-small` by default

### 25+ Built-in Tools
*Everything you need without leaving the chat.*

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
*Cappy gets smarter the more you use it.*

The memory system stores structured knowledge in `.cappy/memory/` — project overview, architecture decisions, conventions, known pitfalls, and active workstreams. Memory is automatically injected into every session.

### Workspace Skills
*Teach Cappy your team's playbooks.*

Create markdown skill files in `.cappy/skills/` to share project-specific workflows. Skills are automatically discovered and offered to the agent as domain knowledge — perfect for onboarding, deployment runbooks, or custom code generation patterns.

### Human-in-the-Loop Safety
*Full autonomy when you want it. Full control when you need it.*

Every destructive operation requires your explicit approval:
- **`confirm_each`** (default) — pause before every file write, shell command, or MCP call
- **`allow_all`** — trust mode for experienced users

**Plan Mode** adds an extra guard: the agent reasons freely, but all mutations are blocked until you exit planning.

### Smart Context Management
*Long conversations, handled gracefully.*

- **128K token context window** with automatic trimming
- **LLM-based compression** — dropped messages are summarized and re-injected
- **Tool argument recovery** — malformed JSON is auto-repaired

### Three Chat Modes

| Mode | Description | Tools |
|------|-------------|-------|
| **Agent** | Full autonomous execution | All 25+ native + MCP tools |
| **Ask** | Read-only research | Read, Grep, Glob, Web, Memory, Skills |
| **Plain** | Simple conversation | No tools |

### MCP Protocol Support
*Extend Cappy with any tool server.*

Connect multiple [Model Context Protocol](https://modelcontextprotocol.io/) servers simultaneously. SSE and Stdio transports supported. Automatic destructive-tool detection. Sandboxed by chat mode.

### OpenClaude CLI Integration

Launch the OpenClaude CLI directly from VS Code with workspace-aware configuration. Switch seamlessly between Cappy's visual dashboard and the terminal CLI.

### Live Dashboard
*Everything at a glance.*

A sleek sidebar dashboard built with React + Mantine:
- **Streaming responses** with live progress and elapsed time
- **HITL confirmation cards** with approve/reject in one click
- **Session history** with search, pin, and archive
- **Tool-call timeline** showing every action taken
- **Inline file diffs** for every code change
- **Config & MCP panels** for quick settings access

---

## Getting Started

### Install

Search for **"Cappy"** in the VS Code Marketplace, or:

```bash
code --install-extension eduardocecon.cappy
```

### Configure

1. Open the Cappy sidebar (Activity Bar icon)
2. Go to the **Config** tab
3. Enter your [OpenRouter](https://openrouter.ai/) API key
4. Choose a model and start chatting

### Example Workflows

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
Cappy: [uses RAG embeddings to locate semantically relevant code]
```

*Architecture planning*
```
You: "Plan the migration from REST to GraphQL for the user module"
Cappy: [enters Plan Mode, analyzes dependencies, generates step-by-step plan]
```

---

## Configuration Reference

| Key | Description | Default |
|-----|-------------|---------|
| `openrouterApiKey` | Your OpenRouter API key | — |
| `model` | LLM model to use | `openai/gpt-oss-120b` |
| `visionModel` | Vision model for image inputs | `meta-llama/llama-3.2-11b-vision-instruct:free` |
| `contextWindow` | Max context window tokens | `128000` |
| `agent` | Default agent mode | `coder` |
| `maxIterations` | Max agent loop iterations | `20` |
| `mcpServers` | External MCP tool servers | `[]` |
| `rag.enabled` | Enable semantic code search | `true` |
| `rag.embeddingModel` | Embedding model | `text-embedding-3-small` |

---

## Development

```bash
git clone https://github.com/cecon/cappy.git
cd cappy
pnpm install
pnpm dev       # Start webview dev server
# Press F5 in VS Code to launch Extension Development Host
```

---

## License

MIT — see [LICENSE](LICENSE.txt)
