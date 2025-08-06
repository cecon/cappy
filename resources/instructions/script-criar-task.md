# Script LLM: Criar Nova Task

## 🎯 **Trigger de Ativação**
Quando o usuário solicitar:
- "criar nova task"
- "nova tarefa"
- "vamos trabalhar em [feature]"
- "preciso implementar [feature]"

## 📋 **Fluxo de Execução**

### **1. Verificação de Tasks Ativas**
```javascript
// Pseudocódigo para LLM
tasks_ativas = list_files(".capy/tasks/*.xml")
for (task in tasks_ativas) {
    xml = read_file(task)
    if (xml.status == "em-andamento" || xml.status == "pausada") {
        ask_user("⚠️ Existe tarefa ativa: " + xml.title + ". Pausar para criar nova?")
        if (user_response == "não") return
    }
}
```

### **2. Leitura de Contexto**
```javascript
// LLM deve ler obrigatoriamente:
instructions = read_file(".capy/instructions/capybara-task-file-structure-info.md")
prevention_rules = read_file(".capy/prevention-rules.md")
project_config = read_file(".capy/config.json")
```

### **3. Análise de Atomicidade**
```javascript
if (task_estimation > 3_hours) {
    suggest_decomposition()
    show_patterns_from(".capy/instructions/capybara-patterns.md")
}
```

### **4. Questionário de Clarificação**
Se necessário, perguntar sobre:
- **Escopo técnico**: Funcionalidades específicas
- **Tecnologias**: Bibliotecas e frameworks
- **Interface**: Requisitos de UI/UX
- **Validação**: Regras de negócio
- **Testes**: Cobertura esperada

### **5. Apresentação de Escopo**
```markdown
## 🎯 Escopo Entendido:
**Tarefa**: [TÍTULO]
**Área**: [frontend/backend/fullstack]
**Tecnologias**: [lista]
**Arquivos**: [lista de arquivos que serão tocados]
**Steps**: [resumo dos steps principais]
**Tempo**: [estimativa em horas]

## 📋 Prevention Rules Aplicadas:
[lista das regras que serão seguidas]

✅ Este escopo está correto? (Digite 'sim' para confirmar)
```

### **6. Criação do XML**
```javascript
timestamp = unix_timestamp()
filename = `STEP_${timestamp}_${kebab_case(title)}.xml`
xml_content = generate_xml_following_structure_info()
write_file(`.capy/tasks/${filename}`, xml_content)
```

### **7. Confirmação**
```markdown
✅ Tarefa criada: [FILENAME]
📁 Localização: .capy/tasks/[FILENAME]

Digite "vamos iniciar" ou "vamos trabalhar" para começar a execução.
```

## 🛡️ **Prevention Rules Aplicáveis**
- Sempre verificar tasks ativas antes de criar nova
- Seguir estrutura XML exata do arquivo de instruções
- Incluir ALL required sections: metadata, context, steps, validation
- Steps devem ser sequenciais e com critérios específicos
- Arquivo deve usar timestamp para ordenação cronológica

## 📊 **Saídas Esperadas**
- Arquivo XML criado em `.capy/tasks/`
- Status da task = "em-andamento"
- Prevention rules aplicadas e mencionadas
- Usuário orientado sobre próximo passo
