<p align="center">
  <img src="src/assets/icon.png" alt="Cappy" width="120" />
</p>

<h1 align="center">Cappy</h1>

<p align="center">
  <b>Your AI dev companion — in your IDE and on WhatsApp.</b><br/>
  <i>Code smarter. Ship faster. Stay connected.</i>
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

You're deep in a coding session. Your phone buzzes — a bug report. You context-switch to Slack. Then Jira. Then back to the IDE. **You've lost 23 minutes.** Sound familiar?

What if your IDE could talk to you on WhatsApp? What if you could triage, plan, and monitor your projects from anywhere — without ever leaving the conversation?

## The Solution: Meet Cappy

**Cappy** is an AI-powered VS Code extension that bridges the gap between your IDE and your life. It's not just another coding assistant — it's a **full dev companion** that lives where you already are: in your editor and on your phone.

> 🦫 *Think of Cappy as a senior developer who never sleeps, never forgets, and is always a WhatsApp message away.*

---

## ✨ Key Features

### 🔗 WhatsApp Dev Bridge
*Your IDE, in your pocket.*

Connect your WhatsApp to your IDE and interact with your projects from anywhere. No extra apps. No dashboards. Just chat.

```
You: @erp run the tests
🦫 Cappy [erp-dsl]: 🧪 47 passing | ❌ 2 failing

You: @mobile what's the build status?
🦫 Cappy [mobile-app]: ✅ Build passing
```

- **Bi-directional messaging** — send commands, receive results
- **Multi-project support** — manage multiple workspaces simultaneously
- **Human-in-the-loop** — authorize AI actions remotely, stay in control
- **Zero setup on phone** — if you have WhatsApp, you're ready

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
- WhatsApp connection status with visual indicator
- Live message feed from your phone
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

### Connect WhatsApp

1. Open the Cappy Dashboard (sidebar icon)
2. Click **Connect WhatsApp**
3. Scan the QR code with your phone
4. Start chatting with your IDE 🎉

### Use the AI Agent

Just type `@cappy` followed by your request in any AI chat panel. That's it.

---

## 🗺️ Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| ✅ | AI Planning Agent (`@cappy`) | **Live** |
| ✅ | WhatsApp Bridge | **Live** |
| ✅ | Live Dashboard | **Live** |
| 🔜 | Code Health Score (0-100) | *Coming Soon* |
| 🔜 | Scheduled Health Checks & Cron Jobs | *Planned* |
| 🔜 | GitHub/Jira Integration via MCP | *Planned* |
| 🔜 | Daily Digest on WhatsApp | *Planned* |

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
| WhatsApp | Baileys (Web API) |
| Realtime | WebSocket (port 9090) |
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
