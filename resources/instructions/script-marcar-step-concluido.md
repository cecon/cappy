# Script LLM: Marcar Step como Concluído

## 🎯 **Trigger de Ativação**
Quando o usuário solicitar:
- "marcar step como concluído"
- "finalizar step atual"
- "step concluído"
- "próximo step"

## 📋 **Fluxo de Execução**

### **1. Localizar Step Atual**
```javascript
// Pseudocódigo para LLM
active_task_file = find_active_task(".cappy/tasks/")
xml = parse_xml(read_file(active_task_file))
current_step = find_first_where(xml.steps.step, "completed=false")

if (!current_step) {
    return "✅ Todos os steps já foram concluídos! Use 'completar task' para finalizar."
}
```

### **2. Verificar Critérios de Conclusão**
```javascript
criteria = current_step.criteria.criterion
incomplete_criteria = []

show_user("🔍 Verificando critérios do Step: " + current_step.title)

for (criterion in criteria) {
    ask_user("✅ " + criterion + " - Foi atendido? (s/n)")
    if (user_response != "s") {
        incomplete_criteria.push(criterion)
    }
}

if (incomplete_criteria.length > 0) {
    show_warning("⚠️ Critérios não atendidos:")
    for (item in incomplete_criteria) {
        show_item("- " + item)
    }
    ask_user("Deseja marcar como concluído mesmo assim? (Digite 'forçar')")
    if (user_response != "forçar") return
}
```

### **3. Verificar Arquivos Necessários**
```javascript
required_files = filter_files(current_step.files, "required=true")
missing_files = []

for (file in required_files) {
    if (!file_exists(file.path)) {
        missing_files.push(file.path)
    }
}

if (missing_files.length > 0) {
    show_warning("📁 Arquivos obrigatórios não encontrados:")
    for (file in missing_files) {
        show_item("- " + file)
    }
    ask_user("Continuar mesmo assim? (Digite 'continuar')")
    if (user_response != "continuar") return
}
```

### **4. Atualizar XML**
```javascript
// Marcar step como concluído
current_step.completed = "true"
current_step.completed_at = current_timestamp()

// Atualizar progresso geral
completed_count = count_where(xml.steps.step, "completed=true")
total_count = count(xml.steps.step)
xml.metadata.progress = completed_count + "/" + total_count

// Salvar arquivo
write_file(active_task_file, serialize_xml(xml))
```

### **5. Mostrar Próximo Step**
```javascript
next_step = find_first_where(xml.steps.step, "completed=false")

if (next_step) {
    show_next_step_info(next_step)
} else {
    show_completion_ready_message()
}
```

### **6. Atualizar Prevention Rules (se necessário)**
```javascript
ask_user("Encontrou algum problema ou aprendizado neste step?")
if (user_provides_learning) {
    new_rule = format_prevention_rule(user_learning, current_step.area)
    append_to_file(".cappy/prevention-rules.md", new_rule)
    show_user("🛡️ Nova prevention rule adicionada!")
}
```

## 📋 **Template de Resposta**

```markdown
# ✅ Step Concluído: [STEP_TITLE]

## 📊 Progresso Atualizado
- **Task**: [TASK_TITLE]
- **Progresso**: [X]/[TOTAL] steps ([XX]%)
- **Step Concluído**: [STEP_NUMBER] - [STEP_TITLE]

## 📍 Próximo Step
**[NEXT_STEP_TITLE]** (Step [NUMBER])
🎯 **Objetivo**: [NEXT_STEP_DESCRIPTION]

✅ **Critérios para conclusão**:
[lista dos critérios do próximo step]

## 🚀 Pronto para Continuar
Digite "vamos trabalhar" para iniciar o próximo step.
```

## 🛡️ **Prevention Rules Aplicáveis**
- Verificar todos os critérios antes de marcar como concluído
- Confirmar existência de arquivos obrigatórios
- Atualizar progresso no XML automaticamente
- Capturar learnings para prevention rules
- Mostrar próximo step automaticamente

## 📊 **Saídas Esperadas**
- Step marcado como `completed="true"` no XML
- Progresso geral atualizado
- Próximo step apresentado com critérios
- Prevention rules atualizadas se necessário
- Orientação para continuar o trabalho
