## Instalação da Extensão

A extensão tem builds específicas por plataforma para incluir apenas os binários nativos necessários e evitar problemas de compatibilidade.

### ⚡ Instalação Automática (Recomendada)

```bash
# Detecta sua plataforma e instala automaticamente
npm run install:extension
```

### 🔧 Instalação Manual por Plataforma

**Windows:**
```bash
npm run build
npm run package:win32
code --install-extension cappy-{version}-win32-x64.vsix --force
```

**macOS Intel:**
```bash
npm run build
npm run package:darwin
code --install-extension cappy-{version}-darwin-x64.vsix --force
```

**macOS Apple Silicon:**
```bash
npm run build
npm run package:darwin-arm64
code --install-extension cappy-{version}-darwin-arm64.vsix --force
```

**Linux:**
```bash
npm run build
npm run package:linux
code --install-extension cappy-{version}-linux-x64.vsix --force
```

### 🚀 Build Cross-Platform (Para CI/CD)

```bash
# Constrói para todas as plataformas
npm run package:all

# Publishes para todas as plataformas
npm run publish:all
```

### 🐛 Troubleshooting Módulos Nativos

Se encontrar problemas com SQLite3 ou Sharp:

```bash
# Diagnóstico e fix automático
npm run setup:native

# Limpeza manual
npm run clean:native
npm install
```

**Erro comum:** "not a valid Win32 application"
- ✅ **Solução**: A extensão agora detecta automaticamente e usa fallbacks
- ✅ **Prevention**: Use builds específicos por plataforma
<!-- CAPPY INI -->
# CAPPY — Manual de Comandos (Orquestração de Contexto)

## Proibições Absolutas

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

## Objetivo

Padronizar como LLM e desenvolvedor interagem com o CAPPY para:

* Criar/gerenciar **tarefas atômicas**
* Orquestrar **contexto automaticamente** no momento certo
* Registrar progresso no arquivo da Task
* Aplicar **regras de prevenção** automaticamente por categoria

---

## Regras de Ouro

1. **Execução exclusiva via API** — use sempre `vscode.commands.executeCommand`.
2. **Prioridade de comando** — mensagens que começam com `cappy:` têm prioridade máxima.
3. **Fonte única da verdade** — após qualquer execução, ler somente `.cappy/output.txt`.

---

## Execução de Comandos (programática)

* Todos os comandos CAPPY devem ser disparados programaticamente via VS Code:

  ```ts
  vscode.commands.executeCommand('<commandId>')
  ```
* É **proibido** executar comandos CAPPY no terminal.
* Após cada execução, ler `.cappy/output.txt`.
* Se não houver saída, responder:

  ```
  No output in .cappy/output.txt. Re-execute in VS Code.
  ```

---

## Interpretação Natural de Comandos

Falas naturais do usuário → mapeamento determinístico para **commandId** do VS Code:

### Gerenciamento de Tarefas

* "new task" / "create task" / "nova tarefa" → `cappy.new`
* "current task" / "active task" / "tarefa ativa" → `cappy.taskstatus`
* "work on task" / "continue" / "trabalhar na tarefa" → `cappy.workcurrent`
* "complete task" / "finish" / "concluir tarefa" → `cappy.completeTask`

### Setup de Projeto

* "setup cappy" / "initialize" / "inicializar" → `cappy.init`
* "analyze project" / "know stack" / "analisar projeto" → `cappy.knowstack`
* "reindex" / "rebuild index" / "atualizar índices" → `cappy.reindex`

### Informação

* "cappy version" / "version" / "versão" → `cappy.version`

**Sempre confirmar a interpretação antes de executar.**
Exemplo:

```
Interpretando como cappy.new — gerar roteiro passo a passo para criar uma task
```

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
 └─ indexes/                # Índices semânticos (gerados por cappy.reindex)
     ├─ tasks.json
     ├─ docs.json
     └─ rules.json
docs/
 ├─ components/
 ├─ prevention/
 └─ index/
```

---

## Documentação do Projeto

1. `docs/` → Documentação do projeto (Markdown, HTML, etc.)

   * Todas as documentações devem ser registradas aqui.
   * Após mudanças, rodar `cappy.reindex` para reconstruir índices semânticos.

---

## Comandos CAPPY

* `cappy.init` → cria estrutura base + índices de contexto
* `cappy.knowstack` → analisa workspace e gera `stack.md`
* `cappy.reindex` → reconstrói índices semânticos (rodar após mudanças em docs/rules)
* `cappy.new` → gera roteiro step-by-step para criação de task
* `cappy.createTaskFile` → aplica XSD e orquestra contexto automaticamente
* `cappy.workOnCurrentTask` → executa step atual com contexto e regras de prevenção
* `cappy.completeTask` → finaliza, captura aprendizados e atualiza índices
* `cappy.version` → exibe versão atual da extensão

---

## Regras Obrigatórias de Conformidade

1. Namespace correto
2. Categoria dentro do enum válido
3. Máx. 5 steps principais
4. `<context>` sempre presente nas tasks
5. Timestamps em ISO-8601
6. Critérios de validação mensuráveis por step

---

## Templates de Resposta CAPPY 2.0

* **new** → `Task creation script generated. Review, answer prompts, then run cappy.createTaskFile`
* **createtaskfile** → `XML task created: [ID] category [cat]. Rich context injected automatically`
* **taskstatus (ativo)** → `Active [category] task. [X] prevention rules applied. Next: [step]`
* **taskstatus (inativo)** → `No active task. Use 'new task' to get the step-by-step script`
* **workcurrent** → `Executing context-aware: [step]. [X] rules verified`
* **completetask** → `Task completed. [X] learnings captured, context metrics updated`
* **reindex** → `Semantic indexes rebuilt: [X] tasks, [Y] docs, [Z] rules indexed`
* **erro genérico** →

  ```
  No output in .cappy/output.txt. Re-execute in VS Code
  ```

---

## Política de Erros

* **Nunca** tentar adivinhar saídas.
* Se `.cappy/output.txt` estiver ausente ou vazio:

  ```
  No output in .cappy/output.txt. Re-execute in VS Code.
  ```

---
<!-- CAPPY END -->