<p align="center">
  <img src="src/assets/icon.png" alt="Cappy" width="120" />
</p>

<h1 align="center">Cappy</h1>

<p align="center">
  <b>The AI developer that lives in your IDE<br/>and answers on WhatsApp.</b>
</p>

<p align="center">
  Run commands.<br/>
  Check builds.<br/>
  Approve deploys.<br/><br/>
  All from WhatsApp.
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

<p align="center">
  <img src="docs/demo.png" alt="Cappy — IDE + WhatsApp" width="600" />
</p>

<p align="center">
  <sub>⭐ Star this repo if the idea makes you smile.</sub>
</p>

---

## 💡 The Scenario

You're in traffic.

Production just broke.

You open WhatsApp:

```
You: @api run tests
```

30 seconds later:

```
🦫 Cappy: ❌ 2 failing — payment.service.ts:42
```

You reply:

```
You: approve hotfix deploy
🦫 Cappy: ✅ Deployed. All green.
```

**Production fixed before you get home.**

No laptop. No VPN. No context switch. Just a chat.

---

## �️ Human-in-the-Loop AI

This is what makes Cappy different.

Before any destructive action — `git push`, deploy, database migration — Cappy asks **you** for approval. On WhatsApp.

```
🦫 Cappy: ⚠️ High-risk action requested
   Action: Deploy to production
   Command: npm run deploy:prod
   
   Reply SIM to approve, NÃO to cancel.

You: SIM
🦫 Cappy: ✅ Deployed successfully.
```

**AI that respects your authority — even when you're away from your desk.**

---

## 🔥 Why developers love Cappy

### 1️⃣ Control your projects from WhatsApp

Run commands.<br/>
Check builds.<br/>
Approve AI actions.

All from your phone.

```
You: @erp run the tests
🦫 Cappy [erp-dsl]: 🧪 47 passing | ❌ 2 failing

You: approve deploy to staging
🦫 Cappy: ✅ Deploying...
```

No extra apps. No dashboards. If you have WhatsApp, you're ready.

### 2️⃣ Turn ideas into executable plans

Describe a feature. Cappy analyzes your codebase and creates a **structured execution plan** — with checklists, acceptance criteria, and step-by-step guidance.

```
@cappy implement JWT authentication with refresh tokens
@cappy refactor payment module to strategy pattern
```

### 3️⃣ Build a portable knowledge base

Drop documents into the dashboard. Query them instantly.

**Zero-dependency RAG.**

No vector databases.<br/>
No external services.<br/>
Everything local.

Your codebase and docs become searchable knowledge — stored as plain JSON in your project.

---

## � What Cappy actually is

Cappy is a VS Code extension that connects your IDE to a WhatsApp chat via a **secure local bridge**.

Your phone becomes a remote console for your projects.

```
IDE ←→ WebSocket Bridge ←→ WhatsApp
         (port 9090)
```

No cloud relay. No third-party servers. Everything runs on your machine.

---

## ⚡ Features

### 📊 Dashboard with Tabs

A sleek sidebar with three organized views:

| Tab | What's inside |
|-----|--------------|
| 💬 **WhatsApp** | Connection status with animated hero ring, live message feed, bridge settings |
| ⏰ **Tarefas** | Scheduled & one-off tasks, create/pause/delete, execution status |
| 📓 **Notebooks** | RAG knowledge bases, click-to-add files, chunk & source counts |

### ⏰ Task Scheduler

Automate recurring workflows from the dashboard:

- **Recurring or one-off** execution
- **New Chat or Terminal** modes
- **WhatsApp notifications** on completion
- Pause, resume, run on demand

### 🛠️ 11 Built-in Tools

| Tool | Superpower |
|------|-----------|
| `grep_search` | Search across your entire workspace |
| `read_file` | Read any file with smart line ranges |
| `create_file` | Create files in the workspace |
| `fetch_web` | Pull content from URLs |
| `create_task_file` | Generate structured task plans |
| `run_terminal_command` | Execute shell commands |
| `notebook_ingest` | Add documents to RAG |
| `notebook_search` | Query your knowledge base |
| `reply_whatsapp` | Send messages to WhatsApp |
| `whatsapp_confirmation` | Human-in-the-loop approvals |
| `create_todo` | Quick task tracking |

---

## 🚀 Quick Start

### Install

Search for **"Cappy"** in the VS Code / Cursor / Antigravity Marketplace, or:

```bash
code --install-extension eduardocecon.cappy
```

### Connect WhatsApp

1. Open the Cappy Dashboard (sidebar icon 🦫)
2. Click **Connect WhatsApp**
3. Scan the QR code
4. Start chatting with your IDE 🎉

### Add a Notebook

1. Go to the **📓 Notebooks** tab
2. Click the **+** drop zone
3. Select files — they're chunked, embedded, and indexed automatically
4. Query with `@cappy` — results come from your own knowledge base

---

## 🏗️ Architecture

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Platform | VS Code Extension API |
| AI | VS Code Language Model API |
| WhatsApp | Baileys (Web API) |
| Realtime | WebSocket (port 9090) |
| RAG | Zero-dependency · Hash Embeddings + Knowledge Graph |
| Tests | Vitest |

### Compatible Editors

- **VS Code** (1.105.0+)
- **Cursor**
- **Antigravity IDE**

---

## 🗺️ Roadmap

| Status | Feature |
|--------|---------|
| ✅ Live | WhatsApp Dev Bridge |
| ✅ Live | AI Planning Agent (`@cappy`) |
| ✅ Live | Dashboard with Tabs |
| ✅ Live | Cron Scheduler |
| ✅ Live | Portable RAG (Notebooks) |
| ✅ Live | Human-in-the-Loop (HITL) |
| 🔜 | Code Health Score (0-100) |
| 🔜 | GitHub/Jira Integration via MCP |
| 🔜 | Daily Digest on WhatsApp |

---

## 🧑‍💻 Development

```bash
npm install                # Install dependencies
npm run compile-extension  # Compile
npm test                   # Run tests
npm run package            # Package .vsix
```

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  <b>⭐ If Cappy helps you, please star the repo — it makes a difference.</b>
</p>

<p align="center">
  Built with 🧡 by <a href="https://github.com/cecon">Eduardo Cecon</a><br/>
  <sub>Designed for developers who hate context switching.</sub>
</p>
