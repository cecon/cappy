<p align="center">
  <img src="src/assets/icon.png" alt="Cappy" width="120" />
</p>

<h1 align="center">Cappy</h1>

<p align="center">
  <b>Your AI dev companion inside the IDE.</b><br/>
  <i>Code smarter. Ship faster.</i>
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

What if one agent inside your IDE could plan, execute, and validate tasks with full project context?

## The Solution: Meet Cappy

**Cappy** is an AI-powered VS Code extension focused on planning and agent execution directly in your workspace. It's not just another coding assistant — it's a **full dev companion** that lives where you already are: in your editor.

> 🦫 *Think of Cappy as a senior developer who never sleeps and never forgets project context.*

---

## ✨ Key Features

### 🤖 Native Agent Experience
*Plan and execute without leaving the editor.*

- **Native chat participant (`@cappy`)** in IDE chat
- **Agent mode with tool calls** and approval flow
- **Streaming responses** with live progress
- **Session continuity** between native chat and dashboard

### 🧠 AI Planning Agent
*From idea to structured plan in seconds.*

Mention `@cappy` in any AI chat and get intelligent, context-aware planning:

```
@cappy implement JWT authentication with refresh tokens
@cappy refactor the payment module to use the strategy pattern
@cappy help me fix the flaky tests in src/auth/
```

Cappy analyzes your codebase, asks clarifying questions, and generates **structured task files** with implementation checklists, acceptance criteria, and step-by-step guidance.

### 📊 Live Dashboard
*Everything at a glance.*

A sleek sidebar dashboard shows you real-time status:
- Session list with pin/archive/search
- Tool-call timeline and streaming progress
- Quick settings and configuration

### 🛠️ Powerful Built-in Tools

| Tool | What it does |
|------|-------------|
| `grep_search` | Search across your entire workspace |
| `read_file` | Read any file with smart line ranges |
| `fetch_web` | Pull content from URLs |
| `create_task_file` | Generate structured task plans |
| `run_terminal_command` | Execute commands directly |
| `create_todo` | Quick task tracking |

---

## 🚀 Getting Started

### Install

Search for **"Cappy"** in the VS Code / Cursor / Antigravity Marketplace, or:

```bash
code --install-extension eduardocecon.cappy
```

### Open Dashboard

1. Open the Cappy Dashboard (sidebar icon)
2. Configure provider/model in settings
3. Start planning and executing tasks with Cappy

### Use the AI Agent

Just type `@cappy` followed by your request in any AI chat panel. That's it.

---

## 🗺️ Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| ✅ | AI Planning Agent (`@cappy`) | **Live** |
| ✅ | Native Agent + Webview Sync | **Live** |
| ✅ | Live Dashboard | **Live** |
| 🔜 | Code Health Score (0-100) | *Coming Soon* |
| 🔜 | Scheduled Health Checks & Cron Jobs | *Planned* |
| 🔜 | GitHub/Jira Integration via MCP | *Planned* |

### Coming Soon: Code Health Score 🏥

> Know your project's health at a glance — scores across file size, test coverage, lint, complexity, and documentation.

```
🦫 Cappy: Project Health: 71/100
├── File Size:    58/100  🔴 12 files > 300 lines
├── Coverage:     45/100  🔴 Only 23% covered
├── Lint:         81/100  ⚡ 47 warnings
└── Complexity:   69/100  ⚡ 8 functions > 10 cyclomatic
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Platform | VS Code Extension API |
| AI Engine | VS Code Language Model API + LangGraph |
| Build | TSC |
| Tests | Vitest |

---

## 🤝 Compatible With

Cappy works across multiple AI-powered editors:

- **VS Code** (1.105.0+)
- **Cursor**
- **Antigravity IDE**

---

## 🧑‍💻 Development

```bash
# Install dependencies
npm install

# Compile
npm run compile-extension

# Run tests
npm test

# Package .vsix
npm run package
```

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  Built with 🧡 by <a href="https://github.com/cecon">Eduardo Cecon</a><br/>
  <sub>Because developers deserve tools that respect their flow.</sub>
</p>
