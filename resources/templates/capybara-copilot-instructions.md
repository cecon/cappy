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
- **Script**: Consulte `.capy/instructions/script-new-task.xml`
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

## ⌨️ PROTOCOLO DE COMANDOS LLM (capy:<comando>)

Este projeto usa comandos de chat para ativar fluxos padronizados. Sempre que o usuário digitar um comando iniciando com `capy:`, você DEVE reconhecer, validar e executar o script mapeado, de forma objetiva e sem divagações.

- Regras gerais
	- Prioridade máxima: comandos `capy:` têm precedência sobre qualquer outra interpretação.
	- Siga estritamente o script referenciado; não invente etapas.
	- Faça perguntas de clarificação sempre que necessário para não restar subjetividade e sempre uma à uma.
	- Mensagens curtas; relate ações e próximos passos, sem repetir instruções longas.
	- Tratamento de erros: se um arquivo esperado não existir, informe brevemente e use o fallback recomendado no script.


- Mapeamento de comandos
	- `cappy:newtask`
		- Ação: criar uma nova tarefa atômica em XML.
		- Script: ler e seguir `.capy/instructions/script-new-task.xml` do início ao fim.
		- Saída: arquivo criado em `.capy/tasks/STEP_<timestamp>_<kebab>.xml` com status `em-andamento`.
	- `capy:task:status`
		- Ação: exibir o status detalhado da tarefa atual/ativa.
		- Script: `.capy/instructions/script-ver-task-atual.md`.
		- Saída: resumo claro dos próximos steps e progresso.
	- `capy:step:done`
		- Ação: marcar o step atual como concluído e validar critérios.
		- Script: `.capy/instructions/script-marcar-step-concluido.md`.
		- Saída: XML atualizado com progresso incrementado.
	- `capy:task:complete`
		- Ação: finalizar a tarefa atual se todos os steps obrigatórios estiverem concluídos.
		- Script: `.capy/instructions/script-completar-task.md`.
		- Saída: mover XML para `.capy/history/` e registrar encerramento.
	- `capy:help`
		- Ação: listar os comandos disponíveis e um resumo do que cada um faz.

- Sintaxe de argumentos (opcional)
	- Comandos podem receber argumentos em linha: `cappy:newtask title="Implementar auth" area=backend`.
	- Quando suportado pelo script, aplique os argumentos diretamente (ex: título no `<title>` do XML, área em `<context><area>`).
	- Se um argumento desconhecido for passado, ignore silenciosamente e siga o padrão do script.

- Contratos de execução (resumo)
	- Entrada: string no formato `capy:<comando> [args...]`.
	- Saída: ação concreta sobre os arquivos do projeto e uma confirmação sucinta.
	- Falhas: reportar causa em uma linha e solicitar a informação mínima para continuar.

## 🛡️ **PREVENTION RULES**
As regras específicas deste projeto estão em `.capy/prevention-rules.md` (se existir).

## 🔗 **ARQUIVOS DE REFERÊNCIA**
- **Metodologia completa**: `.capy/instructions/capybara-methodology.md`
- **Padrões de código**: `.capy/instructions/capybara-patterns.md`
- **Configuração**: `.capy/config.yaml`

---
*Este arquivo é privado e não deve ser commitado. Ele contém suas instruções personalizadas para o GitHub Copilot.*