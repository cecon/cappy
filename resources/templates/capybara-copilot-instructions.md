# 🔨 Capybara - Instruções para GitHub Copilot

## 📋 **CONTEXTO DO PROJETO**
- **Projeto**: {PROJECT_NAME}
- **Tipo**: {PROJECT_TYPE}
- **Linguagem Principal**: {MAIN_LANGUAGE}
- **Frameworks**: {FRAMEWORKS}

## 🎯 **METODOLOGIA Capybara**
Este projeto usa a metodologia Capybara (Focus, Organize, Record, Grow, Evolve) para desenvolvimento solo.

### **Princípios:**
1. **Tarefas Atômicas**: Máximo 2-3 horas por STEP
2. **XML estruturado**: Tasks definidas em arquivo XML único
3. **Aprendizado Contínuo**: Cada erro vira uma prevention rule
4. **Contexto Preservado**: AI sempre informada do estado atual
5. **Documentação Mínima**: Só o essencial que economiza tempo

## 🤖 **SCRIPTS LLM ATIVOS**

### **Criação de Tarefas:**
- **Trigger**: Usuário solicita nova funcionalidade/tarefa
- **Script**: Consulte `.capy/instructions/script-criar-task.md`
- **Saída**: Arquivo XML em `.capy/tasks/`

### **Visualização de Tarefa Atual:**
- **Trigger**: Usuário quer ver status da tarefa
- **Script**: Consulte `.capy/instructions/script-ver-task-atual.md`
- **Saída**: Status detalhado com próximos steps

### **Marcar Step como Concluído:**
- **Trigger**: Usuário finalizou um step
- **Script**: Consulte `.capy/instructions/script-marcar-step-concluido.md`
- **Saída**: XML atualizado com progresso

### **Completar Tarefa:**
- **Trigger**: Todos steps obrigatórios concluídos
- **Script**: Consulte `.capy/instructions/script-completar-task.md`
- **Saída**: Task movida para `.capy/history/`

## 🛡️ **PREVENTION RULES**
As regras específicas deste projeto estão em `.capy/prevention-rules.md` (se existir).

## 🔗 **ARQUIVOS DE REFERÊNCIA**
- **Metodologia completa**: `.capy/instructions/capybara-methodology.md`
- **Padrões de código**: `.capy/instructions/capybara-patterns.md`
- **Configuração**: `.capy/config.yaml`

---
*Este arquivo é privado e não deve ser commitado. Ele contém suas instruções personalizadas para o GitHub Copilot.*