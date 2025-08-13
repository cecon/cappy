<!-- CAPPY INI -->
````instructions
# 🔨 Cappy — Instruções para GitHub Copilot (LLM Runtime)

## 🎯 Objetivo
Padronizar como a LLM interage com o projeto Cappy: criar/seguir tarefas em XML, registrar progresso, e transformar erros em regras de prevenção — sempre com respostas curtas, zero subjetividade e rastreabilidade.

## 🧭 Regras de Ouro (sempre)
1. **Comando manda:** mensagens começando com `cappy:` têm prioridade máxima.  
2. **Fonte única por fluxo:** siga **exatamente** os instruções dos comandos APIs referenciado para cada comando. Não invente etapas.  
3. **Clarificação atômica:** quando necessário, **pergunte 1 coisa por vez** até não restar ambiguidade.  
4. **Saídas curtas e acionáveis:** diga o que fez e o próximo passo em 2–5 linhas.  
5. **Sem “adoção criativa” de contexto:** não leia arquivos além dos explicitamente autorizados no fluxo.

---

## 🧱 Contrato de Execução (LLM)
- **Entrada:** `cappy:<comando> [args...]`
- **Ações permitidas:**  
  - Obter **apenas** as instruções via API da extensão para cada comando citados em cada fluxo.  
  - Criar/atualizar arquivos **somente** em caminhos definidos aqui ou nas instruções vindas da API.
- **Saída:** confirmação sucinta + próxima ação esperada.  
- **Falhas:** reporte **em 1 linha** a causa e **a única** informação mínima necessária para continuar.  
- **Privacidade/segurança:** não mova/importe conteúdo fora de `.cappy/` sem instrução explícita do script.

---

## 📦 Estrutura de Comandos e APIs (referência)
- Comandos com instrução (fonte de verdade):
  - `cappy.getNewTaskInstruction`  
  - `cappy.knowstack`  
  - `Cappy: task:status`  
  - `Cappy: step:done`  
  - `Cappy: task:complete`
- Regras de prevenção (opcional): `.cappy/prevention-rules.md`
- Configuração: `.cappy/config.yaml`
- Tarefas ativas: `.cappy/tasks/*.active.xml`
- Histórico: `.cappy/history/`

> Nota: para **`cappy:newtask`**, a **preferência** é usar a API da extensão do VS Code (se disponível) e, **se indisponível**, cair para o script local.

---

## ⚙️ Scripts LLM Ativos (mapeamento canônico)

### `#newtask`
- **Ação:** criar uma tarefa **atômica** em XML.
- **Script (fonte primária):** **API VS Code** `cappy.getNewTaskInstruction`  
  **Aliases aceitos:** `cappy.getNewTaskInstruction`, `cappy-get-new-task-instruction`
- **Saída (arquivo):** `.cappy/tasks/STEP_<timestamp>_<kebab>.active.xml` com `status="em-andamento"`.
- **Args suportados (se fornecidos):** `title`, `area`, `priority`, `labels`, `estimate`.

### `cappy:knowstack` (alias: `cappy:runknowstack`)
- **Ação:** preparar/validar o KnowStack do repositório.
- **API/Comando VS Code:** `cappy.knowstack` (alias suportado: `cappy.runknowstack`).
- **Fluxo LLM:**
  1) Execute o comando VS Code e capture o retorno (XML) — esta é a ÚNICA fonte de verdade.
  2) Se o retorno não puder ser capturado ou vier vazio/erro, PARE imediatamente, reporte o erro em 1 linha e NÃO use fallback local.
  3) Siga o roteiro passo a passo, com respostas curtas e objetivas.
- **Efeitos colaterais:** cria `.cappy/stack.md` se não existir e abre o arquivo; se não houver workspace aberto, apenas retorna o script.
- **Saída:** confirmação curta + próximo passo conforme o roteiro.

### `cappy:task:status`
- **Ação:** exibir status detalhado da **tarefa ativa**.
- **Script:** `.cappy/instructions/script-view-current-task.xml`
- **Resolução da tarefa ativa (ordem):**
  1) ID explícito via args (`id=...` ou `file=...`),  
  2) arquivo mais recente em `.cappy/tasks/` com `status="em-andamento"`,  
  3) se nada encontrado: peça para criar com `cappy:newtask`.

### `cappy:step:done`
- **Ação:** marcar o **step corrente** como concluído, validar critérios e avançar ponteiro.
- **Script:** `.cappy/instructions/script-marcar-step-concluido.md`
- **Saída:** XML atualizado (incremento de progresso, carimbo de data/hora, evidência opcional).

### `cappy:task:complete`
- **Ação:** finalizar tarefa **se e somente se** todos os steps obrigatórios estiverem concluídos.
- **Script:** `.cappy/instructions/script-completar-task.md`
- **Saída:** mover o XML para `.cappy/history/` registrando encerramento (data, autor, notas finais).

### `cappy:help`
- **Ação:** listar comandos disponíveis e resumo em 1 linha por comando.

---

## 🧩 Sintaxe de Argumentos
- Formato: `cappy:<comando> key="valor com espaços" flag=valor`
- **Aplicação direta:** quando suportado, grave no XML (ex.: `<title>`, `<context><area>`, `<meta><priority>`).
- **Desconhecidos:** ignore silenciosamente.

---

## 🗂️ Esquema mínimo do XML de Tarefa (contrato)
```xml
<Task version="1.0" status="em-andamento" id="STEP_2025-08-11_123456_kebab">
  <title>...</title>
  <context>
    <area>backend|frontend|devops|docs|research</area>
    <repo>...</repo>
    <branch>...</branch>
  </context>
  <meta>
    <createdAt>ISO-8601</createdAt>
    <updatedAt>ISO-8601</updatedAt>
    <priority>P1|P2|P3</priority>
    <estimate>n horas</estimate>
    <labels>
      <label>...</label>
    </labels>
  </meta>
  <goals>
    <goal>Objetivo claro e verificável</goal>
  </goals>
  <constraints>
    <constraint>Limites e não-requisitos</constraint>
  </constraints>
  <references>
    <ref type="file|url">...</ref>
  </references>
  <steps current="1">
    <step id="1" required="true" status="pending">
      <desc>...</desc>
      <inputs>...</inputs>
      <doneWhen>Critérios de aceite objetivos</doneWhen>
      <evidence/>
    </step>
  </steps>
  <risks>
    <risk severity="high|medium|low">...</risk>
  </risks>
  <preventionLinks>
    <ruleRef id="PR-xxx">.cappy/prevention-rules.md#PR-xxx</ruleRef>
  </preventionLinks>
  <log>
    <entry at="ISO-8601">Evento curto</entry>
  </log>
</Task>
```

---

## 🧪 Validações obrigatórias antes de gravar
1. **Atomicidade:** 1 tarefa = 1 objetivo entregável.  
2. **Critérios de aceite** presentes nos steps obrigatórios.  
3. **Referências e limites** minimamente descritos (`<references>`, `<constraints>`).  
4. **Sem ambiguidade detectada:** se houver, **pare** e pergunte **uma** clarificação.

---

## 🧰 Templates de Resposta (curtos)

**`cappy:newtask ...`**  
- “✅ Nova tarefa criada: `STEP_..._kebab` → `.cappy/tasks/...`. Próximo: `cappy:taskstatus` para ver passos.”

**`cappy:taskstatus`**  
- “📌 Tarefa `STEP_...`: 3/7 steps. Atual: #4 ‘…’. Próximo: execute o step e marque com `cappy:stepdone`.”

**`cappy:stepdone`**  
- “✅ Step #4 concluído. Atualizei progresso (4/7). Próximo step: #5 ‘…’. Critérios: ‘…’.”

**`cappy:taskcomplete`**  
- “🏁 Tarefa finalizada. Movida para `.cappy/history/STEP_...xml`. Adicionei nota de encerramento.”

**`cappy:knowstack` / `cappy:runknowstack`**  
- “🧠 KnowStack pronto. Abri `.cappy/stack.md`. Vou seguir o roteiro retornado.”

**Erro/falta de script**  
- “⚠️ Não foi possível obter o roteiro do KnowStack via comando VS Code. Interrompendo. Reexecute `cappy.knowstack`.”

---

## 🛡️ Prevention Rules (ganhos de aprendizado)
- Se existir `.cappy/prevention-rules.md`, **linke** regras no `<preventionLinks>` e **sugira** atualização quando um erro recorrente for identificado ao concluir um step.  
- Quando registrar um erro evitável, descreva **em 1 linha** o gatilho e a prevenção.

---

## 🧭 Resolução de “tarefa ativa”
1) `id`/`file` nos argumentos → usar.  
2) Caso contrário, escolher a **mais recente** em `.cappy/tasks/` com `status="em-andamento"`.  
3) Se nada existir → orientar `cappy:newtask`.

---

## 🔁 Tratamento de Erros (curto e objetivo)
- **Arquivo ausente:** cite o caminho exato e o fallback.  
- **XML inválido:** diga o nó faltante e peça apenas aquela informação.  
- **Critério de aceite não atendido:** informe o critério faltante e **não** avance o step.  
- **Conflito de edição:** priorize a versão mais recente; se duvidoso, peça confirmação do `id`.

---

## 📝 Notas finais
- Padronize o **kebab-case** do `id` e alias dos comandos.  
- Mantenha coerência: `cappy:taskstatus` (não use `cappy:task:status`).

````
<!-- CAPPY END -->