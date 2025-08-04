# 🔨 Capybara - Instruções para GitHub Copilot

## 📋 **CONTEXTO DO PROJETO**
- **Projeto**: forge-framework
- **Tipo**: node-app
- **Linguagem Principal**: javascript,typescript
- **Frameworks**: Nenhum detectado

## 🎯 **METODOLOGIA Capybara**
Este projeto usa a metodologia Capybara (Focus, Organize, Record, Grow, Evolve) para desenvolvimento solo:

### **Princípios:**
1. **Tarefas Atômicas**: Máximo 2-3 horas por STEP
2. **XML estruturado**: Tasks definidas em arquivo XML único
3. **Aprendizado Contínuo**: Cada erro vira uma prevention rule
4. **Contexto Preservado**: AI sempre informada do estado atual
5. **Documentação Mínima**: Só o essencial que economiza tempo

### **Prevention Rules Ativas:**
*As regras serão carregadas automaticamente do arquivo .capy/prevention-rules.md*

## 🛠️ **INSTRUÇÕES ESPECÍFICAS**

### **Para este projeto:**
- Sempre verificar prevention rules antes de sugerir código
- Trabalhar com tasks em formato XML (task.xml)
- Focar em soluções simples e diretas
- Documentar problemas encontrados para criar novas rules

### **⚠️ Estado Atual da Extensão:**
- **Inicialização**: Totalmente funcional
- **Criação de Tasks**: XML estruturado com steps, critérios e validação
- **Gestão de Progress**: Tracking de conclusão por step
- **Outros comandos**: Majoritariamente placeholders (mostram "Coming soon!")
- **Foco**: Desenvolvimento incremental com metodologia Capybara

### **🎯 Workflow Recomendado:**
1. Use `Capybara: Initialize` para configurar novo projeto
2. Use `Capybara: Create New Task` para criar tasks estruturadas em XML
3. Edite o task.xml para definir steps específicos do projeto
4. Marque steps como concluídos alterando `concluido="true"`
5. Para outras funcionalidades, aguarde implementação ou contribua!

### **📄 Estrutura XML das Tasks:**

```xml
<task id="task-id" versao="1.0">
    <metadados>
        <titulo>Título da Task</titulo>
        <descricao>Descrição detalhada</descricao>
        <status>em-andamento|pausada|concluida</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="React" versao="18+"/>
        <dependencias>
            <lib>biblioteca-exemplo</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Nome do Step</titulo>
            <descricao>O que fazer neste step</descricao>
            <criterios>
                <criterio>Critério 1</criterio>
                <criterio>Critério 2</criterio>
            </criterios>
            <entrega>Arquivo.jsx</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>Todos os steps obrigatórios concluídos</item>
        </checklist>
    </validacao>
</task>
```

### **Comandos Capybara disponíveis:**

#### **✅ Comandos Funcionais:**
- `Capybara: Initialize` - Inicializar Capybara no workspace
- `Capybara: Create New Task` - Criar nova tarefa em XML estruturado
- `Capybara: Current Task` - Ver tarefa atual (com validação)
- `Capybara: Test Capybara Extension` - Testar se extensão está funcionando

#### **🚧 Comandos em Desenvolvimento:**
- `Capybara: Manage All Tasks` - Gerenciar todas as tarefas (em breve)
- `Capybara: Pause Current Task` - Pausar tarefa atual (em breve)
- `Capybara: Complete Task` - Completar e mover para histórico (em breve)
- `Capybara: Update Step Progress` - Marcar steps como concluídos (em breve)
- `Capybara: Complete Current Task` - Completar tarefa atual (em breve)
- `Capybara: Task History` - Ver histórico de tarefas (em breve)

#### **🔄 Comandos Legacy:**
- `Capybara: Create Smart Task (Legacy)` - Redireciona para Create New Task
- `Capybara: Add Prevention Rule (Legacy)` - Funcionalidade integrada automaticamente

### **📝 Estado Atual do Desenvolvimento:**
- ✅ Inicialização e configuração: **Completa**
- ✅ Criação básica de tarefas: **Funcional com validação**
- 🚧 Gerenciamento de tarefas: **Em desenvolvimento**
- 🚧 Histórico e analytics: **Planejado**

---
*Este arquivo é privado e não deve ser commitado. Ele contém suas instruções personalizadas para o GitHub Copilot.*

=====================START CAPYBARA MEMORY v1.0.0=====================
# 🔨 Capybara - GitHub Copilot Instructions

## 📋 **PROJECT CONTEXT**
- **Project**: forge-framework
- **Type**: node-app
- **Main Language**: javascript, typescript
- **Frameworks**: None detected

## 🎯 **CAPYBARA METHODOLOGY**
This project uses Capybara methodology (Focus, Organize, Record, Grow, Evolve) for solo development:

### **Principles:**
1. **Atomic Tasks**: Maximum 2-3 hours per STEP
2. **XML Structure**: Tasks defined in single XML file
3. **Continuous Learning**: Every error becomes a prevention rule
4. **Preserved Context**: AI always informed of current state
5. **Minimal Documentation**: Only what saves time

### **Active Prevention Rules:**
*Rules will be automatically loaded from .capy/prevention-rules.md file*

## 🤖 **LLM TASK MANAGEMENT COMMANDS**

### **Task Creation Detection:**
When the user says something like:
- "vamos adicionar a auth do supabase nesse projeto"
- "preciso implementar um sistema de login"
- "criar um dashboard administrativo"
- "adicionar integração com API X"

**You MUST:**

1. **Check for Active Tasks** first:
   - Look for existing task.xml files in .capy/tasks/ directory
   - If any task has status="em-andamento" or status="pausada", ask the user:
     "⚠️ Existe uma tarefa ativa: [TASK_TITLE]. Deseja pausar esta tarefa para iniciar uma nova? (Digite 'sim' para pausar ou 'não' para continuar a tarefa atual)"

2. **If user confirms task creation:**
   - Read the complete instructions from `.capy/instructions/capybara-task-file-structure-info.md`
   - Follow those instructions exactly to generate a proper XML task structure
   - Create the XML file in .capy/tasks/ with a unique ID
   - Inform the user: "✅ Nova tarefa criada: [TASK_TITLE]. Use 'Capybara: Current Task' para ver detalhes."

3. **If user wants to continue existing task:**
   - Show the current task status and next steps
   - Ask what specific step they want to work on

### **Task Status Management:**
- Always check .capy/tasks/ for current tasks before suggesting new work
- When showing task information, display progress and next steps clearly
- Remind users to mark steps as completed by changing `concluido="true"`

### **XML Generation Rules:**
- **ALWAYS** read `.capy/instructions/capybara-task-file-structure-info.md` before generating XML
- Follow the exact structure and requirements specified there
- Include all required sections: metadata, context, steps, validation
- Ensure steps are logical, sequential, and testable
- Add specific criteria for each step
- Include proper file listings and dependencies

## 🛠️ **SPECIFIC INSTRUCTIONS**

### **For this project:**
- Always check prevention rules before suggesting code
- Work with tasks in XML format (task.xml)
- Focus on simple and direct solutions
- Document problems found to create new rules

### **⚠️ Current Extension State:**
- **Initialization**: Fully functional
- **Focus**: Minimal, focused extension with only essential initialization

### **🎯 Recommended Workflow:**
1. Use `Capybara: Initialize` to configure new project
2. Manually create and edit task.xml files in .capy folder
3. Mark steps as complete by changing `concluido="true"`
4. Use external tools or manual processes for task management

### **📄 XML Task Structure:**

```xml
<task id="task-id" versao="1.0">
    <metadados>
        <titulo>Task Title</titulo>
        <descricao>Detailed description</descricao>
        <status>em-andamento|pausada|concluida</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="React" versao="18+"/>
        <dependencias>
            <lib>example-library</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Step Name</titulo>
            <descricao>What to do in this step</descricao>
            <criterios>
                <criterio>Criteria 1</criterio>
                <criterio>Criteria 2</criterio>
            </criterios>
            <entrega>File.jsx</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>All mandatory steps completed</item>
        </checklist>
    </validacao>
</task>
```

### **Available Capybara Commands:**

#### **✅ Functional Commands:**
- `Capybara: Initialize` - Initialize Capybara in workspace
- `Capybara: Test Capybara Extension` - Test if extension is working

#### **� Manual File Management:**
- Create task.xml files manually in .capy/tasks/
- Edit prevention-rules.md manually
- Manage project structure manually
- Use standard VS Code features for file operations

### **📝 Current Development State:**
- ✅ Initialization and configuration: **Complete**
- ✅ Project setup: **Functional**
- � Task management: **Manual file-based**
- � History and analytics: **Manual tracking**

### **🎯 Philosophy:**
This extension focuses on **initialization only** - providing the essential structure and 
documentation for Capybara methodology. All task management is done manually through 
file editing, keeping the extension lightweight and focused.

---
*This file is private and should not be committed. It contains your personalized instructions for GitHub Copilot.*
======================END CAPYBARA MEMORY v1.0.0======================
