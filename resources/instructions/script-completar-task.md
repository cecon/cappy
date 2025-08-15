# Script LLM: Completar Task

## 🎯 **Trigger de Ativação**
Quando o usuário solicitar:
- "completar task"
- "finalizar tarefa"
- "task concluída"
- "mover para histórico"

## 📋 **Fluxo de Execução**

### **1. Localizar Task Ativa**
```javascript
// Pseudocódigo para LLM
active_task_file = find_active_task(".cappy/tasks/")
if (!active_task_file) {
    return "❌ Nenhuma task ativa para completar."
}

xml = parse_xml(read_file(active_task_file))
```

### **2. Validar Conclusão**
```javascript
// Verificar se todos os steps obrigatórios foram concluídos
required_steps = filter_steps(xml.steps, "required=true")
incomplete_steps = filter_steps(required_steps, "completed=false")

if (incomplete_steps.length > 0) {
    show_warning("⚠️ Steps obrigatórios não concluídos:")
    for (step in incomplete_steps) {
        show_item("- " + step.title + " (Step " + step.order + ")")
    }
    ask_user("Deseja completar mesmo assim? (Digite 'forçar' para confirmar)")
    if (user_response != "forçar") return
}
```

### **3. Executar Checklist de Validação**
```javascript
validation_checklist = xml.validation.checklist.item
results = []

for (item in validation_checklist) {
    // LLM deve verificar cada item do checklist
    result = verify_checklist_item(item)
    results.push({item: item, status: result})
}

show_validation_results(results)
```

### **4. Extrair Learnings**
```javascript
// Identificar novos learnings para prevention rules
ask_user("Durante esta task, encontrou algum problema ou aprendizado importante?")
if (user_provides_learning) {
    // Usar comando específico para adicionar prevention rule
    execute_command("cappy.addPreventionRule", {
        title: format_rule_title(user_learning),
        description: user_learning,
        category: extract_task_category(xml) || "general"
    })
}
```

### **5. Mover para Histórico**
```javascript
// Atualizar XML
xml.metadata.status = "concluida"
xml.metadata.completed_at = current_timestamp()
xml.metadata.final_validation = validation_results

// Mover arquivo
timestamp = unix_timestamp()
history_filename = `COMPLETED_${timestamp}_${extract_title(active_task_file)}.xml`
move_file(active_task_file, `.cappy/history/${history_filename}`)
```

### **6. Gerar Relatório de Conclusão**
```markdown
# ✅ Task Concluída: [TASK_TITLE]

## 📊 Estatísticas
- **Duração**: [TEMPO_TOTAL]
- **Steps Executados**: [COMPLETED]/[TOTAL]
- **Arquivos Criados**: [LISTA_ARQUIVOS]
- **Prevention Rules Adicionadas**: [NÚMERO]

## 🎯 Resultados Alcançados
[lista dos principais deliverables]

## 📚 Learnings Capturados
[novos learnings adicionados às prevention rules]

## 📁 Localização do Histórico
- **Arquivo**: .cappy/history/[FILENAME]
- **Status**: Concluída
- **Data**: [DATA_CONCLUSAO]

## 🚀 Próximos Passos
Agora você pode:
- Criar uma nova task
- Revisar histórico de tasks
- Aplicar learnings em futuros projetos
```

## 🛡️ **Prevention Rules Aplicáveis**
- Validar todos os steps obrigatórios antes de completar
- Executar checklist de validação completo
- Capturar learnings para prevention rules
- Mover arquivo para histórico com timestamp
- Gerar relatório de conclusão detalhado

## 📊 **Saídas Esperadas**
- Task movida para `.cappy/history/`
- Status alterado para "concluida"
- Prevention rules atualizadas com novos learnings
- Relatório de conclusão gerado
- Orientação sobre próximos passos
