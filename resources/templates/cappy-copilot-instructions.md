<!-- CAPPY INI -->

# CAPPY — Command Manual v2.0 (Context Orchestration)

## Absolute Prohibitions
- **Never** attempt to run Cappy commands in terminal or access external domains/directories
- **Never** read any files other than `.cappy/output.txt` for command results
- `.cappy/output.txt` is **the single source of truth** for command outputs
  - If file **doesn't exist** or is **empty**, **stop immediately** and respond in **1 line**:
    `No output in .cappy/output.txt. Re-execute in VS Code.`

---

## Objective
Standardize how LLM and developer interact with CAPPY 2.0 for:
- Creating/managing **atomic tasks** with **automatic context orchestration**
- **Context discovery**: automatic search for docs, prevention rules and related tasks  
- Recording progress following **CAPPY Task XSD 1.0 schema**
- Applying **prevention rules** automatically by category

**Expected output in `output.txt`:**  
- Plain text (e.g., `"ok"`, version number etc.)
- Or XML according to command contract

---

## Golden Rules
1. **Command priority** — messages starting with `cappy:` have maximum priority
2. **Single source of truth** — after executing command, **read exclusively** `.cappy/output.txt`
3. **Context-first** — every task is born with automatically discovered context
4. **XSD compliance** — tasks follow namespace `https://cappy-methodology.dev/task/1.0`
5. **Smart atomicity** — maximum 5 main steps per task

---

## Natural Command Interpretation
Users can express commands naturally. The LLM should interpret and map to appropriate `cappy:` commands:

**Task Management:**
- "new task" / "create task" / "nova tarefa" → `cappy:new`
- "current task" / "active task" / "tarefa ativa" → `cappy:taskstatus`
- "work on task" / "continue" / "trabalhar na tarefa" → `cappy:workcurrent`
- "complete task" / "finish" / "concluir tarefa" → `cappy:taskcomplete`

**Project Setup:**
- "setup cappy" / "initialize" / "inicializar" → `cappy:init`
- "analyze project" / "know stack" / "analisar projeto" → `cappy:knowstack`

**Information:**
- "cappy version" / "version" / "versão" → `cappy:version`

**Always confirm interpretation:** "Interpreting as `cappy:new` - creating new task with context discovery"

---

## Estrutura de Arquivos
```
.cappy/
 ├─ tasks/                  # Tasks ativas (.ACTIVE.xml)
 ├─ history/                # Tasks concluídas  
 ├─ config.yaml             # Configuração do Cappy
 ├─ stack.md                # KnowStack do projeto
 ├─ output.txt              # Resultado do último comando (fonte única)
 └─ index/                  # Context orchestration
     ├─ tasks.json          # Índice de tasks por contexto
     ├─ prevention.json     # Índice de prevention rules
     └─ context.json        # Mapeamento de relacionamentos
docs/
 ├─ components/             # Documentação de componentes
 ├─ prevention/             # Prevention rules categorizadas
 └─ index/                  # Índices para busca
```

**Nomes de arquivo**: `TASK_YYYYMMDDHHMMSS.{STATUS}.xml`
**Estados**: `pending → in_progress → completed`
**Namespace obrigatório**: `xmlns="https://cappy-methodology.dev/task/1.0"`

---

## Fluxo CAPPY 2.0
1. `cappy.init` → estrutura base + índices de contexto
2. `cappy.knowstack` → analisa workspace e gera stack.md  
3. `cappy.new` → context discovery + template XSD
4. **Context orchestration automática** (docs, rules, tasks relacionadas)
5. `cappy.createTaskFile` → cria XML com contexto injetado
6. `cappy.workOnCurrentTask` → executa seguindo roteiro da task
7. `cappy.completeTask` → finaliza e atualiza índices

---

## Convenções de Saída XSD

### `getActiveTask` — **sempre XML**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task-status>
  <active>true|false</active>
  <file-path>.../TASK_...ACTIVE.xml</file-path>
  <task-id>TASK_...</task-id>
  <category>auth|database|api|ui|...</category>
  <status>pending|in_progress|completed</status>
  <last-modified>ISO-8601</last-modified>
</task-status>
```

### `createTaskFile` — **XML com contexto**
```xml
<create-task>
  <file-path>.../TASK_...ACTIVE.xml</file-path>
  <id>TASK_...</id>
  <category>auth|database|api|...</category>
  <context-discovered>
    <docs-found>3</docs-found>
    <rules-found>2</rules-found>
    <related-tasks>1</related-tasks>
  </context-discovered>
</create-task>
```

### `new` — **Template XSD + Context**
```xml
<new>
  <template>...XML com namespace XSD...</template>
  <context-preview>
    <docs-available>5</docs-available>
    <rules-applicable>3</rules-applicable>
    <similar-tasks>2</similar-tasks>
  </context-preview>
</new>
```

---

## CAPPY 2.0 Commands

### 1) `cappy.init` — Initialize CAPPY 2.0
- **Natural commands:** "setup cappy", "initialize", "inicializar"
- **Action:** creates base structure + context indices
- **Expected effects:** 
  - Creates `.cappy/` with subfolders
  - Initializes `docs/index/` for context discovery
  - Creates empty indices (tasks.json, prevention.json, context.json)
- **Expected output:**
  ```xml
  <init>
    <ok>true</ok>
    <created>tasks,history,stack.md,config.yaml,docs,index</created>
    <context-system>initialized</context-system>
  </init>
  ```
- **Response:** `CAPPY 2.0 initialized. Context system active. Next: analyze project structure`

### 2) `cappy.knowstack` — KnowStack + Context Mapping
- **Natural commands:** "analyze project", "know stack", "analisar projeto"
- **Action:** analyzes workspace, generates stack.md and maps initial context
- **New behavior:** 
  - Identifies components and their relationships
  - Maps architecture for context discovery
  - Suggests probable task categories
- **Expected output:**
  ```xml
  <knowstack>
    <stack-file>.cappy/stack.md</stack-file>
    <context-mapping>
      <components>5</components>
      <categories-identified>auth,database,api</categories-identified>
    </context-mapping>
  </knowstack>
  ```
- **Response:** `Project analysis complete. System understands your architecture and tech stack`

### 3) `cappy.new` — New Task with Context Discovery
- **Natural commands:** "new task", "create task", "nova tarefa"
- **Action:** **automatic context discovery** + XSD template
- **New workflow:**
  1. User describes need in natural language
  2. **System automatically searches** for related docs, rules and tasks
  3. **Infers category** based on description  
  4. Returns XSD template with context pre-injected
- **Context discovery includes:**
  - Semantic search in docs by keywords
  - Prevention rules by inferred category
  - Similar tasks by context similarity
  - Dependencies from stack.md
- **Expected output:** complete XSD template with populated `<context>` section
- **Response:** `Context discovery complete. Found [X] docs, [Y] rules, [Z] related tasks`

### 4) `cappy.createTaskFile` — Create with XSD + Context Injection
- **Natural commands:** "create the task file", "generate task"
- **Action:** creates XML following XSD schema with injected context
- **New behavior:**
  1. Validates mandatory XSD namespace
  2. Injects automatically discovered context
  3. Applies prevention rules by category
  4. Creates `context → execution → completion` structure
  5. Updates indices for future queries
- **LLM should fill:**
  - `<context>` comes pre-populated from discovery
  - `<execution><step>` with clear validation criteria
  - Unique IDs and mapped relationships
- **Response:** `XSD task created with rich context. [X] prevention rules applied automatically`

### 5) `cappy.getActiveTask` — Status with Context Info
- **Natural commands:** "current task", "active task", "tarefa ativa", "task status"
- **Output includes:** category, context summary, active prevention rules
- **Response (active):** `Active task: [category] with [X] prevention rules. Next step: [description]`
- **Response (inactive):** `No active task. Use 'new task' for automatic context discovery`

### 6) `cappy.workOnCurrentTask` — Context-Aware Execution
- **Natural commands:** "work on task", "continue", "trabalhar na tarefa"
- **New behavior:**
  1. Reads current XSD task
  2. Consults applicable prevention rules in context
  3. Checks related docs before executing
  4. Applies validations based on context history
  5. Updates context effectiveness metrics
- **Output includes:** consulted context, applied rules, next substep
- **Response:** `Executing with context awareness. [X] prevention rules verified, next: [substep]`

### 7) `cappy.completeTask` — Complete + Learning Capture
- **Natural commands:** "complete task", "finish", "concluir tarefa"
- **New behavior:**
  1. Validates XSD completion criteria
  2. **Captures learnings** for prevention rules
  3. Updates context effectiveness indices  
  4. Suggests new prevention rules if needed
  5. Records timing and context quality metrics
- **Output includes:** learnings captured, context metrics, new rules suggested
- **Response:** `Task completed. [X] learnings captured, [Y] context metrics updated`

### 8) `cappy.version` — Get Version
- **Natural commands:** "cappy version", "version", "versão"
- **Action:** writes extension version to `output.txt`
- **Expected output:** plain text (e.g., `2.5.13`)
- **Response:** `CAPPY v{version} with Context Orchestration`

---

## Context Orchestration Automática

### Context Discovery Pipeline
1. **Keyword extraction** da descrição da task
2. **Semantic search** em docs por relevância
3. **Category inference** baseada em patterns
4. **Prevention rules** aplicáveis por categoria  
5. **Related tasks** por similarity de contexto
6. **Dependencies** extraídas do stack.md

### Category Inference Rules
- Menciona "auth", "login", "jwt" → `category="auth"`
- Menciona "database", "sql", "migration" → `category="database"`  
- Menciona "api", "endpoint", "route" → `category="api"`
- Menciona "component", "ui", "frontend" → `category="ui"`
- Menciona "test", "spec", "coverage" → `category="testing"`
- Menciona "bug", "fix", "error" → `category="bugfix"`
- Default fallback → `category="feature"`

### Prevention Rules Auto-Application
- **Critical severity**: Aplicadas automaticamente
- **High severity**: Aplicadas automaticamente  
- **Medium/Low**: Sugeridas na validation checklist
- **Context-specific**: Apenas para categoria matching

---

## Estrutura XSD da Task

### Exemplo de Task Completa
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task id="auth-jwt-validation" 
      category="auth" 
      priority="normal" 
      status="pending"
      created="2025-01-15T10:30:00Z"
      xmlns="https://cappy-methodology.dev/task/1.0">
      
    <context discovery_timestamp="2025-01-15T10:30:00Z">
        <description>JWT token validation context</description>
        <keywords>
            <keyword>auth</keyword>
            <keyword>jwt</keyword>
            <keyword>validation</keyword>
        </keywords>
        <docs_refs>
            <doc path="docs/auth/jwt-patterns.md" relevance="high">JWT validation patterns</doc>
            <doc path="docs/auth/middleware.md" relevance="medium">Auth middleware setup</doc>
        </docs_refs>
        <prevention_rules>
            <rule id="jwt-null-check" category="auth" severity="high" auto_apply="true">
                Always validate JWT token existence before decode
            </rule>
            <rule id="error-handling-auth" category="auth" severity="medium" auto_apply="true">
                Implement proper error responses for auth failures
            </rule>
        </prevention_rules>
        <related_tasks>
            <task id="auth-login-flow" relationship="relates-to" impact="medium"/>
        </related_tasks>
        <dependencies>
            <dependency type="library" critical="false">jsonwebtoken</dependency>
            <dependency type="service" critical="true">auth-service</dependency>
        </dependencies>
    </context>
    
    <execution estimated_duration="PT45M">
        <step id="implement-validation" validation="JWT validation handles all edge cases" atomic="true">
            <description>Implement robust JWT token validation</description>
            <!-- LLM decompõe em substeps conforme necessário -->
        </step>
    </execution>
    
    <!-- completion preenchida apenas após execução -->
    <completion>
        <validation_checklist>
            <item checked="false" critical="true">JWT null/undefined scenarios handled</item>
            <item checked="false" critical="true">Invalid token scenarios return proper errors</item>
            <item checked="false" critical="false">Tests cover edge cases</item>
        </validation_checklist>
        
        <knowledge_capture>
            <new_learnings>
                <learning>JWT library requires explicit null checks</learning>
                <learning>Error messages should not expose token details</learning>
            </new_learnings>
            
            <new_prevention_rules>
                <rule category="auth" severity="medium">
                    JWT error messages must not expose sensitive token data
                </rule>
            </new_prevention_rules>
        </knowledge_capture>
        
        <metrics>
            <metric name="context_hit_rate" value="0.85" unit="ratio" category="context"/>
            <metric name="prevention_rules_applied" value="2" unit="count" category="prevention"/>
            <metric name="actual_duration_minutes" value="38" unit="minutes" category="timing"/>
        </metrics>
    </completion>
</task>
```

---

## Validações XSD Obrigatórias
1. **Namespace**: `xmlns="https://cappy-methodology.dev/task/1.0"` obrigatório
2. **Category**: deve estar no enum (auth, database, api, ui, testing, etc.)
3. **Atomicidade**: máximo 5 steps principais; se exceder, decomponha
4. **Context section**: deve estar presente e populada
5. **ISO 8601 timestamps**: para created, discovery_timestamp, etc.
6. **Validation criteria**: cada step deve ter critério mensurável

---

## Response Templates CAPPY 2.0
- **new** → `Context discovery complete: found [X] docs, [Y] rules. XSD template ready`
- **createtaskfile** → `XSD task created: [ID] category [cat]. Rich context injected automatically`  
- **taskstatus (active)** → `Active [category] task. [X] prevention rules applied. Next: [step]`
- **taskstatus (inactive)** → `No active task. Use 'new task' for context discovery`
- **workcurrent** → `Executing context-aware: [step]. [X] rules verified`
- **taskcomplete** → `Task completed. [X] learnings captured, context metrics updated`
- **generic error** → `No output in .cappy/output.txt. Re-execute in VS Code`

---

## Migration Notes
**Legacy tasks**: Continue working but without context orchestration
**New commands**: Always use XSD + context discovery  
**Prevention rules**: Migrated to docs/prevention/ with categorization
**Indices**: Built automatically from existing tasks

CAPPY 2.0 transforms development from reactive to intelligent - every task contributes to a smarter system.

<!-- CAPPY END -->