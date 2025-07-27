# FORGE Framework - VSCode Extension

## 🎯 Transform Your AI Coding Assistant Into a Learning Partner

FORGE (Focus, Organize, Record, Grow, Evolve) is a VSCode extension that automatically accumulates your development knowledge and feeds it to GitHub Copilot, making your AI assistant smarter with every task you complete.

## ✨ Key Features

### 🤖 **Automatic Copilot Integration**
- Automatically updates `.vscode/copilot-instructions.md` with your accumulated knowledge
- Real-time sync of prevention rules and project context
- No manual copy-pasting required

### 📝 **Smart Task Management**
- Create atomic tasks (≤3 hours) with guided workflow
- Automatic time estimation and atomicity analysis
- Built-in templates with prevention rules applied

### 🛡️ **Prevention Rules Engine**
- Extract learning from every mistake automatically
- Categorize rules by type (Database, Security, Performance, etc.)
- Apply relevant rules to new tasks contextually

### 📊 **Analytics Dashboard**
- Track task completion metrics and time accuracy
- Monitor prevention rule effectiveness
- Visualize your development progress

## 🚀 Quick Start

### 1. Install the Extension
```bash
# Search for "FORGE Framework" in VSCode Extensions
# Or install via command line:
code --install-extension forge-framework.forge
```

### 2. Initialize FORGE in Your Project
```
Ctrl+Shift+P → "FORGE: Initialize FORGE in Workspace"
```

### 3. Start Creating Tasks
```
Ctrl+Shift+P → "FORGE: Create New Task"
# Or use the keyboard shortcut: Ctrl+Shift+F Ctrl+N
```

### 4. Watch Copilot Get Smarter
As you complete tasks and document difficulties, FORGE automatically updates your Copilot context with prevention rules.

## 🎮 Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `FORGE: Initialize FORGE in Workspace` | - | Set up FORGE in current workspace |
| `FORGE: Create New Task` | `Ctrl+Shift+F Ctrl+N` | Create a new atomic task |
| `FORGE: Complete Current Task` | `Ctrl+Shift+F Ctrl+C` | Mark task as complete |
| `FORGE: Add Prevention Rule` | - | Manually add a prevention rule |
| `FORGE: Open Dashboard` | `Ctrl+Shift+F Ctrl+D` | View analytics dashboard |
| `FORGE: Update Copilot Context` | - | Manually refresh Copilot instructions |

## 📁 Project Structure

FORGE creates this structure in your workspace:

```
your-project/
├── .vscode/
│   └── copilot-instructions.md    # 🧠 Auto-generated AI context
├── .forge/
│   ├── config.yml                 # FORGE configuration
│   ├── prevention-rules.json      # Manual prevention rules
│   ├── metrics.json              # Task analytics
│   └── templates/                 # Task templates
└── tasks/
    ├── TASK_01_PROJECT_SETUP/
    │   ├── description.md         # What to build
    │   ├── completion.md          # What was built
    │   ├── difficulties.md       # Problems → Prevention rules
    │   └── artifacts/             # Generated code
    └── TASK_02_USER_AUTH/
        └── ...
```

## 🎯 How It Works

### 1. **Task Creation**
When you create a task, FORGE:
- Analyzes if it's atomic (≤3 hours)
- Suggests breaking down large tasks
- Applies relevant prevention rules from previous tasks
- Creates structured folder with templates

### 2. **Prevention Rule Extraction**
As you work, FORGE automatically:
- Watches `difficulties.md` files for new problems
- Extracts prevention rules in format: `❌ DON'T [problem] → [solution]`
- Categorizes rules by type and confidence
- Updates Copilot context in real-time

### 3. **Copilot Integration**
FORGE generates context like:
```markdown
# FORGE Framework Instructions for GitHub Copilot

## Prevention Rules (Auto-Generated)
❌ DON'T use datetime.utcnow() → use datetime.now(timezone.utc)
❌ DON'T skip input validation → always validate user inputs
❌ DON'T hardcode database URLs → use environment variables

## When user says "Create FORGE task [NAME]":
1. Analyze atomicity (≤3 hours)
2. Apply relevant prevention rules
3. Generate structured implementation
```

## 🔧 Configuration

Configure FORGE via VSCode settings:

```json
{
    "forge.autoUpdateCopilotContext": true,
    "forge.maxPreventionRules": 50,
    "forge.taskTimeEstimation": true,
    "forge.showNotifications": true
}
```

## 📊 Example Workflow

### Before FORGE 😤
```
You: "Create user authentication"
Copilot: *suggests basic code*
You: "Add validation, use bcrypt, handle errors..."
Copilot: *suggests improvements*
You: *Spends 2 hours fixing validation issues you've solved before*
```

### After FORGE 🎉
```
You: "Create FORGE task 'User authentication'"
Copilot: "Based on prevention rules from TASK_03:
- Using bcrypt for password hashing
- Input validation with joi schema
- JWT with proper expiry
- Rate limiting for login attempts
- Proper error handling without exposing details"
```

## 🌟 Benefits

### For Individual Developers
- **Stop Repeating Mistakes**: Prevention rules prevent the same errors
- **Faster Development**: AI suggestions get more relevant over time
- **Better Estimates**: Track actual vs estimated time accuracy
- **Improved Code Quality**: Accumulated best practices applied automatically

### For Teams
- **Shared Knowledge**: Export prevention rules to share with team
- **Consistent Patterns**: Everyone benefits from accumulated learnings
- **Onboarding**: New team members get context-aware AI assistance
- **Code Reviews**: Fewer issues caught in review process

## 🛠️ Advanced Features

### Custom Templates
Modify templates in `.forge/templates/` to match your workflow:
- `description.md` - Task structure template
- `completion.md` - Completion report template  
- `difficulties.md` - Problems documentation template

### Rule Categories
Prevention rules are automatically categorized:
- **Database** - SQL, migrations, performance
- **Security** - Authentication, validation, encryption
- **Performance** - Optimization, caching, memory
- **Testing** - Test patterns, mocking, coverage
- **Deployment** - CI/CD, configuration, infrastructure
- **Error Handling** - Exception patterns, logging
- **Configuration** - Environment variables, settings

### Export Options
Export your prevention rules for other AI assistants:
```bash
# Command Palette → "FORGE: Export Prevention Rules"
# Supports: JSON, Markdown, Claude format, ChatGPT format
```

## 🤝 Contributing

FORGE Framework is open source! Contribute by:

1. **Sharing Prevention Rules**: Submit common rules via GitHub
2. **Language Support**: Add templates for new programming languages
3. **Integrations**: Help integrate with other AI assistants
4. **Bug Reports**: Report issues and suggest improvements

## 📄 License

MIT License - Use freely in personal and commercial projects.

## 🚀 Get Started

Ready to transform your AI coding assistant?

1. Install the FORGE Framework extension
2. Initialize FORGE in your workspace
3. Create your first task
4. Watch Copilot get smarter with every mistake you document!

---

**Made with ❤️ for developers who want their AI to learn and grow**

[GitHub Repository](https://github.com/cecon/forge-framework) • [Documentation](https://github.com/cecon/forge-framework/wiki) • [Issues](https://github.com/cecon/forge-framework/issues)
