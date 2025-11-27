# 📋 Task Management System - CAPPY

## Visão Geral

O sistema de gerenciamento de tasks do CAPPY permite criar, rastrear e trabalhar em tarefas estruturadas usando arquivos XML com checklist embutido. O agente conversacional pode chamar ferramentas para criar e gerenciar essas tasks durante a conversa.

## Fluxo de Trabalho

### 1. Criação de Task via Conversa

O agente conversacional pode chamar a tool `cappy_create_task_file` quando detectar que o usuário quer criar uma task:

**Exemplo de conversa:**
```
Usuário: "preciso criar uma task para implementar autenticação JWT"
Agente: [chama cappy_create_task_file com category='feature' e title='Implement JWT authentication']
```

### 2. Arquivo XML Gerado

O sistema cria um arquivo com o padrão:
```
.cappy/tasks/task_2025-11-26_1732632000000_implement-jwt-authentication.xml
```

### 3. Checklist Embutido

Cada arquivo contém um checklist no formato de comentário XML:

```xml
<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║                        CAPPY TASK CREATION CHECKLIST                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 TASK CREATION PROGRESS:
  [⏳] Phase 1: Basic Information (CURRENT)
    [ ] 1.1 - Fill in task description
    [ ] 1.2 - Define acceptance criteria
    [ ] 1.3 - Review category (feature)
  
  [ ] Phase 2: Implementation Planning
    [ ] 2.1 - Define implementation steps (max 5 main steps)
    [ ] 2.2 - Add sub-steps where needed
    [ ] 2.3 - Define validation criteria for each step
  ...
-->
```

### 4. Carregamento Automático

Quando o chat inicia, o sistema:
1. Verifica se existe arquivo `.ACTIVE.xml` em `.cappy/tasks/`
2. Carrega automaticamente o conteúdo
3. Adiciona ao contexto do agente conversacional
4. Mostra resumo do progresso ao usuário

**Exemplo de saída:**
```
📋 Active Task Detected

Title: Implement JWT authentication
Category: feature
Progress: 2/12 items completed (17%)
Current Phase: Phase 1: Basic Information

Checklist:
✅ 1.1 - Fill in task description
✅ 1.2 - Define acceptance criteria
⬜ 1.3 - Review category (feature)
⬜ 2.1 - Define implementation steps (max 5 main steps)
⬜ 2.2 - Add sub-steps where needed
... and 7 more items

💡 I can help you continue working on this task. What would you like to do next?
```

## Ferramentas Disponíveis

### `cappy_create_task_file`

Cria um arquivo de task estruturado.

**Input Schema:**
```typescript
{
  category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'chore',
  title: string,
  slug?: string  // opcional, gerado automaticamente do título
}
```

**Exemplo de uso pelo agente:**
```typescript
await vscode.lm.invokeTool('cappy_create_task_file', {
  input: {
    category: 'feature',
    title: 'Add user authentication'
  }
});
```

**Output:**
```
✅ Task file created: .cappy/tasks/task_2025-11-26_1732632000000_add-user-authentication.xml

📋 Next steps (follow the checklist inside the file):
1. [ ] Fill in task description
2. [ ] Define acceptance criteria
3. [ ] Add implementation steps
4. [ ] Specify context requirements
5. [ ] Define validation criteria
```

## Estrutura do Arquivo XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<task xmlns="http://cappy.dev/schemas/task/2.0">
  
  <metadata>
    <id>task-1732632000000-a1b2c3</id>
    <category>feature</category>
    <title>Add user authentication</title>
    <description>
      <!-- TODO: Describe what needs to be accomplished -->
    </description>
    <createdAt>2025-11-26T10:00:00.000Z</createdAt>
    <updatedAt>2025-11-26T10:00:00.000Z</updatedAt>
    <status>draft</status>
  </metadata>

  <requirements>
    <acceptanceCriteria>
      <!-- TODO: Define clear acceptance criteria -->
    </acceptanceCriteria>
  </requirements>

  <implementation>
    <steps>
      <!-- TODO: Define implementation steps (max 5 main steps) -->
    </steps>
  </implementation>

  <context>
    <documentation>
      <!-- TODO: Specify required documentation files -->
    </documentation>
    
    <preventionRules>
      <!-- TODO: List prevention rules to apply -->
    </preventionRules>
    
    <relatedTasks>
      <!-- TODO: Link related tasks if any -->
    </relatedTasks>
  </context>

  <progress>
    <currentStep>step-1</currentStep>
    <completedSteps>
      <!-- Completed steps will be tracked here -->
    </completedSteps>
    <learnings>
      <!-- Learnings captured during execution will be added here -->
    </learnings>
  </progress>

</task>
```

## Fases de Criação da Task

### Phase 1: Basic Information (CURRENT ao criar)
- Preencher descrição da task
- Definir critérios de aceitação
- Revisar categoria

### Phase 2: Implementation Planning
- Definir passos de implementação (máx 5 principais)
- Adicionar sub-passos quando necessário
- Definir critérios de validação para cada passo

### Phase 3: Context Requirements
- Especificar documentação necessária
- Listar regras de prevenção a aplicar
- Definir tasks relacionadas/dependências

### Phase 4: Validation & Refinement
- Revisar todas as seções para completude
- Garantir que timestamps são válidos
- Verificar conformidade com XSD

### Phase 5: Activation
- Marcar arquivo como `.ACTIVE.xml`
- Começar trabalho no primeiro step

## Sistema de Progresso

O sistema rastreia progresso através de:

1. **Checkboxes no comentário XML** - Para guiar preenchimento inicial
2. **Campo `<status>`** - draft, active, completed, cancelled
3. **Campo `<currentStep>`** - Qual step está sendo executado
4. **Campo `<completedSteps>`** - Lista de steps completados
5. **Campo `<learnings>`** - Aprendizados capturados durante execução

## Integração com Agente Conversacional

O agente conversacional:

1. **Detecta intenção de criar task** durante conversa natural
2. **Chama `cappy_create_task_file`** com informações coletadas
3. **Carrega task ativa automaticamente** quando chat inicia
4. **Adiciona contexto da task** ao prompt do LLM
5. **Guia usuário através das fases** de preenchimento

## Próximos Passos (Planejados)

- [ ] Tool para marcar items do checklist como completos
- [ ] Tool para ativar/desativar tasks (renomear para .ACTIVE.xml)
- [ ] Tool para adicionar learnings à task
- [ ] Agente especializado em leitura de task XML
- [ ] Sistema de fases como ferramentas (refinement phases)
- [ ] Integração com sistema de prevenção rules
- [ ] Auto-orquestração de contexto baseado em `<context>`

## Benefícios

✅ **Conversacional** - Cria tasks através de conversa natural
✅ **Estruturado** - XML com schema definido (XSD)
✅ **Rastreável** - Checklist visual de progresso
✅ **Automático** - Carrega contexto ao iniciar chat
✅ **Incremental** - Preencher task em fases
✅ **Guiado** - Sistema sabe onde está na criação
