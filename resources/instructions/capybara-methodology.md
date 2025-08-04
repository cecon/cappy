# Capybara Methodology - Focused Development Workflow

## 🎯 **Capybara Core Principles - REVISED**

### **Single-Focus Workflow:**
- **ONE ACTIVE TASK** at a time for maximum f🔄 **Próximo Step:**
- 📋 STEP_1722873720: Configure Supabase client initialization
  - Critérios: Client properly initialized, connection tested
  - Arquivos: src/lib/supabase.ts

🎯 **Para continuar**: Começar implementação do STEP_1722873720 ou marcar step como concluído alterando `completed="true"` no XML.nd productivity
- Tasks defined in structured XML format for consistency and automation
- Automatic task detection from natural language requests
- Progressive accumulation of prevention rules to avoid repeated mistakes
- Atomic task decomposition to ensure manageable work units

### **Task States & Storage:**
- **em-andamento**: Currently being worked on (only one at a time)
- **pausada**: Created but temporarily paused (can have multiple)
- **concluida**: Completed and moved to history for knowledge preservation

### **File Structure:**
```
.capy/
├── config.json                    # Project configuration
├── prevention-rules.md            # Accumulated prevention rules
├── instructions/                   # LLM instruction files
│   └── capybara-task-file-structure-info.md
├── tasks/                          # Active and paused tasks (XML format)
│   ├── task-auth-supabase.xml
│   ├── task-dashboard-admin.xml
│   └── ...
└── history/                        # Completed tasks archive
    ├── completed-task-001.xml
    ├── completed-task-002.xml
    └── ...
```

## � **Two Main Workflows:**

### **A) Natural Language Task Creation**
When user says expressions like:
- "vamos adicionar a auth do supabase nesse projeto"
- "preciso implementar um dashboard administrativo" 
- "criar um sistema de login"

**LLM automatically:**
1. **Detects task creation intent** from natural language
2. **Checks for active tasks** in `.capy/tasks/` directory
3. **Asks for confirmation** if there's an active task to pause
4. **Reads XML generation instructions** from `.capy/instructions/`
5. **Creates structured XML task** with proper steps and validation
6. **Saves to `.capy/tasks/`** with unique identifier

### **B) Task Execution & Management**  
When user wants to work on a task:
1. **Shows current task status** and progress
2. **Guides through next steps** based on XML structure
3. **Updates completion status** as steps are finished
4. **Accumulates prevention rules** from any issues encountered
5. **Moves to history** when task is completed

## 📋 **XML Task Structure (Enforced by LLM)**

Every task follows this strict structure with Unix timestamp-based step IDs:
```xml
<task id="unique-task-id" version="1.0">
    <metadata>
        <title>Clear, descriptive title</title>
        <description>Detailed description of what will be built</description>
        <status>em-andamento|pausada|concluida</status>
        <progress>0/N</progress>
    </metadata>
    
    <context>
        <area>frontend|backend|fullstack|devops</area>
        <technology main="main-tech" version="min-version"/>
        <dependencies>
            <lib>library-name</lib>
        </dependencies>
        <files>
            <file type="creation|modification" required="true">path/to/file</file>
        </files>
    </context>
    
    <steps>
        <step id="STEP_[UNIX_TIMESTAMP]" order="1" completed="false" required="true">
            <title>What will be accomplished</title>
            <description>Detailed work description</description>
            <criteria>
                <criterion>Specific, measurable requirement</criterion>
            </criteria>
            <files>
                <file type="creation" required="true">specific-file-path</file>
            </files>
        </step>
    </steps>
    
    <validation>
        <checklist>
            <item>All required steps completed</item>
            <item>All required files created</item>
            <item>Code compiles without errors</item>
            <item>No linting warnings</item>
        </checklist>
    </validation>
</task>
```

### **Hybrid Naming Convention**
**Task Files**: `STEP_[UNIX_TIMESTAMP]_[title].xml` - for chronological ordering of tasks
**Internal Step IDs**: `step001`, `step002`, `step003` - for simplicity within each task

- **File level**: Unix timestamps provide automatic chronological ordering
- **Step level**: Sequential numbers provide readability and simplicity
- **Best of both**: Global ordering + local simplicity

## ⚛️ **Atomicity Principle - Always Applied**

**Every task MUST be atomic** - completable in 1-3 hours with a single, clear objective.

### **Automatic Atomicity Analysis:**
The LLM performs this analysis when creating any task:

```
✅ ATOMIC EXAMPLES:
- "Create JWT middleware for token validation"
- "Implement user registration endpoint" 
- "Setup Supabase authentication configuration"
- "Create responsive login form component"

❌ NON-ATOMIC EXAMPLES (need decomposition):
- "Implement complete authentication system" 
  → Break into: middleware + endpoints + database + testing
- "Build admin dashboard"
  → Break into: layout + components + data_fetching + permissions
```

### **Decomposition Patterns:**
- **Authentication**: config → middleware → endpoints → integration → testing
- **API Development**: schema → validation → endpoints → error_handling → testing  
- **Database**: schema → migrations → repositories → queries → testing
- **Frontend**: layout → components → styling → state → integration

**If task is NOT atomic → LLM MUST decompose before creating XML**

## 🤖 **LLM Response Patterns**

### **Pattern A: Task Creation Detection** 
User: *"vamos adicionar auth do supabase nesse projeto"*

```
🔍 Detectando criação de tarefa...

⚠️ Verificando tarefas ativas...
[Se encontrar task ativa]: Existe uma tarefa ativa: "Setup Dashboard Components". 
Deseja pausar esta tarefa para iniciar uma nova? (Digite 'sim' para pausar ou 'não' para continuar a tarefa atual)

[Se não houver task ativa ou usuário confirmar]:
📋 Analisando atomicidade da tarefa "Adicionar auth do Supabase"...

⚛️ ANÁLISE DE ATOMICIDADE:
- Tarefa: "Setup Supabase authentication configuration"
- Estimativa: 2 horas  
- Escopo: Configuração inicial + provider setup
- Status: ✅ ATÔMICA (prosseguindo)

📖 Lendo instruções de estrutura XML...
✅ Gerando tarefa estruturada...

🎯 Nova tarefa criada: "Setup Supabase Authentication"
📁 Arquivo: .capy/tasks/task-auth-supabase.xml
💡 Use 'Capybara: Current Task' para ver detalhes e próximos passos.
```

### **Pattern B: Task Progress Check**
User: *"qual o status da tarefa atual?"*

```
� STATUS DA TAREFA ATUAL:

🎯 **Tarefa**: Setup Supabase Authentication
📈 **Progresso**: 2/5 steps concluídos (40%)
⏱️ **Estimativa restante**: 1.2 horas

✅ **Steps Concluídos:**
- ✅ STEP_1722873600: Install Supabase dependencies
- ✅ STEP_1722873660: Create environment configuration

� **Próximo Step:**
- 📋 step003: Configure Supabase client initialization
  - Critérios: Client properly initialized, connection tested
  - Arquivos: src/lib/supabase.ts

🎯 **Para continuar**: Começar implementação do step003 ou marcar step como concluído alterando `concluido="true"` no XML.
```

## 🔄 **Task Execution Workflow**

### **Step-by-Step Execution:**
1. **Read current task XML** from `.capy/tasks/`
2. **Show task overview** and current progress
3. **Guide through next step** with specific criteria
4. **Implement incrementally** following the defined steps
5. **Test after each step** to ensure quality
6. **Update step completion** in XML file
7. **Accumulate prevention rules** if issues are encountered
8. **Move to history** when all steps completed

### **Prevention Rules Accumulation:**
- **During task execution**: Document any problems in `.capy/prevention-rules.md`
- **Pattern recognition**: Group similar issues into prevention rules
- **Context-aware**: Apply relevant rules to new tasks automatically
- **Progressive improvement**: Each task benefits from all previous learnings

### **Task Completion Process:**
1. **Verify all steps completed** (`concluido="true"` for all required steps)
2. **Run final validation checklist** from XML
3. **Update task status** to `concluida`
4. **Move XML file** from `.capy/tasks/` to `.capy/history/`
5. **Update prevention rules** with any new patterns discovered
6. **Clear active task context** - ready for next task

## 🚨 **Error Handling & Learning**

### **When Problems Occur:**
1. **STOP** - Don't push through errors blindly
2. **ANALYZE** - Understand the root cause
3. **DOCUMENT** - Add specific prevention rule
4. **SOLVE** - Fix methodically with proper testing
5. **PREVENT** - Ensure rule prevents future occurrences

### **Prevention Rule Examples:**
```markdown
### [SUPABASE] Environment Configuration
**Context:** Setting up Supabase authentication  
**Problem:** Forgetting to add SUPABASE_URL to environment variables  
**Solution:** Always verify all required env vars before proceeding  
**Prevention:** Check .env.example vs .env.local for missing variables

### [REACT] Component State Management  
**Context:** Creating form components with validation  
**Problem:** Using useState for complex form state leads to sync issues  
**Solution:** Use useReducer or form libraries for complex forms  
**Prevention:** If form has >3 fields or complex validation, use react-hook-form
```

## 🎯 **Key Benefits of This Methodology:**

1. **🎯 Focus**: One atomic task at a time prevents context switching
2. **📋 Structure**: XML format ensures consistent task definition
3. **🤖 Automation**: Natural language detection makes task creation seamless
4. **📚 Learning**: Prevention rules accumulate knowledge automatically
5. **🔄 Iteration**: Each task builds on previous learnings
6. **⚛️ Atomicity**: Small, manageable tasks reduce overwhelm and errors
7. **📈 Progress**: Clear step tracking shows measurable advancement

**Result: Faster development with fewer repeated mistakes!** 🚀
