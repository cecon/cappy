# Script LLM: Ver Task Atual

## 🎯 **Trigger de Ativação**
Quando o usuário solicitar:
- "ver task atual"
- "qual a tarefa ativa?"
- "mostrar progresso"
- "onde estou na task?"

## 📋 **Fluxo de Execução**

### **1. Localizar Task Ativa**
```javascript
// Pseudocódigo para LLM
tasks = list_files(".capy/tasks/*.xml")
active_task = null

for (task_file in tasks) {
    xml = parse_xml(read_file(task_file))
    if (xml.metadata.status == "em-andamento") {
        active_task = xml
        break
    }
}

if (!active_task) {
    return "❌ Nenhuma task ativa encontrada. Use 'criar nova task' para começar."
}
```

### **2. Analisar Progresso**
```javascript
total_steps = count(xml.steps.step)
completed_steps = count_where(xml.steps.step, "completed=true")
current_step = find_first_where(xml.steps.step, "completed=false")
progress_percentage = (completed_steps / total_steps) * 100
```

### **3. Apresentar Status**
```markdown
# 📋 Task Atual: [TASK_TITLE]

## 📊 Progresso Geral
- **Status**: [STATUS]
- **Progresso**: [X]/[TOTAL] steps ([XX]%)
- **Tempo Estimado**: [ESTIMATIVA]

## 📍 Próximo Step
**[STEP_TITLE]** (Step [NUMBER])
🎯 **Objetivo**: [STEP_DESCRIPTION]

✅ **Critérios para conclusão**:
[lista dos critérios do step atual]

## 📁 Arquivos Envolvidos
[lista dos arquivos que serão criados/modificados neste step]

## 🚀 Ações Disponíveis
- "vamos trabalhar" - Iniciar execução do step atual
- "marcar step como concluído" - Finalizar step atual
- "pausar task" - Pausar a task temporariamente
```

### **4. Verificar Dependencies**
```javascript
if (current_step.depends_on) {
    dependency_step = find_step_by_id(current_step.depends_on)
    if (!dependency_step.completed) {
        warn_user("⚠️ Step atual depende de: " + dependency_step.title)
    }
}
```

### **5. Mostrar Prevention Rules Relevantes**
```javascript
relevant_rules = filter_prevention_rules_by_context(current_step.area)
if (relevant_rules.length > 0) {
    show_section("🛡️ Prevention Rules Aplicáveis", relevant_rules)
}
```

## 🛡️ **Prevention Rules Aplicáveis**
- Sempre mostrar progresso de forma clara e visual
- Incluir próximo step e critérios específicos
- Verificar dependências entre steps
- Orientar usuário sobre ações disponíveis

## 📊 **Saídas Esperadas**
- Status visual claro da task e progresso
- Detalhes do próximo step a ser executado
- Lista de critérios específicos para conclusão
- Orientação sobre próximas ações possíveis
- Warning sobre dependências não atendidas (se houver)
