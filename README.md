# 🦫 Cappy - AI Task Management for Solo Developers

> Your calm and wise AI coding companion with Single-Focus Workflow that learns from your mistakes automatically

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-2.6.20-blue.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)
[![Solo Developer](https://img.shields.io/badge/Optimized%20for-Solo%20Developers-green.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)

[**Install**](#-installation) • [**Quick Setup**](#-quick-setup) • [**Commands**](#-commands) • [**GitHub**](https://github.com/cecon/cappy)

</div>

---

## 🎯 What is Cappy?

**Cappy** is an intelligent VS Code extension that implements a **LLM Runtime** for task management. It creates a structured workflow where you interact with GitHub Copilot using specific commands to manage atomic tasks (≤3h each), with automatic learning from mistakes through Prevention Rules.

### 🧠 **Core Philosophy**
- **LLM Runtime**: Commands prefixed with `cappy:` have maximum priority
- **Single Source of Truth**: All command outputs go to `.cappy/output.txt` 
- **Atomic Tasks**: Maximum 3 hours per task for maintainability
- **Prevention Learning**: Every mistake becomes a documented rule
- **1x1 Interaction**: One question at a time for clarity

### 🏗️ **What it Creates**
- **Task Management**: XML-based atomic tasks with lifecycle tracking
- **KnowStack**: Project knowledge base (`.cappy/stack.md`)
- **Prevention Rules**: Automatic learning from mistakes
- **LLM Integration**: Structured GitHub Copilot instructions
- **Output System**: Centralized command feedback via `.cappy/output.txt`

---

## 🚀 Quick Setup

### 1. Install the Extension
```bash
# Install from VS Code Marketplace
code --install-extension eduardocecon.cappy
```

### 2. Initialize Cappy
1. Open your project in VS Code
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
3. Run `🦫 Initialize Cappy`
4. Cappy creates `.cappy/` structure and configuration

### 3. Build Knowledge Stack (Required)
1. In GitHub Copilot Chat, type: `cappy:knowstack`
2. Answer questions about your project one by one
3. Approve the generated stack documentation
4. Cappy updates project knowledge base

### 4. Start Working with Tasks
1. Type `cappy:newtask` in Copilot Chat
2. Follow the guided task creation process
3. Use `cappy:taskstatus` to check active tasks
4. Complete tasks with `cappy:taskcomplete`

---

## 📋 LLM Commands (GitHub Copilot Chat)

| Command | Description |
|---------|-------------|
| `cappy:knowstack` | Analyze project and build knowledge stack |
| `cappy:newtask` | Get template for creating new atomic task |
| `cappy:createtaskfile` | Create new task XML file |
| `cappy:taskstatus` | Check active task status |
| `cappy:taskcomplete` | Complete current active task |
| `cappy:version` | Get Cappy extension version |

### VS Code Command Palette Commands
| Command | Description |
|---------|-------------|
| `🦫 Initialize Cappy` | Set up Cappy structure and configuration |
| `🧠 Cappy: KnowStack` | Alternative way to build knowledge stack |

---

## 📁 File Structure Created

```
your-project/
├── .cappy/
│   ├── tasks/                          # Active task XML files (*.active.xml)
│   ├── history/                        # Completed tasks (*.done.xml)
│   ├── config.yaml                     # Cappy configuration
│   ├── stack.md                        # Project knowledge base
│   ├── prevention-rules.xml            # Learning from mistakes
│   └── output.txt                      # Command outputs (LLM reads this)
├── .github/
│   └── copilot-instructions.md         # Enhanced with Cappy methodology
└── .gitignore                          # Updated with Cappy entries
```

---

## 🔄 Typical Workflow

1. **Initialize**: Run `🦫 Initialize Cappy` once per project
2. **Know Your Stack**: `cappy:knowstack` to build project knowledge
3. **Create Task**: `cappy:newtask` → answer scope questions → `cappy:createtaskfile`
4. **Work**: Edit code, check progress with `cappy:taskstatus`
5. **Complete**: `cappy:taskcomplete` when task criteria met
6. **Learn**: Mistakes become prevention rules automatically

---

## 📋 Task Management

### XML Task Structure
Tasks are managed as XML files with this structure:

```xml
<Task id="implement-auth" status="em-andamento">
    <title>Implement User Authentication</title>
    <goals>
        <goal>Add login/logout functionality</goal>
        <goal>Secure user sessions</goal>
    </goals>
    
    <steps>
        <step id="step001" done="false">
            <title>Create Login Component</title>
            <doneWhen>Form validates and handles errors</doneWhen>
        </step>
        <step id="step002" done="false">
            <title>API Integration</title>
            <doneWhen>JWT tokens stored and managed</doneWhen>
        </step>
    </steps>
    
    <meta>
        <estimate>2.5h</estimate>
        <createdAt>2025-08-15T10:30:00Z</createdAt>
    </meta>
</Task>
```

### Task Lifecycle
- `prepared` → `em-andamento` → `paused` → `completed`
- Files: `*.active.xml` → `*.paused.xml` → `*.done.xml`
- Location: `.cappy/tasks/` → `.cappy/history/`

---

## 🛡️ Prevention Rules

Cappy automatically learns from your mistakes. When you encounter issues, they become prevention rules:

```markdown
# 🛡️ Prevention Rules

## [AUTH] JWT Storage
**Problem:** Tokens stored in localStorage vulnerable to XSS
**Solution:** Use httpOnly cookies for secure storage
**Example:** `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`

## [REACT] Component Props
**Problem:** Passing too many props creates tight coupling
**Solution:** Use context or composition patterns
**Example:** `useAuth()` hook instead of passing auth props
```

---

## 🧠 KnowStack: Project Knowledge Base

The KnowStack (`.cappy/stack.md`) contains your project's complete technical context:

- **Languages & Frameworks**: What you're using and versions
- **Architecture**: How your project is structured
- **Dependencies**: Key libraries and their purposes
- **Standards**: Coding conventions and patterns
- **Environment**: Build, test, and deployment setup
- **Constraints**: Known limitations and non-goals

This becomes the foundation for all LLM interactions.

---

## ⚙️ Configuration

The `.cappy/config.yaml` file contains project settings:

```yaml
# Cappy Configuration
version: "2.6.20"
project:
    name: "your-project"
    type: "node-app"
    languages:
        - "javascript"
        - "typescript"
    frameworks:
        - "react"

cappy:
    initialized_at: "2025-08-15T10:30:00Z"
    last_updated: "2025-08-15T10:30:00Z"

tasks:
    directory: "tasks"
    history_directory: "history"
```

---

## 🎯 Key Principles

### 1. **Atomic Tasks**
- Maximum 3 hours per task
- Clear, measurable completion criteria
- Single responsibility focus

### 2. **LLM Runtime**
- Commands prefixed with `cappy:` have priority
- All outputs go to `.cappy/output.txt`
- GitHub Copilot reads this file for context

### 3. **Continuous Learning**
- Every mistake becomes a prevention rule
- Rules are automatically included in future context
- Project knowledge grows over time

### 4. **Single Focus**
- One active task at a time
- Clear status tracking
- Minimize context switching

---

## 🔧 Advanced Usage

### Custom Task Templates
You can customize task templates by editing the instruction files in the extension.

### Integration with CI/CD
Prevention rules and task history can be used to improve automated workflows.

### Team Adaptation
While optimized for solo developers, Cappy can be adapted for small teams by sharing the `.cappy/` structure.

---

## 🤝 Contributing

Contributions are welcome! Focus areas:
- Improving LLM command responses
- Better task template generation
- Enhanced prevention rule detection
- Bug fixes and stability improvements

---

## 📄 License

MIT License - feel free to use in your projects!

---

## 🦫 About Cappy

Cappy methodology is designed for solo developers who want structure without complexity. Like the capybara, it's calm, methodical, and gets things done efficiently.

The extension provides the infrastructure; you provide the intelligence. Together, you build better software, faster.

**Happy coding!** 🚀
