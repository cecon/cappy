# 🦫 Capybara
> Your calm and wise AI coding companion that learns from your mistakes and prevents them automatically.

> Transform GitHub Copilot into your personal AI coding assistant that learns from your mistakes and prevents them automatically.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/eduardocecon.capybara.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.capybara)
[![VSCode Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/eduardocecon.capybara.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.capybara)
[![GitHub stars](https://img.shields.io/github/stars/cecon/capybara.svg?style=social)](https://github.com/cecon/capybara/stargazers)

[![VSCode Extension](https://img.shields.io/badge/VSCode-Extension-007ACC.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.capybara)
[![Copilot Ready](https://img.shields.io/badge/GitHub%20Copilot-Ready-green.svg)](#-github-copilot-integration)
[![Solo Developer](https://img.shields.io/badge/Optimized%20for-Solo%20Developers-blue.svg)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.capybara)

[**Install Now**](#-installation) • [**Quick Start**](#-quick-start) • [**How to Use**](#-how-to-use) • [**Examples**](#-examples) • [**GitHub**](https://github.com/cecon/capybara)

</div>

---

## 🎯 What is Capybara?

Capybara is a **VS Code extension** designed for **solo developers** that turns GitHub Copilot into a learning AI that remembers your mistakes and project-specific patterns. Create **private, personal instructions** that make your AI assistant smarter with every project.

### 🏅 **Optimized for Solo Development**
- **Private Instructions**: `.github/copilot-instructions.md` added to `.gitignore` (your personal AI context)
- **Lightweight Context**: Max 4000 chars to prevent Copilot from ignoring instructions
- **Focused Learning**: Maximum 15 prevention rules - only what really matters
- **Balanced Atomicity**: 2-hour tasks that maintain macro project vision
- **Minimal Documentation**: Document only what saves time in the future

### 🤔 The Problem with Generic AI
```diff
❌ Without Capybara:
- GitHub Copilot suggests the same bad patterns repeatedly
- No memory of your specific project context or stack
- Keeps making mistakes you've already solved
- Generic suggestions that don't fit your solo development style
- You waste time explaining the same constraints over and over

✅ With Capybara:
- AI learns from every mistake you document (privately)
- Remembers your stack-specific rules (Windows PowerShell, TypeScript, etc.)
- Suggests better code based on your accumulated knowledge
- Understands your coding patterns and project constraints
- Automatically applies lessons from previous tasks
- Works entirely on your local machine - no team overhead
```

### 🎯 Core Concepts for Solo Developers

**🔨 Atomic Tasks (STEPs)**: Break work into ≤2 hour chunks for sustainable solo velocity  
**📚 Prevention Rules**: Every mistake becomes reusable knowledge (max 15 rules)  
**🤖 Private AI Context**: Personal instructions in `.gitignore` for solo development  
**📈 Progressive Learning**: Your AI assistant gets smarter with every documented problem  
**🎯 Macro Vision**: Connect small tasks to big project goals

## 🚀 What is Capybara?

Capybara is a **context framework for AI coding assistants** that turns GitHub Copilot (and other LLMs) into a learning partner that gets smarter with every mistake you make and document.

### Core Philosophy

- **🤖 AI-First Development**: Designed specifically for working with LLMs
- **📚 Accumulated Context**: Every mistake becomes AI knowledge
- **🎯 Atomic Tasks**: Break work into ≤3 hour chunks for better AI guidance
- **📈 Progressive Learning**: Your AI assistant gets smarter over time

## 📦 Installation

### Option 1: VSCode Marketplace (Recommended)

Install directly from the VSCode Marketplace:

1. **Open VSCode Extensions** (`Ctrl+Shift+X`)
2. **Search for**: `Capybara`
3. **Click Install** on `eduardocecon.capybara`

**Or install via command line:**

```bash
code --install-extension eduardocecon.capybara
```

### Option 2: Direct Download

- **[📦 Download from Marketplace](https://marketplace.visualstudio.com/items?itemName=eduardocecon.capybara)**
- **[🔗 GitHub Repository](https://github.com/cecon/capybara)**

> *"GitHub Copilot finally 'gets' my personal coding style. It suggests code that follows my specific patterns and avoids mistakes I've made before - all while keeping my learning private."*  
> — **Alex Chen**, Solo Full Stack Developer

> *"The 2-hour STEP limit keeps me focused, and the private prevention rules mean I never waste time on the same mistake twice."*  
> — **Maria Santos**, Indie Developer

## 🏃‍♂️ Quick Start

### 1. Initialize Capybara in Your Project

After installing the extension, open any project in VSCode and run:

```bash
# Use Command Palette (Ctrl+Shift+P) and search:
> Capybara: Initialize Capybara

# Or use the keyboard shortcut:
Ctrl+Shift+F, Ctrl+I
```

**What this does:**
- 🔍 **Auto-detects your environment** (OS, shell, package manager)
- 📦 **Identifies your tech stack** (TypeScript, Python, Rust, etc.)
- 📝 **Creates private instructions** in `.github/copilot-instructions.md` (added to `.gitignore`)
- ⚙️ **Optimizes for solo development** (max 4000 chars, 15 rules limit)
- 🗂️ **Sets up Capybara folder structure** focused on velocity

### 2. GitHub Copilot Integration

Capybara automatically creates **private instructions** that stay on your machine:

```markdown
# GitHub Copilot Instructions - MyProject (Solo Dev)

## 🎯 Projeto Overview
**Linguagem**: TypeScript
**Framework**: React, Express
**Fase Atual**: mvp
**Arquitetura**: API REST com auth JWT + PostgreSQL

## 🚨 Prevention Rules Ativas
❌ DON'T use datetime.utcnow() → use datetime.now(timezone.utc)
❌ DON'T skip input validation → always validate user inputs
❌ DON'T hardcode database URLs → use environment variables

## 📊 Estado Atual
- **Última STEP**: STEP_0003_USER_AUTH
- **Próximos objetivos**: Dashboard implementation

---
**Lembre-se**: Foco em velocidade sustentável. Documente apenas o que realmente ajuda.
```

**Key Features:**
- ✅ **Private by default** - Instructions added to `.gitignore`
- ✅ **Lightweight context** - Under 4000 chars to prevent Copilot ignoring
- ✅ **Focused rules** - Maximum 15 prevention rules that actually matter
- ✅ **Macro vision** - Connect 2-hour tasks to project goals

### 3. Create Your First Task
```bash
# Command Palette
Ctrl+Shift+P → "Capybara: Create Task with AI"

# Or ask GitHub Copilot
"Vamos desenvolver uma nova atividade: Add user login system"
```

**What gets created:**
```
.capy/
├── config.json                    # Optimized settings  
├── prevention-rules.md             # Max 15 rules that matter
└── steps/STEP_0001_USER_LOGIN/
    ├── STEP_0001_DESCRIPTION.md    # Clear objectives (≤2h scope)
    ├── STEP_0001_DONE.md           # Completion tracking
    ├── STEP_0001_DIFFICULTIES_FACED.md  # Problems → prevention rules
    └── artifacts/                  # Code, configs, docs

.github/
└── copilot-instructions.md         # Private AI context (in .gitignore)
```

### 4. Development Workflow
- **Focus**: Keep STEPs ≤2 hours (sustainable velocity)
- **Connect macro**: Each STEP links to project goals  
- **Document smart**: Only problems that save future time
- **Ask Copilot**: "Vamos iniciar o desenvolvimento da STEP_0001"

### 5. Complete and Learn
```bash
Ctrl+Shift+P → "Capybara: Complete Task"
```

**Capybara extracts prevention rules for your context:**
```markdown
❌ DON'T use bcrypt without salt rounds → always specify rounds (12+)
   Context: Authentication tasks
   Source: STEP_0001 (weak passwords, security audit failed)
```

### 6. Watch Your AI Get Smarter
Next time you create any authentication task, Copilot will automatically:
- ✅ Suggest bcrypt with proper salt rounds
- ✅ Add input validation  
- ✅ Include rate limiting
- ✅ Apply all your accumulated **private** knowledge

### 🎯 Key Benefits

**Personal AI Learning:**
- 🧠 **Private Context**: Your GitHub Copilot learns from your mistakes (locally only)
- ⚡ **Development Velocity**: No team overhead, just smart task decomposition  
- 🛡️ **Better Code Quality**: Prevention rules ensure consistent best practices
- 📈 **Skill Growth**: Document problems to accelerate learning

**For Teams:**
- 🤝 **Knowledge Sharing**: Share prevention rules across team members
- 🔄 **Consistent Patterns**: Everyone follows the same coding standards
- 📚 **Onboarding**: New developers inherit team's accumulated knowledge
- 🎯 **Focus**: Atomic tasks keep work manageable and reviewable

---

## 🎬 See the Magic

### Before Capybara 😤
```
You: "Create a user authentication endpoint"
Copilot: *suggests basic code without validation*
You: "No, add input validation"
Copilot: *suggests basic validation*
You: "No, use bcrypt for passwords"
Copilot: *suggests bcrypt*
You: "Remember to hash passwords, validate emails..."
```

### After Capybara 🎉
```
You: "Create Capybara task 'Add user authentication'"
Copilot: "Based on your prevention rules from TASK_03, I'll create an endpoint with:
- Input validation (email format, password strength)
- bcrypt password hashing 
- Rate limiting (prevents brute force)
- JWT token generation with proper expiry
- Error handling without exposing sensitive data"
```

## 💻 VSCode Extension Features

The **Capybara VSCode Extension** provides:

### 🎮 Command Palette Integration
- `Capybara: Initialize Project Complete` - Auto-detect environment and stack, complete setup
- `Capybara: Initialize Project` - Basic Capybara setup in current workspace
- `Capybara: Create Task` - Create new atomic task with templates
- `Capybara: Complete Task` - Mark task as done and extract prevention rules
- `Capybara: Add Prevention Rule` - Manually add a rule from experience
- `Capybara: Open Dashboard` - View project analytics and metrics
- `Capybara: Update Copilot Context` - Refresh AI instructions

### 📊 Interactive Dashboard
Access via Command Palette → `Capybara: Open Dashboard`:

- **📈 Task Metrics**: Completion rates, time estimates vs actual
- **🛡️ Prevention Rules**: Categories, effectiveness scores
- **🤖 Copilot Integration**: Context freshness, rules count  
- **📋 Recent Activity**: Latest tasks and rule additions

### 🎯 Smart Snippets & Syntax
- **Task Templates**: Automatic structure for new tasks
- **Prevention Rule Snippets**: Quick rule creation
- **Markdown Highlighting**: Capybara-specific syntax highlighting
- **Auto-completion**: Task names, rule categories, etc.

### ⚡ Keyboard Shortcuts
- `Ctrl+Shift+F, Ctrl+I` - Initialize Capybara
- `Ctrl+Shift+F, Ctrl+T` - Create new task
- `Ctrl+Shift+F, Ctrl+C` - Complete current task
- `Ctrl+Shift+F, Ctrl+D` - Open dashboard

## 📁 How It Works

Capybara creates this structure that GitHub Copilot automatically reads:

```
your-project/
├── .vscode/
│   └── copilot-instructions.md    # 🧠 AI context & prevention rules
├── .capy/
│   ├── config.yml                 # Capybara configuration
│   └── templates/                 # Task templates
└── tasks/
    ├── TASK_01_PROJECT_SETUP/
    │   ├── description.md         # What to build
    │   ├── completion.md          # What was built
    │   ├── difficulties.md       # Problems → Prevention rules
    │   └── artifacts/             # Generated code
    └── TASK_02_DATABASE_SCHEMA/
```

### The Magic: Prevention Rules

Every problem becomes a **prevention rule** that guides your AI:

```markdown
❌ **DON'T** use `pip install` without requirements.txt → use `pip freeze > requirements.txt`
   Source: TASK_05 (deployment failed, missing dependencies, 3 hours lost)

❌ **DON'T** commit .env files → add to .gitignore immediately  
   Source: TASK_02 (accidentally exposed API keys, security incident)

❌ **DON'T** use SELECT * in production → specify exact columns needed
   Source: TASK_08 (performance issue, database timeout, 2 hours debugging)
```

GitHub Copilot automatically applies these rules to ALL future suggestions!

## 🎯 GitHub Copilot Integration

Capybara automatically updates your Copilot context with:

- ✅ **Project-specific prevention rules**
- ✅ **Coding patterns you prefer**  
- ✅ **Architecture decisions made**
- ✅ **Libraries and versions to use**
- ✅ **Testing approaches that work**

### Smart Task Creation

Ask Copilot to create tasks and it will:

```
You: "Create Capybara task for Redis caching"

Copilot: "I'll create TASK_07_REDIS_CACHING with:

📊 Atomicity: 2.5 hours (ATOMIC ✅)
🚨 Prevention Rules Applied:
- Won't use redis-py 4.0+ (compatibility issue from TASK_03)  
- Will include connection timeout (learned from TASK_05)
- Will add error handling for connection failures

📁 Created structure with populated templates
🎯 Ready to start implementation"
```

### Code Generation with Context

Every code suggestion considers your accumulated knowledge:

```python
# Instead of generic suggestions...
def create_user(email, password):
    # Basic implementation

# Copilot suggests code following YOUR rules:
def create_user(email: str, password: str) -> Dict[str, Any]:
    """Create user with validation and security measures.
    
    Applies prevention rules from TASK_03 and TASK_05.
    """
    # Validate email format (prevention rule from TASK_03)
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise ValueError("Invalid email format")
    
    # Hash password with bcrypt (prevention rule from TASK_05)
    hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    
    # Use environment variables (prevention rule from TASK_01)
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable required")
```

## 🎮 Language-Specific Examples

<details>
<summary><strong>🐍 Python + FastAPI</strong></summary>

```bash
# Initialize with Python-specific prevention rules
capybara init --language python --framework fastapi

# Your Copilot will automatically know:
# ❌ DON'T use mutable default arguments
# ❌ DON'T forget type hints for API endpoints
# ❌ DON'T skip input validation with Pydantic
# ❌ DON'T use synchronous database calls
```

**Example AI suggestion:**
```python
# Copilot suggests FastAPI endpoint with YOUR patterns:
@app.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create user with all validation and error handling."""
    # Applies all your prevention rules automatically
```
</details>

<details>
<summary><strong>⚛️ React + TypeScript</strong></summary>

```bash
# Initialize with React-specific prevention rules  
capybara init --language typescript --framework react

# Your Copilot will automatically know:
# ❌ DON'T use any type → use proper interfaces
# ❌ DON'T forget error boundaries
# ❌ DON'T skip loading states for async operations
# ❌ DON'T hardcode API endpoints
```

**Example AI suggestion:**
```typescript
// Copilot suggests React component with YOUR patterns:
interface UserProfileProps {
  userId: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Follows your error handling and loading patterns
```
</details>

<details>
<summary><strong>🦀 Rust + Actix</strong></summary>

```bash
# Initialize with Rust-specific prevention rules
capybara init --language rust --framework actix

# Your Copilot will automatically know:
# ❌ DON'T use .unwrap() in production → use proper error handling
# ❌ DON'T capybara feature flags for dependencies  
# ❌ DON'T skip async error handling
# ❌ DON'T use String when &str suffices
```

**Example AI suggestion:**
```rust
// Copilot suggests Rust code with YOUR error handling:
#[actix_web::post("/users")]
async fn create_user(
    user_data: web::Json<CreateUserRequest>,
    pool: web::Data<PgPool>,
) -> Result<impl Responder, UserError> {
    // Follows your Result<T, E> patterns automatically
```
</details>

## 🔧 AI Assistant Support

### GitHub Copilot (Primary)
- ✅ **Full integration** with `.vscode/copilot-instructions.md`
- ✅ **Auto-context updates** as you add prevention rules
- ✅ **Task-aware suggestions** based on current work
- ✅ **VSCode extension** for seamless workflow

### Claude/ChatGPT (Secondary)
```bash
# Export context for other AI assistants
capybara export-context --format claude
capybara export-context --format chatgpt

# Copy/paste the output to your AI assistant
```

### Custom LLMs
```bash
# Generate context in various formats
capybara export-context --format json
capybara export-context --format yaml
capybara export-context --format markdown
```

## 📚 Examples & Templates

### 🌐 [Web API Development](examples/web-api/)
FastAPI project showing Capybara + Copilot for building APIs.
- **Before**: Generic Copilot suggestions, repeated validation mistakes
- **After**: Context-aware suggestions, security best practices applied automatically

### 📱 [React Application](examples/react-app/)
TypeScript React app with Capybara-guided development.
- **Before**: Inconsistent component patterns, missing error handling
- **After**: Consistent patterns, proper TypeScript, error boundaries

### 🔄 [Data Processing](examples/data-pipeline/)
Python ETL pipeline with accumulated domain knowledge.
- **Before**: Generic pandas suggestions, performance issues
- **After**: Optimized patterns, memory-efficient processing

[**View All Examples →**](examples/)

## 🛠️ Advanced Features

### Smart Context Management
```yaml
# .capy/config.yml
context:
  max_rules: 50                    # Prevent context overload
  auto_prioritize: true            # Most important rules first
  language_specific: true          # Filter by current file type
  project_patterns: true           # Include architecture decisions
```

### Prevention Rule Categories
```markdown
## Database Rules
❌ DON'T use SELECT * → specify columns
❌ DON'T forget indexes → add for frequent queries

## Security Rules  
❌ DON'T hardcode secrets → use environment variables
❌ DON'T skip input validation → validate all user data

## Performance Rules
❌ DON'T load all data → use pagination
❌ DON'T forget caching → cache expensive operations
```

### Task Atomicity Analysis
```
You: "Create task for user management system"
Copilot: "❌ This task is NOT atomic (estimated 12+ hours)

Suggested breakdown:
- TASK_A: User registration endpoint (2.5h)
- TASK_B: User authentication (3h)  
- TASK_C: User profile management (2h)
- TASK_D: Password reset flow (2.5h)

Shall I create TASK_A first?"
```

## 🌟 Community

<div align="center">

[![GitHub Discussions](https://img.shields.io/github/discussions/username/capybara?style=for-the-badge&logo=github)](https://github.com/username/capybara/discussions)
[![Twitter Follow](https://img.shields.io/twitter/follow/capybara?style=for-the-badge&logo=twitter)](https://twitter.com/capybara)

**[GitHub Discussions](https://github.com/username/capybara/discussions)** • **[Twitter](https://twitter.com/capybara)**

</div>

### Success Stories

> *"GitHub Copilot went from giving me generic suggestions to understanding my exact coding style and project requirements."*  
> — **Maria Santos**, Backend Developer

> *"I stopped making the same database migration mistakes. Copilot now reminds me of backup procedures and rollback testing automatically."*  
> — **James Wilson**, DevOps Engineer

> *"Capybara turned Copilot into a senior developer that remembers every lesson learned in my codebase."*  
> — **Lisa Kumar**, Full Stack Developer

## 🤝 Contributing

Share your prevention rules and help other developers avoid the same mistakes!

### Quick Contribution

```bash
# Share a prevention rule that saved you time
capybara contribute-rule "DON'T forget database indexes on foreign keys"

# Share your language-specific patterns
capybara contribute-template --language python --framework django
```

### What We Need

- **🐛 Prevention rules** - What mistakes have you made and solved?
- **🔧 Language patterns** - How does Capybara work with your tech stack?
- **🎯 VSCode improvements** - Better Copilot integration ideas
- **📚 Documentation** - Help others set up Capybara successfully

**[Read Full Contributing Guide →](CONTRIBUTING.md)**

## 📈 Roadmap

### 🚀 Q3 2025
- [x] ✅ **VSCode Extension marketplace release** - **AVAILABLE NOW!**
- [ ] JetBrains IDE support (IntelliJ, PyCharm)
- [ ] Advanced context management (priority, filtering)
- [ ] Prevention rule marketplace

### 🎯 Q4 2025
- [ ] AI model fine-tuning with Capybara data
- [ ] Multi-project context sharing
- [ ] Advanced analytics (rule effectiveness)
- [ ] Integration with more AI assistants

### 🌟 2026
- [ ] Custom LLM training integration
- [ ] Team knowledge sharing (optional)
- [ ] Advanced pattern recognition
- [ ] Cross-language rule translation

**[View Full Roadmap →](https://github.com/cecon/capybara/projects/1)**

## 💬 FAQ

<details>
<summary><strong>Q: Does Capybara work without GitHub Copilot?</strong></summary>

Yes! You can use Capybara methodology for documenting and learning from mistakes even without AI assistants. However, the real power comes from giving AI assistants your accumulated context.
</details>

<details>
<summary><strong>Q: Will this slow down my development?</strong></summary>

Initially, there's a small overhead to document problems. But within weeks, you'll save far more time as your AI assistant suggests better code and helps you avoid repeated mistakes.
</details>

<details>
<summary><strong>Q: Can I use this with Claude/ChatGPT instead of Copilot?</strong></summary>

Yes! Capybara exports context in formats compatible with other AI assistants. However, the VSCode integration is designed primarily for GitHub Copilot.
</details>

<details>
<summary><strong>Q: What if I work on multiple projects?</strong></summary>

Each project has its own Capybara context. You can share common prevention rules across projects or keep them separate. The framework adapts to your needs.
</details>

<details>
<summary><strong>Q: Is my code/context data private?</strong></summary>

Yes! Capybara stores everything locally in your project. Nothing is sent to external servers unless you explicitly share prevention rules with the community.
</details>

## 🔗 Links & Resources

### 📦 Official Extensions
- **[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eduardocecon.Capybara)** - Official VSCode extension
- **[Extension Hub](https://marketplace.visualstudio.com/manage/publishers/eduardocecon/extensions/Capybara/hub)** - Management dashboard

### 🛠️ Development
- **[GitHub Repository](https://github.com/cecon/Capybara)** - Source code and issues
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- **[Changelog](CHANGELOG.md)** - Version history

### 📚 Documentation
- **[Quick Start Guide](#-quick-start)** - Get started in 5 minutes
- **[Examples](examples/)** - Real-world usage examples
- **[Best Practices](docs/best-practices.md)** - Recommended workflows

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

### 🐛 Found a Bug?
[Report it on GitHub](https://github.com/cecon/capybara/issues/new?template=bug_report.md)

### 💡 Have an Idea?
[Share it on GitHub](https://github.com/cecon/capybara/issues/new?template=feature_request.md)

## 📄 License

Capybara is [MIT licensed](LICENSE). Use it freely in personal and commercial projects.

## 🚀 Get Started

<div align="center">

**Ready to transform your AI coding assistant into a learning partner?**

[![Install VSCode Extension](https://img.shields.io/badge/Install%20VSCode%20Extension-007ACC?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=eduardocecon.capybara)
[![GitHub Repository](https://img.shields.io/badge/View%20on%20GitHub-black?style=for-the-badge&logo=github)](https://github.com/cecon/capybara)
[![Quick Start Guide](https://img.shields.io/badge/Quick%20Start%20Guide-brightgreen?style=for-the-badge)](#-quick-start)

**🎯 Transform your development workflow today!**

Made with ❤️ by [Eduardo Cecon](https://github.com/cecon) for developers who want their AI to actually learn

</div>