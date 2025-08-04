# 🔨 Capybara - Instruções para GitHub Copilot

## 📋 **CONTEXTO DO PROJETO**
- **Projeto**: {PROJECT_NAME}
- **Tipo**: {PROJECT_TYPE}
- **Linguagem Principal**: {MAIN_LANGUAGE}
- **Frameworks**: {FRAMEWORKS}

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

## 🤖 **COMANDOS DE DETECÇÃO LLM**

### **Detecção de Criação de Tarefas:**
Quando o usuário disser algo como:
- "vamos adicionar a auth do supabase nesse projeto"
- "preciso implementar um sistema de login"
- "criar um dashboard administrativo"
- "adicionar integração com API X"

**VOCÊ DEVE:**

1. **Verificar Tarefas Ativas** primeiro:
   - Procurar por arquivos task.xml existentes em .capy/tasks/
   - Se alguma task tem status="em-andamento" ou status="pausada", perguntar ao usuário:
     "⚠️ Existe uma tarefa ativa: [TASK_TITLE]. Deseja pausar esta tarefa para iniciar uma nova? (Digite 'sim' para pausar ou 'não' para continuar a tarefa atual)"

2. **Se usuário confirmar criação da task:**
   - Ler as instruções completas de `.capy/instructions/capybara-task-file-structure-info.md`
   - Seguir essas instruções exatamente para gerar uma estrutura XML adequada
   - Criar o arquivo XML em .capy/tasks/ com ID único
   - Informar o usuário: "✅ Nova tarefa criada: [TASK_TITLE]. Use 'Capybara: Current Task' para ver detalhes."

3. **Se usuário quiser continuar tarefa existente:**
   - Mostrar o status da tarefa atual e próximos steps
   - Perguntar em que step específico quer trabalhar

### **Gerenciamento de Status de Tarefas:**
- Sempre verificar .capy/tasks/ para tarefas atuais antes de sugerir novo trabalho
- Ao mostrar informações de task, exibir progresso e próximos steps claramente
- Lembrar usuários de marcar steps como concluídos alterando `concluido="true"`

### **Regras de Geração XML:**
- **SEMPRE** ler `.capy/instructions/capybara-task-file-structure-info.md` antes de gerar XML
- Seguir a estrutura exata e requisitos especificados lá
- Incluir todas as seções obrigatórias: metadata, context, steps, validation
- Garantir que steps sejam lógicos, sequenciais e testáveis
- Adicionar critérios específicos para cada step
- Incluir listagens adequadas de arquivos e dependências

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
