# Fluxo de Trabalho de Tasks - Cappy

## Overview

O Cappy usa um sistema de duas fases para gerenciar tarefas de desenvolvimento:
1. **Planning Agent** (você está aqui) - Cria tasks detalhadas
2. **Development Agent** - Executa as tasks

## Estrutura de Diretórios

```
.cappy/
├── tasks/           # Tasks pendentes (ativas)
│   └── TASK_2025-10-23-14-30-45_implementar-cache.md
└── history/         # Tasks completadas (arquivadas)
    └── 2025-10/
        └── TASK_2025-10-23-14-30-45_implementar-cache.md
```

## Fase 1: Planning Agent (Criação de Task)

### Responsabilidades

1. **Coletar Contexto**
   - Usar `cappy_retrieve_context` extensivamente
   - Buscar arquivos relevantes, documentação, patterns
   - Incluir números de linha nas referências

2. **Fazer Perguntas**
   - Uma pergunta por vez
   - Esperar resposta antes da próxima
   - Eliminar todas as dúvidas antes de criar a task

3. **Estruturar a Task**
   ```markdown
   # Título da Task
   
   ## Context
   - Recursos necessários com paths e linhas
   
   ## Objective
   - Objetivo claro e mensurável
   
   ## Steps
   ### 1. Nome do Step
   **Dependencies**: Nenhum ou Step X
   **Instructions**: Lista detalhada
   **Deliverables**: Checkboxes
   **Acceptance Criteria**: Como validar
   **Context References**: Arquivos e linhas
   
   ### N. Finalize and Archive Task (OBRIGATÓRIO)
   - Mover para .cappy/history/YYYY-MM/
   - Adicionar resumo de conclusão
   - Rodar scan do workspace
   
   ## Estimated Effort
   ## Why It Matters
   ## Prevention Rules
   ## Validation Checklist
   ```

4. **Salvar Task**
   - Formato: `TASK_YYYY-MM-DD-HH-MM-SS_SLUG.md`
   - Local: `.cappy/tasks/`
   - Marcar com `<!-- agent:done -->`

5. **Mensagem Final**
   ```
   ✅ Task concluída com sucesso!
   📄 Arquivo criado: `.cappy/tasks/TASK_...md`
   📋 Resumo: [2-3 sentenças]
   ```

## Fase 2: Development Agent (Execução de Task)

### Responsabilidades

1. **Ler a Task**
   - Arquivo em `.cappy/tasks/`
   - Entender contexto e objetivos
   - Seguir steps em ordem

2. **Executar Steps**
   - Marcar deliverables conforme completa
   - Validar acceptance criteria
   - Seguir context references para localizar código

3. **Step Final Obrigatório: "Finalize and Archive Task"**
   
   **3.1. Adicionar Resumo de Conclusão**
   ```markdown
   # Task Completion Summary
   
   **Status**: ✅ Completed
   **Date**: YYYY-MM-DD
   **Duration**: X hours
   **Completed By**: Development Agent
   
   ## Summary
   [2-3 sentenças sobre o que foi feito]
   
   **Key Files Modified**:
   - arquivo1.ts - descrição
   - arquivo2.ts - descrição
   
   **Performance Impact**: (se aplicável)
   - Métrica 1: valor
   - Métrica 2: valor
   
   ---
   
   [Resto do conteúdo original da task]
   ```
   
   **3.2. Mover para History**
   ```bash
   # Criar diretório se não existir
   mkdir -p .cappy/history/2025-10
   
   # Mover arquivo
   mv .cappy/tasks/TASK_2025-10-23-14-30-45_implementar-cache.md \
      .cappy/history/2025-10/
   ```
   
   **3.3. Atualizar Database**
   - Executar: "Cappy: Scan Workspace" no VS Code
   - Ou usar tool: `cappy_scan_workspace` (se disponível)
   - Verificar que novo código está indexado

4. **Validação Final**
   - Todos os checkboxes marcados ✅
   - Acceptance criteria validados
   - Arquivo movido para history
   - Database atualizado

## Por Que Este Fluxo?

### 1. Separação de Responsabilidades
- **Planning Agent**: Foco em clareza, contexto, estrutura
- **Development Agent**: Foco em execução, implementação, código

### 2. Rastreabilidade
- Tasks em `.cappy/tasks/` = trabalho pendente
- Tasks em `.cappy/history/` = trabalho concluído
- Fácil auditoria e histórico

### 3. Knowledge Base Atualizado
- Scan após conclusão garante que novo código é indexado
- Retriever sempre tem contexto atualizado
- Próximas tasks podem referenciar código recém-criado

### 4. Documentação Automática
- Resumo de conclusão documenta o que foi feito
- Métricas de performance registradas
- Histórico organizados por mês

## Exemplo Completo

Veja os arquivos:
- **Task Pendente**: `.cappy/tasks/TASK_EXAMPLE.md`
- **Task Completada**: `.cappy/history/TASK_COMPLETED_EXAMPLE.md`

## Comandos Úteis

```bash
# Listar tasks pendentes
ls .cappy/tasks/

# Listar tasks completadas do mês
ls .cappy/history/2025-10/

# Criar diretório de history para o mês atual
mkdir -p .cappy/history/$(date +%Y-%m)

# Mover task completada
mv .cappy/tasks/TASK_*.md .cappy/history/$(date +%Y-%m)/
```

## Checklist para Planning Agent

Antes de marcar `<!-- agent:done -->`, verificar:

- [ ] Task tem título descritivo
- [ ] Context section lista todos recursos necessários com paths e linhas
- [ ] Objective é claro e mensurável
- [ ] Cada step tem: dependencies, instructions, deliverables, acceptance criteria, context references
- [ ] **Step final "Finalize and Archive Task" está presente**
- [ ] Estimated effort é realista
- [ ] Why It Matters explica o valor
- [ ] Prevention Rules lista riscos comuns
- [ ] Validation Checklist é verificável

## Checklist para Development Agent

Antes de arquivar a task, verificar:

- [ ] Todos os steps executados
- [ ] Todos os deliverables marcados ✅
- [ ] Acceptance criteria validados
- [ ] Resumo de conclusão adicionado ao topo do arquivo
- [ ] Arquivo movido para `.cappy/history/YYYY-MM/`
- [ ] Workspace scan executado
- [ ] Novo código está searchable no retriever
