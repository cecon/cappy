## 🚀 Build & Publicação
- Se eu pedir para publicar rode o comando package bump para alterar a versão e compile e publique
### Processo de Release

1. **Incrementar versão** no `package.json`:
   - Patch (2.5.12 → 2.5.13): bugs/melhorias menores
   - Minor (2.5.13 → 2.6.0): novas funcionalidades
   - Major (2.6.0 → 3.0.0): breaking changes

2. **Compilar e testar:**
   ```bash
   npm run compile    # Compilação TypeScript
   npm run test      # Executar todos os testes
   ```

3. **Gerar pacote VSIX:**
   ```bash
   npm run package   # Cria arquivo .vsix
   ```

4. **Publicar na VS Code Marketplace:**
   ```bash
   npm run publish   # Publica automaticamente
   ```
   
<!-- CAPPY INI -->
# 🔨 Cappy — Manual de Comandos e Fluxos (LLM Runtime)

## 🎯 Objeti- **Saída esperada em `output.txt`:** texto simples com "ok" ou XML mínimo:
  ```xml
  <init><ok>true</ok><created>tasks,history,stack.md,config.yaml,prevention-rules.xml</created></init>
  ```Padronizar como a LLM e o dev interagem com o Cappy para:
- Criar/gerir **tarefas atômicas** em XML.
- Registrar progresso com **poucas linhas** e **sem subjetividade**.
- Reaproveitar **KnowStack** e **Prevention Rules** para reduzir erros.

---

## 🧭 Regras de Ouro
1. **Comando manda** — mensagens iniciadas com `cappy:` têm prioridade máxima.  
2. **Fonte única de retorno** — após executar um comando, **leia exclusivamente** `.cappy/output.txt`.  
   - Se o arquivo **não existir** ou vier **vazio**, **pare** e informe em **1 linha**:  
     `⚠️ Comando sem saída em .cappy/output.txt. Reexecute no VS Code.`
3. **Pergunte 1×1** — quando precisar de contexto, faça **uma pergunta por vez**, até eliminar ambiguidade.  
4. **Respostas curtas** — 2–5 linhas, sempre apontando o **próximo passo**.  
5. **Escopo atômico** — uma task ≤ **3h** de esforço. Se exceder: **interrompa** e recomende decomposição.

---

## 📂 Estrutura de Arquivos
```
.cappy/
 ├─ tasks/                  # Tarefas ativas (.ACTIVE.xml)
 ├─ history/                # Tarefas concluídas
 ├─ prevention-rules.xml    # Regras de prevenção
 ├─ config.yaml             # Configuração do Cappy
 ├─ stack.md                # KnowStack do projeto
 └─ output.txt              # Resultado do último comando executado (fonte única)
```
> **Padrões canônicos**
> - **Nomes de arquivo**: `STEP_YYYYMMDD-HHMMSS_kebab.ACTIVE.xml`
> - **Ciclo de vida**: `prepared → em-andamento → paused → completed`
> - **ID lógico** (atributo em `<Task ... id="...">`) **não** inclui `.ACTIVE.xml`  
>   Ex.: arquivo `STEP_...ACTIVE.xml` ↔ id `STEP_...`

---

## 🔄 Fluxo Típico
1) `cappy.init` → estrutura base do Cappy  
2) `cappy.knowstack` → analisa e (re)gera `stack.md`  
3) `cappy.new` → roteiro/templating de nova task  
4) **(Q&A scope-first 1×1; checar ≤3h)**  
5) `cappy.createTaskFile` → cria o arquivo `*.ACTIVE.xml`  
6) `cappy.getActiveTask` → status resumido (XML em `output.txt`)  
7) `cappy.workOnCurrentTask` → trabalha na task ativa seguindo seu roteiro  
8) `cappy.changeTaskStatus` → pausar/retomar quando necessário  
9) `cappy.completeTask` → concluir e mover para `history/`

---

## 🧩 Convenções de Saída (contratos mínimos)

### `getActiveTask` — **sempre XML**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task-status>
  <active>true|false</active>
  <file-path>.../STEP_...ACTIVE.xml</file-path>   <!-- null/ vazio se não houver -->
  <last-modified>ISO-8601</last-modified>
  <line-count>123</line-count>
</task-status>
```

### `createTaskFile` — **XML**
```xml
<create-task>
  <file-path>.../STEP_...ACTIVE.xml</file-path>
  <id>STEP_...ACTIVE.xml</id>          <!-- pode vir com extensão; ID lógico = sem ".ACTIVE.xml" -->
  <status>prepared</status>
</create-task>
```

### `new` — **XML**
```xml
<new>
  <template>...XML/roteiro...</template>   <!-- roteiro/templating; pode incluir placeholders -->
</new>
```
> **Outros comandos** podem devolver **texto simples** (ex.: `cappy.version`) ou **XML**. Em todos os casos, a leitura é **exclusiva** de `.cappy/output.txt`.

---

## ⚙️ Comandos [use o run vscode para rodar os comandos internos da extensão cappy]

### 1) 🦫 `cappy.init` — Initialize Cappy
- **Copilot:** —  
- **Ação:** cria estrutura base do Cappy no workspace.  
- **Efeitos esperados:** cria `.cappy/` com subpastas/arquivos listados em **Estrutura de Arquivos**; atualiza `.gitignore`.  
- **Saída esperada em `output.txt`:** texto simples com “ok” ou XML mínimo:
  ```xml
  <init><ok>true</ok><created>tasks,history,stack.md,config.yaml,prevention-rules.md</created></init>
  ```
- **Erro padrão:** `⚠️ cappy.init sem saída. Reexecute.`  
- **Resposta curta:** `✅ Cappy iniciado. Estrutura criada em .cappy/. Próximo: cappy:knowstack.`

---

### 2) 🧠 `cappy.knowstack` — KnowStack
- **Copilot:** `cappy:knowstack` / `cappy:runknowstack` (alias: `cappy.knowtask`)
- **Ação:** analisa o workspace, (re)gera `stack.md` e retorna **roteiro XML**.  
- **Saída esperada (XML):**
  ```xml
  <knowstack>
    <stack-file>.cappy/stack.md</stack-file>
    <script>...XML/roteiro...</script>
  </knowstack>
  ```
- **Erro padrão:** `⚠️ KnowStack sem saída. Reexecute.`  
- **Resposta curta:** `🧠 KnowStack pronto (.cappy/stack.md). Seguindo roteiro retornado.`

---

### 3) 🧩 `cappy.new` — New Task
- **Copilot:** `cappy:new`  
- **Ação:** retorna **roteiro/templating** XML para nova task (não cria arquivo).  
- **Saída esperada (XML):**
  ```xml
  <new>
    <template>...XML/roteiro...</template>
  </new>
  ```
- **Uso LLM (scope-first 1×1):** coletar escopo, critérios, paths, deps, validação e **estimativa (≤3h)** antes de criar arquivo.  
- **Erro padrão:** `⚠️ new sem saída. Reexecute.`  
- **Resposta curta:** `🧩 Roteiro de nova task obtido. Próximo: cappy:createtaskfile.`

---

### 4) 📝 `cappy.createTaskFile` — Create Task File
- **Copilot:** `cappy:createtaskfile`  
- **Ação:** cria `*.ACTIVE.xml` em `.cappy/tasks/` com `status="prepared"`.  
- **Saída esperada (XML):** *(ver contrato em Convenções)*  
- **Comportamento LLM após criar:**  
  1) Ler `<file-path>` do `output.txt`.  
  2) **Abrir o XML criado** e preencher: `<title>`, `<goals>`, `<constraints>`, `<references>`, `<meta><estimate>`, `<steps>` com `<doneWhen>`.  
  3) **Vincular** `<preventionLinks>` relevantes de `.cappy/prevention-rules.xml`.  
  4) **Inserir** snapshot de *workspace context* a partir de `stack.md`.  
  5) Atualizar `<updatedAt>` e logar evento de preparação.
- **Erro padrão:** `⚠️ createTaskFile sem <file-path>. Reexecute.`  
- **Resposta curta:** `✅ Task preparada: {ID} → .cappy/tasks/{ARQ}. Próximo: cappy:taskstatus.`

---

### 5) 📄 `cappy.getActiveTask` — Get Active Task
- **Copilot:** `cappy:taskstatus`  
- **Ação:** retorna status da tarefa ativa (se existir).  
- **Saída esperada (XML):** *(ver contrato em Convenções)*  
- **Comportamento LLM:**  
  - `<active>false</active>` → `ℹ️ Nenhuma tarefa ativa. Use cappy:new.`  
  - `<active>true</active>` → ecoar resumo curto com `<file-path>` e dica do próximo passo.  
- **Erro padrão:** `⚠️ taskstatus sem saída. Reexecute.`  
- **Resposta curta (ativa):** `📌 Task ativa em "{file-path}". Próximo: executar step atual e marcar com cappy:stepdone.`

---

### 6) 🎯 `cappy.workOnCurrentTask` — Work on Current Task
- **Copilot:** `cappy:workcurrent` / `cappy:worktask`  
- **Ação:** obtém a task ativa via `getActiveTask` e segue o roteiro contido no XML da task.  
- **Fluxo:**  
  1) Chama internamente `cappy.getActiveTask` para verificar se há task ativa.  
  2) Se `<active>true</active>`, lê o arquivo XML da task em `<file-path>`.  
  3) Extrai e segue o roteiro/instruções contidos no XML (seções `<goals>`, `<steps>`, etc.).  
  4) Executa os steps pendentes conforme definido na task.  
- **Saída esperada (XML):**
  ```xml
  <work-current-task>
    <active>true|false</active>
    <file-path>.../STEP_...ACTIVE.xml</file-path>
    <next-step>step-id-or-description</next-step>
    <task-content>...conteúdo-do-xml-da-task...</task-content>
  </work-current-task>
  ```
- **Comportamento LLM:**  
  - `<active>false</active>` → `ℹ️ Nenhuma task ativa para trabalhar. Use cappy:new primeiro.`  
  - `<active>true</active>` → analisa `<task-content>` e executa próximo step conforme roteiro da task.  
- **Erro padrão:** `⚠️ workcurrent sem saída. Reexecute.`  
- **Resposta curta (ativa):** `🎯 Trabalhando na task ativa. Executando: {next-step}.`

---

### 7) 🔄 `cappy.changeTaskStatus` — Change Task Status
- **Copilot:** —  
- **Ação:** pausar/retomar **sem inventar estado**.  
- **Regra de nomenclatura (normalizada):** manter **sufixos minúsculos** nos arquivos:  
  - `*.ACTIVE.xml` ↔ `*.paused.xml`  
- **Efeitos esperados:**  
  - Renomeia arquivo (`.ACTIVE.xml` ⇄ `.paused.xml`).  
  - Atualiza `status` **no XML** (`em-andamento` ⇄ `paused`).  
  - Adiciona `<log><entry at="...">...</entry></log>`.  
- **Saída esperada (XML):**
  ```xml
  <change-status>
    <file-path-old>.../STEP_...ACTIVE.xml</file-path-old>
    <file-path-new>.../STEP_...paused.xml</file-path-new>
    <status>paused</status>
  </change-status>
  ```
- **Erro padrão:** `⚠️ changeTaskStatus sem saída. Reexecute.`  
- **Resposta curta:** `⏸️ Status alterado para paused → {novo-arquivo}.`

> **Nota:** Evite `.ACTIVE.xml/.PAUSED.xml/.DONE.xml` (maiúsculo). Use sufixos minúsculos para consistência.

---

### 8) ✅ `cappy.completeTask` — Complete Task
- **Copilot:** `cappy:taskcomplete`  
- **Ação:** finalizar a task atual **somente** se critérios atendidos.  
- **Efeitos esperados:**  
  - Atualiza `status="completed"` no XML.  
  - Move de `tasks/` para `history/` (pode renomear para `*.done.xml`).  
  - Registra timestamp de conclusão em `<log>`.  
- **Saída esperada (XML):**
  ```xml
  <complete-task>
    <from>.../tasks/STEP_...ACTIVE.xml</from>
    <to>.../history/STEP_...done.xml</to>
    <completedAt>ISO-8601</completedAt>
  </complete-task>
  ```
- **Erro padrão:** `⚠️ taskcomplete sem saída. Reexecute.`  
- **Resposta curta:** `🏁 Tarefa concluída → .cappy/history/STEP_...done.xml.`

---

### 9) 📦 `cappy.version` — Get Version
- **Copilot:** `cappy:version`  
- **Ação:** escreve a versão da extensão em `output.txt`.  
- **Saída esperada:** texto simples (ex.: `2.5.13`)  
- **Erro padrão:** `⚠️ version sem saída. Reexecute.`  
- **Resposta curta:** `📦 Cappy v{versão}.`

---

### 10) 📄 `cappy.viewTelemetryTerms` — Ver Termos de Telemetria
- **Copilot:** —  
- **Ação:** abre uma webview de consentimento de telemetria.  
- **Saída LLM:** **nenhuma** ação textual a partir de `output.txt` é necessária; trate como interação de UI.  
- **Resposta curta (quando invocado via chat):** `ℹ️ Abrindo termos de telemetria na UI.`

---

## 🧪 Validações Antes de Gravar/Avançar
1. **Atomicidade**: estimativa **≤3h**; senão, **pare** e recomende decomposição.  
2. **Critérios de aceite**: presentes e objetivos (`<doneWhen>`).  
3. **Referências/limites**: registrar `<references>` e `<constraints>`.  
4. **Sem ambiguidade**: se restar dúvida, **pergunte 1×1**.

---

## 🧷 Templates de Resposta (curtos)
- **new** → `🧩 Roteiro de nova task obtido. Próximo: cappy:createtaskfile.`
- **createtaskfile** → `✅ Task preparada: {ID} → .cappy/tasks/{ARQ}. Próximo: cappy:taskstatus.`
- **taskstatus (ativa)** → `📌 Task ativa em "{file-path}". Próximo: cappy:workcurrent.`
- **taskstatus (inativa)** → `ℹ️ Nenhuma tarefa ativa. Crie com cappy:new.`
- **workcurrent (ativa)** → `🎯 Trabalhando na task ativa. Executando: {next-step}.`
- **workcurrent (inativa)** → `ℹ️ Nenhuma task ativa para trabalhar. Use cappy:new primeiro.`
- **changeTaskStatus** → `⏸️ Status alterado para {paused|em-andamento} → {arquivo}.`
- **taskcomplete** → `🏁 Tarefa concluída → .cappy/history/{ARQ}.`
- **knowstack** → `🧠 KnowStack pronto (.cappy/stack.md).`
- **version** → `📦 Cappy v{versão}.`
- **addpreventionrule** → `➕ Nova prevention rule adicionada (ID: {id}).`
- **removepreventionrule** → `➖ Prevention rule removida (ID: {id}).`
- **erro genérico (sem saída)** → `⚠️ Comando sem saída em .cappy/output.txt. Reexecute no VS Code.`

---

## 🛡️ Prevention Rules Commands

### 11) ➕ `cappy.addPreventionRule` — Add Prevention Rule
- **Copilot:** `cappy:addpreventionrule`  
- **Ação:** adiciona nova regra de prevenção via prompts interativos.  
- **Processo:** solicita título, descrição e categoria; calcula próximo ID automaticamente.  
- **Efeitos esperados:** insere nova `<rule>` no XML; incrementa `count` do header.  
- **Saída esperada:** apenas o XML da nova regra criada.  
- **Erro padrão:** `⚠️ addPreventionRule sem saída. Reexecute.`  
- **Resposta curta:** `➕ Prevention rule adicionada (ID: {id}). Ver .cappy/prevention-rules.xml.`

### 12) ➖ `cappy.removePreventionRule` — Remove Prevention Rule  
- **Copilot:** `cappy:removepreventionrule`  
- **Ação:** remove regra existente via seleção em QuickPick.  
- **Processo:** lista rules existentes; permite seleção; remove pelo ID.  
- **Efeitos esperados:** remove `<rule>` do XML; decrementa `count` do header.  
- **Saída esperada:** apenas o ID da regra removida.  
- **Erro padrão:** `⚠️ removePreventionRule sem saída. Reexecute.`  
- **Resposta curta:** `➖ Prevention rule removida (ID: {id}). Ver .cappy/prevention-rules.xml.`

---

## 📝 Notas Finais
- **Nunca** invente resultados a partir de outros arquivos — `.cappy/output.txt` é **a única fonte de retorno**.  
- **Consistência** nos sufixos de arquivo (`.ACTIVE.xml`, `.paused.xml`, `.done.xml`) e nos estados (`prepared`, `em-andamento`, `paused`, `completed`).  
- **Logue** mudanças relevantes no `<log>` da task.
<!-- CAPPY END -->