<!-- CAPPY INI -->
# 🔨 Cappy — Instruções para GitHub Copilot (LLM Runtime)

## 🎯 Objetivo
Padronizar como a LLM interage com o projeto Cappy:
- Criar e seguir **tarefas em XML**.
- Registrar progresso.
- Transformar erros em **Regras de Prevenção**.
- Sempre usar **respostas curtas, sem subjetividade, com rastreabilidade**.

---

## 🧭 Regras de Ouro
1. **Comando manda** — mensagens começando com `cappy:` têm prioridade máxima.  
2. **Fonte única de retorno** — sempre que executar um comando no VS Code, o retorno oficial estará **exclusivamente** em `.cappy/output.txt` se o comando gerar saída.  
   - Se o arquivo não existir ou estiver vazio, interrompa e informe que não é possível seguir.  
3. **Clarificação atômica** — se houver dúvida, pergunte **uma coisa por vez** até não restar ambiguidade.  
4. **Saídas curtas** — máximo 2–5 linhas, sempre com o próximo passo claro.  
5. **Sem contexto extra** — não leia arquivos não autorizados.

---

## 📂 Estrutura de Arquivos

.cappy/
├─ tasks/ # Tarefas ativas (.active.xml)
├─ history/ # Tarefas concluídas
├─ prevention-rules.md # Regras de prevenção
├─ config.yaml # Configuração (opcional)
├─ output.txt # Resultado do último comando executado


---

## ⚙️ Comandos e Fluxos

### `cappy:newtask`
- **Ação:** cria uma nova tarefa **atômica** em XML.  
- **Fonte única de retorno:**  
  - Resultado escrito em `.cappy/output.txt` é a **única fonte válida**.  
  - **Se não existir ou estiver vazio:**  
    `⚠️ Não foi possível criar a tarefa. Comando não retornou saída. Reexecute no VS Code.`  
- **API/Comando VS Code:** `cappy.getNewTaskInstruction`  
- **Args suportados:** `title`, `area`, `priority`, `labels`, `estimate`  
- **Arquivo final esperado:** `.cappy/tasks/STEP_<timestamp>_<kebab>.active.xml` (status `em-andamento`)

---

### `cappy:taskstatus` _(usar este nome, sem “:” interno)_
- **Ação:** retorna o **status detalhado** da tarefa ativa.  
- **Fonte única de retorno:** `.cappy/output.txt`.  
  - **Se não existir ou estiver vazio:**  
    `⚠️ Não foi possível obter o status. Comando não retornou saída. Reexecute no VS Code.`  
- **API/Comando VS Code:** `cappy.getActiveTask`  
- **Resolução de tarefa ativa:**  
  1) `id`/`file` via argumentos;  
  2) mais recente em `.cappy/tasks/` com `status="em-andamento"`;  
  3) se nada existir, a própria resposta deve orientar a criar com `cappy:newtask`.  

---

### `cappy:knowstack` _(alias: `cappy:runknowstack`)_
- **Ação:** prepara/valida o **KnowStack** e fornece o roteiro a seguir.  
- **Fonte única de retorno:** `.cappy/output.txt`.  
  - **Se não existir ou estiver vazio:**  
    `⚠️ Não foi possível obter o roteiro do KnowStack. Comando não retornou saída. Reexecute no VS Code.`  
- **API/Comando VS Code:** `cappy.knowstack` (alias `cappy.runknowstack`)  
- **Efeitos esperados:** pode criar/abrir `.cappy/stack.md`.  

---

### `cappy:version`
- **Ação:** retorna a **versão** atual da extensão Cappy.  
- **Fonte única de retorno:** `.cappy/output.txt`.  
  - **Se não existir ou estiver vazio:**  
    `⚠️ Não foi possível ler a versão. Comando não retornou saída. Reexecute no VS Code.`  
- **API/Comando VS Code:** `cappy.version`  
- **Saída esperada:** ex.: `2.5.11`  

---

### `cappy:stepdone`
- **Ação:** marca o **step corrente** como concluído, valida critérios e avança o ponteiro.  
- **Fonte única de retorno:** `.cappy/output.txt`.  
  - **Se não existir ou estiver vazio:**  
    `⚠️ Não foi possível concluir o step. Comando não retornou saída. Reexecute no VS Code.`  
- **Script envolvido:** `.cappy/instructions/script-marcar-step-concluido.md`  
- **Efeitos esperados:** atualização do XML (progresso, timestamps, evidências se aplicável).

---

### `cappy:taskcomplete`
- **Ação:** finaliza a tarefa **apenas** se todos os steps obrigatórios estiverem concluídos.  
- **Fonte única de retorno:** `.cappy/output.txt`.  
  - **Se não existir ou estiver vazio:**  
    `⚠️ Não foi possível finalizar a tarefa. Comando não retornou saída. Reexecute no VS Code.`  
- **Script envolvido:** `.cappy/instructions/script-completar-task.md`  
- **Efeitos esperados:** mover XML para `.cappy/history/` com registro de encerramento.

---

### `cappy:help`
- **Ação:** lista comandos disponíveis com resumo de 1 linha por comando.  
- **Fonte única de retorno:** `.cappy/output.txt`.  
  - **Se não existir ou estiver vazio:**  
    `⚠️ Não foi possível listar os comandos. Comando não retornou saída. Reexecute no VS Code.`  

---

## 📜 Observações Gerais
- Sempre **execute o comando** e **leia `.cappy/output.txt`**.  
- **Sem fallback manual:** se não houver saída, **pare** e informe a falha em 1 linha.  
- **Resposta curta (2–5 linhas):** descreva o que aconteceu + próximo passo.  
- **Sem inventar dados** a partir de outros arquivos ou contexto.  

---

## 🧩 Template de Resposta Curta

**`cappy:newtask`**  
`✅ Nova tarefa criada: STEP_..._kebab → .cappy/tasks/... Próximo: cappy:taskstatus.`

**`cappy:taskstatus`**  
`📌 Tarefa STEP_...: 3/7 steps. Atual: #4 '…'. Próximo: cappy:stepdone.`

**`cappy:stepdone`**  
`✅ Step #4 concluído (4/7). Próximo: #5 '…'. Critérios: '…'.`

**`cappy:taskcomplete`**  
`🏁 Tarefa finalizada. Movida para .cappy/history/STEP_...xml.`

**`cappy:knowstack`**  
`🧠 KnowStack pronto. Abri .cappy/stack.md.`

**Erro/falta de script**  
`⚠️ Falha ao obter retorno. Reexecute o comando no VS Code.`

---


<!-- CAPPY END -->