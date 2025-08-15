<!-- CAPPY INI -->

# 🔨 Cappy — Manual de Comandos e Fluxos (LLM Runtime)

## 🎯 Objetivo
Padronizar como a LLM e o dev interagem com o Cappy para:
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
 ├─ tasks/                  # Tarefas ativas (.active.xml)
 ├─ history/                # Tarefas concluídas
 ├─ prevention-rules.md     # Regras de prevenção
 ├─ config.yaml             # Configuração do Cappy
 ├─ stack.md                # KnowStack do projeto
 └─ output.txt              # Resultado do último comando executado (fonte única)
```
> **Padrões canônicos**
> - **Nomes de arquivo**: `STEP_YYYYMMDD-HHMMSS_kebab.active.xml`
> - **Ciclo de vida**: `prepared → em-andamento → paused → completed`
> - **ID lógico** (atributo em `<Task ... id="...">`) **não** inclui `.active.xml`  
>   Ex.: arquivo `STEP_...active.xml` ↔ id `STEP_...`

---

## 🔄 Fluxo Típico
1) `cappy.init` → estrutura base do Cappy  
2) `cappy.knowstack` → analisa e (re)gera `stack.md`  
3) `cappy.getNewTaskInstruction` → roteiro/templating de nova task  
4) **(Q&A scope-first 1×1; checar ≤3h)**  
5) `cappy.createTaskFile` → cria o arquivo `*.active.xml`  
6) `cappy.getActiveTask` → status resumido (XML em `output.txt`)  
7) `cappy.changeTaskStatus` → pausar/retomar quando necessário  
8) `cappy.completeTask` → concluir e mover para `history/`

---

## 🧩 Convenções de Saída (contratos mínimos)

### `getActiveTask` — **sempre XML**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task-status>
  <active>true|false</active>
  <file-path>.../STEP_...active.xml</file-path>   <!-- null/ vazio se não houver -->
  <last-modified>ISO-8601</last-modified>
  <line-count>123</line-count>
</task-status>
```

### `createTaskFile` — **XML**
```xml
<create-task>
  <file-path>.../STEP_...active.xml</file-path>
  <id>STEP_...active.xml</id>          <!-- pode vir com extensão; ID lógico = sem ".active.xml" -->
  <status>prepared</status>
</create-task>
```

### `getNewTaskInstruction` — **XML**
```xml
<newtask>
  <template>...XML/roteiro...</template>   <!-- roteiro/templating; pode incluir placeholders -->
</newtask>
```
> **Outros comandos** podem devolver **texto simples** (ex.: `cappy.version`) ou **XML**. Em todos os casos, a leitura é **exclusiva** de `.cappy/output.txt`.

---

## ⚙️ Comandos

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

### 3) 🧩 `cappy.getNewTaskInstruction` — Get New Task Instruction
- **Copilot:** `cappy:newtask`  
- **Ação:** retorna **roteiro/templating** XML para nova task (não cria arquivo).  
- **Saída esperada (XML):**
  ```xml
  <newtask>
    <template>...XML/roteiro...</template>
  </newtask>
  ```
- **Uso LLM (scope-first 1×1):** coletar escopo, critérios, paths, deps, validação e **estimativa (≤3h)** antes de criar arquivo.  
- **Erro padrão:** `⚠️ newtask sem saída. Reexecute.`  
- **Resposta curta:** `🧩 Roteiro de nova task obtido. Próximo: cappy:createtaskfile.`

---

### 4) 📝 `cappy.createTaskFile` — Create Task File
- **Copilot:** `cappy:createtaskfile`  
- **Ação:** cria `*.active.xml` em `.cappy/tasks/` com `status="prepared"`.  
- **Saída esperada (XML):** *(ver contrato em Convenções)*  
- **Comportamento LLM após criar:**  
  1) Ler `<file-path>` do `output.txt`.  
  2) **Abrir o XML criado** e preencher: `<title>`, `<goals>`, `<constraints>`, `<references>`, `<meta><estimate>`, `<steps>` com `<doneWhen>`.  
  3) **Vincular** `<preventionLinks>` relevantes de `.cappy/prevention-rules.md`.  
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
  - `<active>false</active>` → `ℹ️ Nenhuma tarefa ativa. Use cappy:newtask.`  
  - `<active>true</active>` → ecoar resumo curto com `<file-path>` e dica do próximo passo.  
- **Erro padrão:** `⚠️ taskstatus sem saída. Reexecute.`  
- **Resposta curta (ativa):** `📌 Task ativa em "{file-path}". Próximo: executar step atual e marcar com cappy:stepdone.`

---

### 6) 🔄 `cappy.changeTaskStatus` — Change Task Status
- **Copilot:** —  
- **Ação:** pausar/retomar **sem inventar estado**.  
- **Regra de nomenclatura (normalizada):** manter **sufixos minúsculos** nos arquivos:  
  - `*.active.xml` ↔ `*.paused.xml`  
- **Efeitos esperados:**  
  - Renomeia arquivo (`.active.xml` ⇄ `.paused.xml`).  
  - Atualiza `status` **no XML** (`em-andamento` ⇄ `paused`).  
  - Adiciona `<log><entry at="...">...</entry></log>`.  
- **Saída esperada (XML):**
  ```xml
  <change-status>
    <file-path-old>.../STEP_...active.xml</file-path-old>
    <file-path-new>.../STEP_...paused.xml</file-path-new>
    <status>paused</status>
  </change-status>
  ```
- **Erro padrão:** `⚠️ changeTaskStatus sem saída. Reexecute.`  
- **Resposta curta:** `⏸️ Status alterado para paused → {novo-arquivo}.`

> **Nota:** Evite `.ACTIVE.xml/.PAUSED.xml/.DONE.xml` (maiúsculo). Use sufixos minúsculos para consistência.

---

### 7) ✅ `cappy.completeTask` — Complete Task
- **Copilot:** `cappy:taskcomplete`  
- **Ação:** finalizar a task atual **somente** se critérios atendidos.  
- **Efeitos esperados:**  
  - Atualiza `status="completed"` no XML.  
  - Move de `tasks/` para `history/` (pode renomear para `*.done.xml`).  
  - Registra timestamp de conclusão em `<log>`.  
- **Saída esperada (XML):**
  ```xml
  <complete-task>
    <from>.../tasks/STEP_...active.xml</from>
    <to>.../history/STEP_...done.xml</to>
    <completedAt>ISO-8601</completedAt>
  </complete-task>
  ```
- **Erro padrão:** `⚠️ taskcomplete sem saída. Reexecute.`  
- **Resposta curta:** `🏁 Tarefa concluída → .cappy/history/STEP_...done.xml.`

---

### 8) 📦 `cappy.version` — Get Version
- **Copilot:** `cappy:version`  
- **Ação:** escreve a versão da extensão em `output.txt`.  
- **Saída esperada:** texto simples (ex.: `2.5.13`)  
- **Erro padrão:** `⚠️ version sem saída. Reexecute.`  
- **Resposta curta:** `📦 Cappy v{versão}.`

---

### 9) 📄 `cappy.viewTelemetryTerms` — Ver Termos de Telemetria
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
- **newtask** → `🧩 Roteiro de nova task obtido. Próximo: cappy:createtaskfile.`
- **createtaskfile** → `✅ Task preparada: {ID} → .cappy/tasks/{ARQ}. Próximo: cappy:taskstatus.`
- **taskstatus (ativa)** → `📌 Task ativa em "{file-path}". Próximo: executar step atual e marcar com cappy:stepdone.`
- **taskstatus (inativa)** → `ℹ️ Nenhuma tarefa ativa. Crie com cappy:newtask.`
- **changeTaskStatus** → `⏸️ Status alterado para {paused|em-andamento} → {arquivo}.`
- **taskcomplete** → `🏁 Tarefa concluída → .cappy/history/{ARQ}.`
- **knowstack** → `🧠 KnowStack pronto (.cappy/stack.md).`
- **version** → `📦 Cappy v{versão}.`
- **erro genérico (sem saída)** → `⚠️ Comando sem saída em .cappy/output.txt. Reexecute no VS Code.`

---

## 📝 Notas Finais
- **Nunca** invente resultados a partir de outros arquivos — `.cappy/output.txt` é **a única fonte de retorno**.  
- **Consistência** nos sufixos de arquivo (`.active.xml`, `.paused.xml`, `.done.xml`) e nos estados (`prepared`, `em-andamento`, `paused`, `completed`).  
- **Logue** mudanças relevantes no `<log>` da task.

<!-- CAPPY END -->