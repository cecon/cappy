# 🚀 Release Notes - Cappy 2.9.72

**Data:** 2025-10-07

---

## 🎯 Objetivo da Release

Implementação completa da API de Language Model Tools do VS Code para garantir visibilidade e integração com GitHub Copilot Chat e outros LLMs.

---

## ✨ Novidades

### 🔧 **Language Model Tools - Campos Críticos Adicionados**

Todas as 13 ferramentas do Cappy agora possuem os campos necessários para aparecer no GitHub Copilot Chat e ferramentas de LLM:

#### **Campos Adicionados:**

1. ✅ **`icon`** - Ícones visuais usando VSCode Codicons
   - `$(symbol-folder)` para cappy_init
   - `$(rocket)` para cappy_knowstack
   - `$(notebook)` para cappy_new_task
   - `$(play-circle)` para cappy_work_on_task
   - `$(search)` para cappyrag_query
   - E mais...

2. ✅ **`canBeReferencedInPrompt: true`** - Habilita referência direta no chat
   - Agora é possível usar `@cappyInit` no Copilot Chat
   - Todas as ferramentas podem ser referenciadas diretamente

3. ✅ **`toolReferenceName`** - Nome amigável para LLMs
   - `cappyInit`, `cappyKnowStack`, `cappyNewTask`, etc.
   - Facilita descoberta e invocação por modelos de linguagem

4. ✅ **`userDescription`** - Descrição visível ao usuário
   - Separado de `modelDescription` (para o LLM)
   - Texto amigável para interface do usuário

5. ✅ **`tags`** - Categorização e descoberta
   - Tags semânticas: `cappy`, `task management`, `workflow`
   - Tags RAG: `cappyrag`, `knowledge base`, `semantic search`
   - Tag especial: `extension_installed_by_tool`

---

## 📋 Ferramentas Atualizadas

### **Cappy Core (7 ferramentas)**

1. **cappy_init** (`@cappyInit`)
   - Icon: `$(symbol-folder)`
   - Tags: initialization, workspace setup

2. **cappy_knowstack** (`@cappyKnowStack`)
   - Icon: `$(rocket)`
   - Tags: analysis, technology stack

3. **cappy_new_task** (`@cappyNewTask`)
   - Icon: `$(notebook)`
   - Tags: task creation, planning

4. **cappy_create_task** (`@cappyCreateTask`)
   - Icon: `$(file-add)`
   - Tags: xml, context orchestration

5. **cappy_work_on_task** (`@cappyWorkOnTask`)
   - Icon: `$(play-circle)`
   - Tags: task execution, prevention

6. **cappy_complete_task** (`@cappyCompleteTask`)
   - Icon: `$(check-all)`
   - Tags: learning capture, completion

7. **cappy_reindex** (`@cappyReindex`)
   - Icon: `$(refresh)`
   - Tags: indexing, semantic search

### **CappyRAG (6 ferramentas)**

8. **cappyrag_add_document** (`@cappyRagAddDocument`)
   - Icon: `$(file-add)`
   - Tags: document processing, rag

9. **cappyrag_query_knowledge_base** (`@cappyRagQuery`)
   - Icon: `$(search)`
   - Tags: hybrid search, retrieval

10. **cappyrag_get_stats** (`@cappyRagStats`)
    - Icon: `$(graph)`
    - Tags: statistics, monitoring

11. **cappyrag_get_supported_formats** (`@cappyRagFormats`)
    - Icon: `$(file-code)`
    - Tags: formats, capabilities

12. **cappyrag_estimate_processing_time** (`@cappyRagEstimate`)
    - Icon: `$(watch)`
    - Tags: estimation, performance

---

## 🔍 Comparação: Antes vs Depois

### **Antes (2.9.71)**
```json
{
  "name": "cappy_init",
  "displayName": "Cappy: Initialize",
  "modelDescription": "Initialize Cappy structure...",
  "inputSchema": { ... }
}
```

### **Depois (2.9.72)**
```json
{
  "name": "cappy_init",
  "displayName": "Cappy: Initialize Workspace",
  "toolReferenceName": "cappyInit",
  "modelDescription": "Initialize Cappy structure... ALWAYS use this tool before...",
  "userDescription": "Set up Cappy's file structure and configuration for the current workspace",
  "icon": "$(symbol-folder)",
  "canBeReferencedInPrompt": true,
  "tags": [
    "cappy",
    "initialization",
    "workspace setup",
    "task management",
    "extension_installed_by_tool"
  ],
  "inputSchema": { ... }
}
```

---

## 🎨 Ícones por Categoria

| Categoria | Ferramenta | Ícone | Significado |
|-----------|-----------|-------|-------------|
| Setup | cappy_init | `$(symbol-folder)` | Estrutura de pastas |
| Análise | cappy_knowstack | `$(rocket)` | Exploração do projeto |
| Planejamento | cappy_new_task | `$(notebook)` | Anotações/Roteiro |
| Criação | cappy_create_task | `$(file-add)` | Novo arquivo |
| Execução | cappy_work_on_task | `$(play-circle)` | Reproduzir/Executar |
| Conclusão | cappy_complete_task | `$(check-all)` | Check completo |
| Manutenção | cappy_reindex | `$(refresh)` | Atualizar |
| Documento | cappyrag_add_document | `$(file-add)` | Adicionar arquivo |
| Busca | cappyrag_query | `$(search)` | Pesquisar |
| Estatísticas | cappyrag_stats | `$(graph)` | Gráfico/Dados |
| Formatos | cappyrag_formats | `$(file-code)` | Tipos de arquivo |
| Estimativa | cappyrag_estimate | `$(watch)` | Tempo/Relógio |

---

## 🔗 Integração com GitHub Copilot

### Como usar as ferramentas no Copilot Chat:

1. **Referência direta:**
   ```
   @cappyInit - inicialize o Cappy
   ```

2. **Em contexto:**
   ```
   Use @cappyKnowStack para analisar o projeto
   ```

3. **Fluxo completo:**
   ```
   1. @cappyInit
   2. @cappyKnowStack
   3. @cappyNewTask para criar uma task
   4. @cappyWorkOnTask para executar
   ```

---

## 📚 Documentação Adicional

### Arquivos Criados:
- **`docs/language-model-tools-analysis.md`** - Análise comparativa detalhada vs Jupyter
- Inclui referências de ícones VSCode Codicons
- Guia de boas práticas para Language Model Tools

---

## 🧪 Como Testar

1. **Recarregue o VS Code** após instalação
2. **Abra GitHub Copilot Chat** (Ctrl+Alt+I)
3. **Digite `@` e procure por:**
   - `@cappyInit`
   - `@cappyKnowStack`
   - `@cappyRagQuery`
4. **Verifique se os ícones aparecem** na lista de ferramentas
5. **Teste referência direta:** `@cappyInit configure o workspace`

---

## 🐛 Possíveis Issues

### Se as ferramentas não aparecerem:

1. **Recarregue completamente o VS Code:**
   - Ctrl+Shift+P → "Reload Window"

2. **Verifique ativação:**
   - Abra Output → Cappy
   - Deve mostrar "Language Model Tools registered: 13"

3. **Teste comando direto:**
   - Ctrl+Shift+P → "Cappy: Initialize"

4. **Verifique versão:**
   - Deve ser 2.9.72

---

## 📊 Métricas da Release

- **13 ferramentas atualizadas**
- **5 novos campos críticos** por ferramenta
- **65 linhas de metadados** adicionadas
- **12 ícones únicos** do VSCode Codicons
- **60+ tags semânticas** para descoberta

---

## 🔄 Próximos Passos

1. Monitorar feedback de usuários sobre visibilidade das tools
2. Considerar adicionar `when` conditions para controle contextual
3. Implementar i18n (localização) se houver demanda
4. Otimizar `modelDescription` baseado em uso real

---

## 🙏 Créditos

Análise baseada em comparação com:
- **Microsoft Jupyter Extension** (ms-toolsai.jupyter)
- [VS Code Language Model API Docs](https://code.visualstudio.com/api/extension-guides/language-model)
- [VSCode Codicons Reference](https://microsoft.github.io/vscode-codicons/dist/codicon.html)

---

## 📦 Instalação

```bash
# Via Marketplace
code --install-extension eduardocecon.cappy

# Via VSIX local
code --install-extension cappy-2.9.72.vsix
```

---

**Changelog completo:** Ver `changelog.md`
**Issues:** https://github.com/cecon/cappy/issues
