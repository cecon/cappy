# 🦫 Capybara - Minimal Setup

> A lightweight VS Code extension that sets up the Capybara methodology for solo developers

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solo Developer](https://img.shields.io/badge/Optimized%20for-Solo%20Developers-blue.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.capybara)

[**Install**](#-installation) • [**Quick Setup**](#-quick-setup) • [**Manual Usage**](#-manual-usage) • [**GitHub**](https://github.com/cecon/capybara)

</div>

---

## 🎯 What is Capybara?

**Capybara** is a **minimal VS Code extension** that sets up the Capybara methodology structure for solo developers. It focuses on **initialization only** - providing the essential files and documentation for the Capybara workflow.

### 🏗️ **What it Creates**
- **Project Structure**: `.capy/` folder with configuration
- **Copilot Instructions**: Private GitHub Copilot instructions with version control (gitignored)
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
code --install-extension eduardocecon.capybara
```

### Step 2: Initialize Your Project
1. Open your project in VS Code
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
3. Type `Capybara: Initialize`
4. Follow the prompts

### Step 3: Start Working
- Edit `.capy/prevention-rules.md` to add project-specific rules
- Create task XML files manually in `.capy/` folder
- Use GitHub Copilot with the generated instructions

---

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `Capybara: Initialize` | Set up Capybara structure and configuration |
| `Capybara: Test Capybara Extension` | Test if extension is working |

---

## 📁 File Structure Created

```
your-project/
├── .capy/
│   ├── config.json                    # Capybara configuration
│   ├── prevention-rules.md            # Project-specific rules
│   └── history/                       # Manual task history
├── .github/
│   └── copilot-instructions.md        # Private Copilot instructions (gitignored)
└── .gitignore                         # Updated with Capybara entries
```

---

## 🛠️ Manual Task Management

### Creating a Task
Create a new XML file in `.capy/` folder:

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
Move completed tasks to `.capy/history/` folder manually.

---

## 🛡️ Prevention Rules

Add project-specific rules to `.capy/prevention-rules.md`:

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

## 🤖 GitHub Copilot Integration

The extension automatically creates versioned instructions for GitHub Copilot:

```markdown
=====================START CAPYBARA MEMORY v1.0.0=====================
# 🔨 Capybara - GitHub Copilot Instructions

## 📋 **PROJECT CONTEXT**
- **Project**: your-project-name
- **Main Language**: javascript, typescript
- **Frameworks**: React

## 🎯 **CAPYBARA METHODOLOGY**
This project uses Capybara methodology for solo development...
======================END CAPYBARA MEMORY v1.0.0======================
```

These instructions are:
- **Private**: Added to `.gitignore` automatically
- **Versioned**: Easy to update and track changes
- **Preserved**: Other content in the file is maintained

---

## 🔧 Configuration

The `.capy/config.json` file contains project configuration:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "your-project",
    "language": ["javascript", "typescript"],
    "framework": ["react"],
    "description": "Project description"
  },
  "createdAt": "2025-01-01T00:00:00.000Z",
  "lastUpdated": "2025-01-01T00:00:00.000Z"
}
```

---

## 🎯 Capybara Methodology Principles

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

## 🦫 About Capybara

Capybara methodology is designed for solo developers who want structure without complexity. Like the animal, it's calm, methodical, and gets things done efficiently.

**Happy coding!** 🚀
