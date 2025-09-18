<!-- CAPPY INI -->

# CAPPY — Manual de Comandos v2.0 (Orquestração de Contexto)

## Proibições Absolutas
- **Nunca** tente rodar comandos Cappy no terminal ou acessar domínios/diretórios externos  
- **Nunca** leia arquivos além de `.cappy/output.txt` para resultados de comandos  
- `.cappy/output.txt` é **a única fonte da verdade** para saídas  
  - Se o arquivo **não existir** ou estiver **vazio**, **pare imediatamente** e responda em **1 linha**:  
    `No output in .cappy/output.txt. Re-execute in VS Code.`

---

## Objetivo
Padronizar como LLM e desenvolvedor interagem com o CAPPY 2.0 para:
- Criar/gerenciar **tarefas atômicas**
- Orquestrar **contexto automaticamente** no momento certo
- Registrar progresso conforme **CAPPY Task XSD 1.0**
- Aplicar **regras de prevenção** automaticamente por categoria

---

## Regras de Ouro
1. **Prioridade de comando** — mensagens que começam com `cappy:` têm prioridade máxima  
2. **Fonte única da verdade** — após executar o comando, **ler apenas** `.cappy/output.txt`  

---

## Interpretação Natural de Comandos
O usuário pode falar naturalmente. O LLM interpreta e mapeia para:

**Gerenciamento de Tarefas**  
- "new task" / "create task" / "nova tarefa" → `cappy:new` (**gera roteiro passo a passo de criação**)  
- "current task" / "active task" / "tarefa ativa" → `cappy:taskstatus`  
- "work on task" / "continue" / "trabalhar na tarefa" → `cappy:workcurrent`  
- "complete task" / "finish" / "concluir tarefa" → `cappy:taskcomplete`

**Setup de Projeto**  
- "setup cappy" / "initialize" / "inicializar" → `cappy:init`  
- "analyze project" / "know stack" / "analisar projeto" → `cappy:knowstack`

**Informação**  
- "cappy version" / "version" / "versão" → `cappy:version`

**Sempre confirmar interpretação:**  
`Interpretando como cappy:new — gerar roteiro passo a passo para criar uma task`

---

## Estrutura de Arquivos
```
.cappy/
 ├─ tasks/                  # Tasks ativas (.ACTIVE.xml)
 ├─ history/                # Tasks concluídas
 ├─ config.yaml             # Configuração do Cappy
 ├─ stack.md                # KnowStack do projeto
 ├─ output.txt              # Resultado do último comando (fonte única)
 ├─ schemas/                # Definições XSD para referência/edição manual
 └─ index/                  # Orquestração de contexto
     ├─ tasks.json
     ├─ prevention.json
     └─ context.json
docs/
 ├─ components/
 ├─ prevention/
 └─ index/
```

**Observação:**  
Os arquivos XSD dentro de `.cappy/schemas/` existem apenas como **referência formal** para edição manual de tasks (ex.: marcar steps como concluídos, validar conformidade). Não é necessário conhecê-los em detalhe no dia a dia.

---

## Fluxo CAPPY 2.0
1. `cappy.init` → cria estrutura base + índices de contexto  
2. `cappy.knowstack` → analisa workspace e gera `stack.md`  
3. `cappy.new` → **gera o roteiro (script) de criação de task passo a passo**  
4. `cappy.createTaskFile` → **aplica XSD** e **orquestra contexto automaticamente** (docs, regras, tasks relacionadas)  
5. `cappy.workOnCurrentTask` → executa com **contexto e prevenção**  
6. `cappy.completeTask` → finaliza, captura aprendizados e atualiza índices

---

## Estruturas XSD da Task
- As tasks devem sempre obedecer ao namespace:  
  `xmlns="https://cappy-methodology.dev/task/1.0"`

- A conformidade XSD é validada automaticamente pelo CAPPY, mas o diretório `.cappy/schemas/` está disponível caso seja necessário:  
  - Revisar a estrutura de uma task  
  - Editar manualmente steps (ex.: marcar como concluído)  
  - Validar campos obrigatórios

- **Regras obrigatórias de conformidade:**
  1. Namespace correto  
  2. Categoria dentro do enum válido  
  3. Máx. 5 steps principais  
  4. `<context>` sempre presente nas tasks  
  5. Timestamps ISO-8601  
  6. Critérios de validação mensuráveis por step  

---

## Templates de Resposta CAPPY 2.0
- **new** → `Task creation script generated. Review, answer prompts, then run cappy:createTaskFile`  
- **createtaskfile** → `XML task created: [ID] category [cat]. Rich context injected automatically`  
- **taskstatus (ativo)** → `Active [category] task. [X] prevention rules applied. Next: [step]`  
- **taskstatus (inativo)** → `No active task. Use 'new task' to get the step-by-step script`  
- **workcurrent** → `Executing context-aware: [step]. [X] rules verified`  
- **taskcomplete** → `Task completed. [X] learnings captured, context metrics updated`  
- **erro genérico** → `No output in .cappy/output.txt. Re-execute in VS Code`

---

<!-- CAPPY END -->