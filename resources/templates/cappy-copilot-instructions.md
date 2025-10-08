<!-- CAPPY INI -->

# CAPPY — Manual Completo de Uso (Orquestração de Contexto)

## 🎯 O que é o CAPPY?

CAPPY é um framework de **Orquestração de Contexto** que transforma seu desenvolvimento de reativo para inteligente. Cada task aprende automaticamente do contexto do seu projeto, aplicando documentação relevante, regras de prevenção e conhecimento acumulado.

### Principais Benefícios

- ✅ **Tasks Inteligentes**: Nascem com contexto completo do projeto
- 🛡️ **Prevenção Automática**: Evita erros já solucionados anteriormente  
- 📚 **Orquestração de Docs**: Encontra documentação relevante automaticamente
- 🔄 **Aprendizado Contínuo**: Transforma erros em regras de prevenção
- 🚀 **Comandos Naturais**: Use linguagem natural, não sintaxe complexa

---

## 🚀 Quick Start - Primeiros Passos

### 1. Inicializar o CAPPY no Projeto
```
"setup cappy" ou "initialize"
→ Executa: cappy.init
```
Cria estrutura `.cappy/` e analisa o projeto automaticamente.

### 2. Analisar Stack Tecnológico
```
"analyze project" ou "know stack"  
→ Executa: cappy.knowstack
```
Gera `stack.md` com arquitetura, dependências e padrões do projeto.

### 3. Criar Primeira Task
```
"create new task" ou "nova tarefa"
→ Executa: cappy.createTaskFile
```
Cria task XML diretamente com contexto inteligente e regras de prevenção.

### 4. Trabalhar na Task
```
"work on task" ou "continue"
→ Executa: cappy.workcurrent  
```
Executa step atual com contexto, regras de prevenção e validações.

---

## ⚠️ Regras de Ouro (OBRIGATÓRIAS)

### Proibições Absolutas

* **Nunca** executar comandos CAPPY no terminal, shell, cmd, bash ou PowerShell.
* Todos os comandos CAPPY são disparados **exclusivamente** via VS Code API:

  ```ts
  vscode.commands.executeCommand('<commandId>')
  ```
* **Nunca** ler arquivos além de `.cappy/output.txt`.
* `.cappy/output.txt` é **a única fonte da verdade** para saídas.

  * Se o arquivo **não existir** ou estiver **vazio**, **pare imediatamente** e responda em **1 linha**:

    ```
    No output in .cappy/output.txt. Re-execute in VS Code.
    ```

---

## 🎨 Workflow Completo - Exemplo Prático

### Cenário: Adicionar Autenticação JWT

1. **Inicializar** (se primeiro uso):
   ```
   User: "setup cappy"
   LLM: Interpretando como cappy.init — criar estrutura base
   ```

2. **Criar Task**:
   ```
   User: "I need to add JWT authentication"
   LLM: Interpretando como cappy.createTaskFile — criar task com contexto completo
   ```

3. **CAPPY Context Discovery** (automático):
   ```
   ✓ Found: docs/auth/patterns.md
   ✓ Found: 3 prevention rules for auth category  
   ✓ Found: 1 related task (user-session-mgmt)
   ✓ Auto-applied: JWT null validation rule
   ✓ Category: auth (inferred automatically)
   ```

4. **Trabalhar na Task**:
   ```
   User: "work on current task"
   LLM: Executing context-aware: Implement JWT middleware. 3 rules verified
   ```

5. **Completar**:
   ```
   User: "complete task"
   LLM: Task completed. 2 learnings captured, context metrics updated
   ```

---

## 🗣️ Comandos em Linguagem Natural

Fale naturalmente - o CAPPY entende:

### ✅ Gerenciamento de Tarefas
| Comando Natural | Ação CAPPY | Resultado |
|----------------|------------|-----------|
| "nova tarefa" / "create task" | `cappy.createTaskFile` | Cria task XML diretamente |
| "tarefa atual" / "current task" | `cappy.taskstatus` | Status + contexto |
| "trabalhar" / "continue" | `cappy.workcurrent` | Executa step atual |
| "finalizar" / "complete" | `cappy.completeTask` | Captura aprendizados |

### ✅ Setup de Projeto  
| Comando Natural | Ação CAPPY | Resultado |
|----------------|------------|-----------|
| "inicializar" / "setup cappy" | `cappy.init` | Cria estrutura `.cappy/` |
| "analisar projeto" / "know stack" | `cappy.knowstack` | Gera `stack.md` |
| "atualizar índices" / "reindex" | `cappy.reindex` | Reconstrói busca semântica |

### ✅ Informações
| Comando Natural | Ação CAPPY | Resultado |
|----------------|------------|-----------|
| "versão" / "version" | `cappy.version` | Versão da extensão |

**Sempre confirmar interpretação:**
```
Interpretando como cappy.createTaskFile — criar task XML com contexto completo
```

---

## 📁 Estrutura de Arquivos Inteligente

```
.cappy/
 ├─ tasks/                  # Tasks ativas (.ACTIVE.xml)
 │   └─ AUTH-001.ACTIVE.xml # Task em execução
 ├─ history/                # Tasks concluídas  
 │   └─ AUTH-001.xml        # Task finalizada
 ├─ config.yaml             # Configuração do Cappy
 ├─ stack.md                # KnowStack do projeto (auto-gerado)
 ├─ output.txt              # ⭐ FONTE ÚNICA DA VERDADE
 ├─ schemas/                # Definições XSD
 │   └─ task.xsd            # Schema para validação
 └─ indexes/                # Índices semânticos (auto-gerados)
     ├─ tasks.json          # Índice de tasks
     ├─ docs.json           # Índice de documentações
     └─ rules.json          # Índice de regras de prevenção

docs/                       # Documentação do Projeto
 ├─ components/             # Componentes reutilizáveis
 ├─ prevention/             # Regras de prevenção por categoria
 └─ index/                  # Índices e metadados
```

### 🎯 Arquivos Essenciais

- **`.cappy/output.txt`** → Única fonte da verdade para saídas
- **`.cappy/stack.md`** → Conhecimento do projeto (auto-atualizado)
- **`docs/`** → Toda documentação (indexada automaticamente)

---

## 🔧 Comandos CAPPY - Referência Completa

### Inicialização e Setup
```
cappy.init        → Cria estrutura base + índices de contexto  
cappy.knowstack   → Analisa workspace e gera stack.md
cappy.reindex     → Reconstrói índices semânticos
cappy.version     → Exibe versão atual da extensão
```

### Gerenciamento de Tasks
```
cappy.createTaskFile     → Cria task XML com contexto e prevenção
cappy.taskstatus         → Status da task ativa + contexto
cappy.workOnCurrentTask  → Executa step com prevenção
cappy.completeTask       → Finaliza + captura aprendizados
```

---

## 📋 Templates de Resposta CAPPY 2.0

### ✅ Respostas Padrão por Comando

| Comando | Template de Resposta |
|---------|---------------------|
| **createtaskfile** | `XML task created: [ID] category [cat]. Rich context injected automatically` |
| **taskstatus (ativo)** | `Active [category] task. [X] prevention rules applied. Next: [step]` |
| **taskstatus (inativo)** | `No active task. Use 'create task' to create a new task file` |
| **workcurrent** | `Executing context-aware: [step]. [X] rules verified` |
| **completetask** | `Task completed. [X] learnings captured, context metrics updated` |
| **reindex** | `Semantic indexes rebuilt: [X] tasks, [Y] docs, [Z] rules indexed` |

### ❌ Erro Genérico
```
No output in .cappy/output.txt. Re-execute in VS Code
```

---

## 🛡️ Sistema de Prevenção Inteligente

### Como Funciona
1. **Captura de Erros** → Problemas são documentados automaticamente
2. **Criação de Regras** → Erros viram regras de prevenção por categoria  
3. **Aplicação Automática** → Regras são aplicadas em tasks futuras
4. **Evolução Contínua** → Sistema aprende e melhora constantemente

### Exemplo de Regra de Prevenção
```xml
<rule category="auth" severity="high" auto_apply="true">
  Sempre validar existência do JWT token antes de decodificar
</rule>
```

### Categorias Principais
- `auth` → Autenticação e autorização
- `api` → Desenvolvimento de APIs
- `ui` → Interface do usuário  
- `db` → Banco de dados
- `test` → Testes automatizados
- `deploy` → Deploy e CI/CD

---

## 🔍 CappyRAG - Sistema de Busca Híbrida

### O que é o CappyRAG?
Sistema de busca **100% local** que combina:
- **Vector Search** (LanceDB) para similaridade semântica
- **Graph Relationships** (LightGraph) para expansão contextual
- **Visual Navigation** (React UI) com resultados explicáveis

### Como Usar
```
User: "Como implementar cache Redis?"
CAPPY: Busca automática em docs + código + tasks relacionadas
Result: Contexto relevante + exemplos + regras de prevenção
```

---

## ⚡ Execução de Comandos (Programática)

### Regras de Execução
1. **API Exclusiva** → Sempre `vscode.commands.executeCommand('<commandId>')`
2. **Terminal Proibido** → Nunca executar comandos CAPPY no terminal
3. **Fonte Única** → Apenas `.cappy/output.txt` como resultado
4. **Prioridade** → Comandos que começam com `cappy:` têm prioridade máxima

### Fluxo de Execução
```
1. Interpretar comando natural
2. Executar via VS Code API  
3. Ler APENAS .cappy/output.txt
4. Responder com template padrão
```

---

## 📊 Conformidade e Validação

### Regras Obrigatórias XSD
1. ✅ Namespace correto (`http://cappy.dev/task`)
2. ✅ Categoria dentro do enum válido
3. ✅ Máximo 5 steps principais
4. ✅ `<context>` sempre presente nas tasks
5. ✅ Timestamps em ISO-8601
6. ✅ Critérios de validação mensuráveis por step

### Validação Automática
- Schema XSD aplicado automaticamente
- Context discovery obrigatório
- Prevention rules verificadas
- Metrics tracking habilitado

---

## 🚨 Política de Erros

### Regra Única
**Nunca** tentar adivinhar saídas. Se `.cappy/output.txt` estiver ausente ou vazio:

```
No output in .cappy/output.txt. Re-execute in VS Code.
```

### Debugging
- Verificar se extensão está instalada
- Verificar se comando existe  
- Verificar se `.cappy/` foi inicializado
- Verificar logs do VS Code

---

## 💡 Dicas e Melhores Práticas

### ✅ Faça
- Use comandos naturais sempre que possível
- Mantenha documentação em `docs/` atualizada
- Execute `cappy.reindex` após mudanças importantes
- Revise tasks antes de executar `cappy.createTaskFile`

### ❌ Evite  
- Executar comandos CAPPY no terminal
- Ignorar regras de prevenção
- Criar tasks muito genéricas
- Esquecer de completar tasks

### 🎯 Pro Tips
- **Contexto Rico**: Quanto mais documentação, melhor o contexto
- **Categorias Consistentes**: Use sempre as mesmas categorias
- **Steps Atômicos**: Prefira steps pequenos e validáveis
- **Prevenção Proativa**: Documente erros para criar regras

---

## Objetivo

Padronizar como LLM e desenvolvedor interagem com o CAPPY para:

* Criar/gerenciar **tarefas atômicas**
* Orquestrar **contexto automaticamente** no momento certo
* Registrar progresso no arquivo da Task
* Aplicar **regras de prevenção** automaticamente por categoria

<!-- CAPPY END -->