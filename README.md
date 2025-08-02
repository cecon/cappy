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
- **Copilot Instructions**: Private GitHub Copilot instructions (gitignored)
- **Prevention Rules**: Template for documenting project-specific rules
- **XML Task Structure**: Documentation and examples for manual task management

### 🎯 **Philosophy: Minimal Extension, Maximum Control**

This extension follows the **initialization-only** approach:
- ✅ **Setup**: Creates folder structure and documentation
- ✅ **Configuration**: Generates personalized Copilot instructions
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
After initialization, you'll have:
- `.capy/config.json` - Project configuration
- `.capy/prevention-rules.md` - Document your project-specific rules
- `.github/copilot-instructions.md` - Private Copilot instructions (gitignored)

---

## 📁 Manual Usage

### Creating Tasks
Create XML files manually in `.capy/` folder:

```xml
<!-- .capy/my-task.xml -->
<task id="implement-auth" versao="1.0">
    <metadados>
        <titulo>Implement User Authentication</titulo>
        <descricao>Add login/logout functionality with JWT</descricao>
        <status>em-andamento</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="Node.js" versao="18+"/>
        <dependencias>
            <lib>jsonwebtoken</lib>
            <lib>bcryptjs</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Create User Model</titulo>
            <descricao>Define user schema with email/password</descricao>
            <criterios>
                <criterio>Email validation</criterio>
                <criterio>Password hashing</criterio>
            </criterios>
            <entrega>models/User.js</entrega>
        </step>
        
        <step id="step002" ordem="2" concluido="false" obrigatorio="true">
            <titulo>Implement Login Route</titulo>
            <descricao>Create POST /login endpoint</descricao>
            <criterios>
                <criterio>JWT token generation</criterio>
                <criterio>Error handling</criterio>
            </criterios>
            <entrega>routes/auth.js</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>All mandatory steps completed</item>
            <item>Tests passing</item>
            <item>Documentation updated</item>
        </checklist>
    </validacao>
</task>
```

### Managing Progress
Edit XML files to mark steps as complete:
```xml
<step id="step001" ordem="1" concluido="true" obrigatorio="true">
```

### Adding Prevention Rules
Document project-specific patterns in `.capy/prevention-rules.md`:

```markdown
# 🛡️ Prevention Rules

## [AUTH] JWT Token Handling
**Context:** When implementing authentication
**Problem:** Forgetting to set token expiration
**Solution:** Always set reasonable expiration (24h for access, 7d for refresh)
**Example:** `jwt.sign(payload, secret, { expiresIn: '24h' })`

## [DATABASE] Connection Error Handling
**Context:** Database operations
**Problem:** Not handling connection failures gracefully
**Solution:** Always wrap DB calls in try-catch with proper error messages
```

---

## 🔧 Available Commands

- **`Capybara: Initialize`** - Set up Capybara structure in your project
- **`Capybara: Test`** - Verify the extension is working

That's it! The extension is intentionally minimal.

---

## 🎯 Capybara Methodology

The Capybara methodology (Focus, Organize, Record, Grow, Evolve) emphasizes:

### **1. Focus** 🎯
- Work on one atomic task at a time (2-3 hours max)
- Clear start and end criteria

### **2. Organize** 📋
- Structure tasks with XML for clarity
- Define context and dependencies upfront

### **3. Record** 📝
- Document mistakes as prevention rules
- Keep private instructions for your AI assistant

### **4. Grow** 🌱
- Learn from each completed task
- Build up project-specific knowledge

### **5. Evolve** 🔄
- Continuously improve your process
- Adapt patterns as projects grow

---

## 🤖 GitHub Copilot Integration

After initialization, your `.github/copilot-instructions.md` will contain:
- Project context and tech stack
- Capybara methodology guidelines
- Your prevention rules (automatically loaded)
- XML task structure documentation

This file is private (gitignored) and makes your AI assistant smarter with every project.

---

## 🛠️ File Structure

After initialization:
```
your-project/
├── .capy/
│   ├── config.json           # Project configuration
│   ├── prevention-rules.md   # Your documented rules
│   └── history/              # Completed tasks (manual)
├── .github/
│   └── copilot-instructions.md # Private AI instructions
└── .gitignore               # Updated with Capybara entries
```

---

## 📖 Why Manual Management?

This extension intentionally avoids complex UI and automation because:

1. **Simplicity**: No learning curve for task management interfaces
2. **Flexibility**: Edit XML and markdown with full VS Code power
3. **Transparency**: See exactly what's happening with your files
4. **Performance**: No overhead from complex task tracking
5. **Focus**: Spend time coding, not configuring task management

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

This is a minimal extension by design. Contributions should focus on:
- Bug fixes in initialization
- Improvements to generated templates
- Better language/framework detection
- Documentation improvements

Complex task management features should be separate extensions.

---

<div align="center">

**🦫 Keep it simple. Keep it focused. Keep coding.**

</div>
