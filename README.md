# 🦫 Cappy - Minimal Setup + KnowStack

> A lightweight VS Code extension that sets up the Cappy methodology for solo developers

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solo Developer](https://img.shields.io/badge/Optimized%20for-Solo%20Developers-blue.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy)

[**Install**](#-installation) • [**Quick Setup**](#-quick-setup) • [**Manual Usage**](#-manual-usage) • [**GitHub**](https://github.com/cecon/cappy)

</div>

---

## 🎯 What is Cappy?

**Cappy** is a **minimal VS Code extension** that sets up the Cappy methodology structure for solo developers. It now includes a first-class, guided command to establish the project stack as ground truth before you run anything else.

### 🏗️ **What it Creates**
- **Project Structure**: `.cappy/` folder with configuration (`config.yaml`)
- **Copilot Instructions**: Private GitHub Copilot instructions with version control (gitignored)
- **Stack Doc**: `.github/instructions/copilot.stack.md` as the single source of truth for your stack
- **Cappy Config Markers**: A parseable section inside `.github/copilot-instructions.md` linking to the stack doc
- **Prevention Rules**: Template for documenting project-specific rules
- **XML Task Structure**: Documentation and examples for manual task management

### 🎯 **Philosophy: Minimal Extension, Maximum Control**

This extension follows the **initialization-only** approach:
- ✅ **Setup**: Creates folder structure and documentation
- ✅ **Configuration**: Generates personalized Copilot instructions with version control
- 📁 **Task Management**: Manual file editing (no UI complexity)
- 📁 **Progress Tracking**: Manual XML editing
- 📁 **History**: Manual file organization

---

## 🚀 Quick Setup

### Step 1: Install the Extension
```bash
# Install from VS Code Marketplace
code --install-extension eduardocecon.cappy
```

### Step 2: Initialize Your Project
1. Open your project in VS Code
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
3. Type `Cappy: Initialize`
4. Follow the prompts

### Step 3: Know your Stack (Required)
1. Press `Ctrl+Shift+P`
2. Run `Cappy: KnowStack`
3. Answer questions one-by-one; we’ll draft `.github/instructions/copilot.stack.md` in English
4. Approve the final stack; we’ll update the Cappy Config markers in `.github/copilot-instructions.md`

Notes:
- Until the stack is approved, other commands will prompt you to run “Cappy: KnowStack”.

### Step 4: Start Working
- Edit `.cappy/prevention-rules.md` to add project-specific rules
- Create task XML files manually in `.cappy/` folder
- Use GitHub Copilot with the generated instructions and the approved stack doc

---

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `Cappy: Initialize` | Set up Cappy structure and configuration |
| `🧠 Cappy: KnowStack` | Guided flow to create/validate the project stack. Creates `.github/instructions/copilot.stack.md` and updates Cappy Config markers inside `.github/copilot-instructions.md`. Required before other commands. |

---

## 📁 File Structure Created

```
your-project/
├── .cappy/
│   ├── config.yaml                    # Cappy configuration (YAML)
│   ├── prevention-rules.md            # Project-specific rules
│   └── history/                       # Manual task history
├── .github/
│   ├── copilot-instructions.md        # Private Copilot instructions (gitignored)
│   └── instructions/
│       └── copilot.stack.md           # Project stack (single source of truth)
└── .gitignore                         # Updated with Cappy entries
```

---

## 🛠️ Manual Task Management

### Creating a Task
Create a new XML file in `.cappy/` folder:

```xml
<task id="implement-auth" versao="1.0">
    <metadados>
        <titulo>Implement User Authentication</titulo>
        <descricao>Add login/logout functionality</descricao>
        <status>em-andamento</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="React" versao="18+"/>
        <dependencias>
            <lib>jwt</lib>
            <lib>bcryptjs</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Create Login Component</titulo>
            <descricao>Build React component for login form</descricao>
            <criterios>
                <criterio>Form validation</criterio>
                <criterio>Error handling</criterio>
            </criterios>
            <entrega>src/components/Login.jsx</entrega>
        </step>
        
        <step id="step002" ordem="2" concluido="false" obrigatorio="true">
            <titulo>API Integration</titulo>
            <descricao>Connect to authentication API</descricao>
            <criterios>
                <criterio>JWT token storage</criterio>
                <criterio>Auto-logout on expire</criterio>
            </criterios>
            <entrega>src/services/auth.js</entrega>
        </step>
        
        <step id="step003" ordem="3" concluido="false" obrigatorio="true">
            <titulo>Protected Routes</titulo>
            <descricao>Implement route protection</descricao>
            <criterios>
                <criterio>Redirect to login</criterio>
                <criterio>Preserve intended route</criterio>
            </criterios>
            <entrega>src/components/ProtectedRoute.jsx</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>All mandatory steps completed</item>
            <item>Tests passing</item>
            <item>Code reviewed</item>
        </checklist>
    </validacao>
</task>
```

### Updating Progress
Mark steps as complete by changing `concluido="true"`:

```xml
<step id="step001" ordem="1" concluido="true" obrigatorio="true">
```

### Managing History
Move completed tasks to `.cappy/history/` folder manually.

---

## 🛡️ Prevention Rules

Add project-specific rules to `.cappy/prevention-rules.md`:

```markdown
# 🛡️ Prevention Rules

## [AUTH] Authentication Flow
**Problem:** JWT tokens stored in localStorage vulnerable to XSS
**Solution:** Use httpOnly cookies for token storage
**Example:** `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`

## [REACT] Component Structure
**Problem:** Mixing business logic with UI components
**Solution:** Separate concerns using custom hooks
**Example:** Use `useAuth()` hook instead of auth logic in components
```

---

## 🤖 GitHub Copilot Integration & Cappy Config

The extension creates versioned instructions for GitHub Copilot and manages a Cappy Config block used by the LLM:

```markdown
=====================START CAPYBARA MEMORY v1.0.0=====================
# 🔨 Cappy - GitHub Copilot Instructions

## 📋 **PROJECT CONTEXT**
- **Project**: your-project-name
- **Main Language**: javascript, typescript
- **Frameworks**: React

## 🎯 **CAPYBARA METHODOLOGY**
This project uses Cappy methodology for solo development...
======================END CAPYBARA MEMORY v1.0.0======================
```

These are:
- **Private**: Added to `.gitignore` automatically
- **Versioned**: Easy to update and track changes
- **Preserved**: Other content in the file is maintained

Additionally, we insert/update a Cappy Config section inside `.github/copilot-instructions.md` (between idempotent markers):

```
<!-- CAPY:CONFIG:BEGIN -->
### Cappy Config

```yaml
cappy-config:
    version: 1
    templates:
        stack-instruction: true
    stack:
        source: ".github/instructions/copilot.stack.md"
        last-validated-at: "2025-08-08T00:00:00Z"
        validated-by: "user-confirmation"
    notes:
        - "Stack reviewed and approved; use as single source of truth."
```
<!-- CAPY:CONFIG:END -->
```

Rules:
- If markers exist, we replace only the content between them
- If not, we append the section near the end of the file
- We preserve all other content verbatim

---

## 🔧 Configuration

The `.cappy/config.yaml` file contains project configuration:

```yaml
# Cappy Configuration
version: "1.0.0"
project:
    name: "your-project"
    type: "node-app"
    languages:
        - "javascript"
        - "typescript"
    frameworks:
        - "vscode-extension"
    description: "Project description"

cappy:
    initialized_at: "2025-01-01T00:00:00.000Z"
    last_updated: "2025-01-01T00:00:00.000Z"

tasks:
    directory: "tasks"
    history_directory: "history"

instructions:
    directory: "instructions"
```
## 🧠 KnowStack Flow (Guided)

1) Analysis
- Ask one question per turn; wait for user reply
- After each answer, refine understanding and list remaining doubts
- Stop when no material doubts remain

2) Write the Stack Doc (English)
- Create/update `.github/instructions/copilot.stack.md`
- Cover: Languages & frameworks, Project structure & modules, Key dependencies & versions, Coding standards & conventions, Build/Test/CI/CD & deployment, Env/config & secrets handling (never expose secrets), Observability & tooling, Known constraints & non-goals

3) Validate with user
- Ask: “Anything missing or inaccurate?”
- Only proceed after approval

4) Update Cappy Config markers
- Insert or update the YAML block between `CAPY:CONFIG:BEGIN/END` in `.github/copilot-instructions.md`
- Set `last-validated-at` to the current UTC ISO timestamp

5) Versioning
- Suggested commits:
    - `docs(stack): add or update copilot.stack.md`
    - `docs(cappy): update cappy-config in copilot-instructions.md`

6) Gating
- All commands rely on the approved stack
- If the stack changes later: update `.stack.md` → validate → update Cappy Config


---

## 🎯 Cappy Methodology Principles

1. **Atomic Tasks**: Maximum 2-3 hours per task
2. **XML Structure**: Tasks defined in structured XML files
3. **Continuous Learning**: Every error becomes a prevention rule
4. **Preserved Context**: AI always informed of current state
5. **Minimal Documentation**: Only what saves time

---

## 📖 Why "Initialization Only"?

- **Lightweight**: No complex UI or background processes
- **Flexible**: Manual file editing allows full customization
- **Reliable**: Simple structure, less prone to bugs
- **Transparent**: You control all files and their content
- **Focused**: Does one thing well - project setup

---

## 🤝 Contributing

Since this is a minimal extension, contributions focus on:
- Improving initialization process
- Better documentation templates
- Enhanced project detection
- Bug fixes and stability

---

## 📄 License

MIT License - feel free to use in your projects!

---

## 🦫 About Cappy

Cappy methodology is designed for solo developers who want structure without complexity. Like the animal, it's calm, methodical, and gets things done efficiently.

**Happy coding!** 🚀
