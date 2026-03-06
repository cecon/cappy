# Cappy 🦫

**Your AI dev companion — in VS Code and on WhatsApp.**

Cappy is a VS Code extension that acts as your AI planning assistant. It helps you break down tasks, analyze codebases, and create structured task files — all through natural conversation with `@cappy`.

**Coming soon:** WhatsApp bridge — monitor your projects, authorize AI actions, and get notifications directly on your phone. No app to install, just chat.

[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/eduardocecon.cappy)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)

---

## What Cappy Does Today

### 💬 AI Planning Agent (`@cappy`)

Ask questions, plan tasks, analyze code — Cappy creates structured task files to guide implementation:

```
@cappy implement JWT authentication with refresh tokens
@cappy refactor the payment module to use the strategy pattern
@cappy help me fix the flaky tests in src/auth/
```

### 🛠️ Built-in Tools

| Tool | Description |
|------|-------------|
| `grep_search` | Search text across workspace files |
| `read_file` | Read file contents with line ranges |
| `fetch_web` | Fetch content from web URLs |
| `create_task_file` | Create structured XML task files |
| `check_task_file` | Verify if a task file exists |
| `refine_task` | Improve task files with LLM |
| `run_terminal_command` | Execute shell commands in workspace |
| `create_todo` | Create todo items |
| `list_todos` / `complete_todo` | Manage todo list |

### ⚙️ LLM Configuration

```json
{
  "cappy.llm.preferredModel": "auto"
}
```

Options: `auto` (recommended), `claude-sonnet`, `gpt-4o`, `gpt-4`

---

## 🗺️ Roadmap — What's Coming

### Phase 1: WhatsApp Bridge 📱
> Talk to your VS Code from anywhere via WhatsApp

- Send commands to your IDE from your phone
- Receive build/test notifications
- Authorize AI actions remotely (human-in-the-loop)
- Multi-project support (work across 3-4 projects simultaneously)

```
You: @erp run the tests
🦫 Cappy [erp-dsl]: 🧪 47 passing | ❌ 2 failing

You: @mobile what's the build status?
🦫 Cappy [mobile-app]: ✅ Build passing
```

### Phase 2: Code Health Score 🏥
> Know your project's health at a glance

- Score your codebase (0-100) across multiple dimensions
- Track file size, test coverage, lint, complexity, documentation
- Historical trends — is the project getting better or worse?
- Customizable rules per project (`.cappy/rules.yml`)

```
🦫 Cappy: Project Health: 71/100
├── File Size:    58/100  🔴 12 files > 300 lines
├── Coverage:     45/100  🔴 Only 23% covered
├── Lint:         81/100  ⚡ 47 warnings
└── Complexity:   69/100  ⚡ 8 functions > 10 cyclomatic
```

### Phase 3: Task Automation 🤖
> Cronjobs, daily digests, and proactive monitoring

- Scheduled health checks
- GitHub/Jira integration via MCP
- Daily digest messages on WhatsApp
- PR notifications and review tracking

---

## Architecture

```
src/
├── extension.ts                            # Entry point
├── domains/todo/                           # Todo domain
│   ├── types.ts
│   └── repositories/todo-repository.ts
├── nivel1/adapters/vscode/bootstrap/       # VS Code bootstrap
│   ├── ExtensionBootstrap.ts
│   └── LanguageModelToolsBootstrap.ts
├── nivel2/infrastructure/
│   ├── llm-selector.ts                     # LLM model selection
│   ├── agents/                             # Planning agent (LangGraph)
│   │   ├── index.ts                        # IntelligentAgent
│   │   ├── common/                         # Shared types & state
│   │   └── planning/                       # Planning workflow
│   └── tools/                              # VS Code Language Model Tools
│       ├── grep-search-tool.ts
│       ├── read-file-tool.ts
│       ├── create-task-tool.ts
│       ├── terminal-command-tool.ts
│       └── todo/
└── shared/                                 # Constants, errors, utils
```

---

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.105.0+

### Setup

```bash
npm install
npm run compile-extension    # Compile TypeScript
npm test                     # Run tests
npm run package              # Build .vsix
```

---

## Tech Stack

- **Language**: TypeScript
- **Platform**: VS Code Extension API
- **LLM**: VS Code Language Model API + LangGraph
- **Build**: TSC
- **Tests**: Vitest

---

## License

MIT — see [LICENSE](LICENSE)

---

Created by [Eduardo Cecon](https://github.com/cecon) 🦫
