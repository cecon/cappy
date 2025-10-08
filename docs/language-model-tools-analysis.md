# 🔍 Análise: Language Model Tools - Cappy vs Jupyter

## ✅ O que o Cappy TEM e está correto

1. **`languageModelTools` declarado** ✅
2. **`activationEvents` com `onLanguageModelTool`** ✅
3. **Múltiplas ferramentas registradas** ✅ (13 ferramentas)
4. **`inputSchema` válido** ✅

---

## ❌ O que FALTA no Cappy (comparado com Jupyter)

### 1. **`icon` nas ferramentas**
**Jupyter tem:**
```json
{
  "name": "configure_notebook",
  "displayName": "...",
  "icon": "$(notebook)",  // ⬅️ FALTA NO CAPPY
  "canBeReferencedInPrompt": true
}
```

**Cappy NÃO tem:**
```json
{
  "name": "cappy_init",
  "displayName": "Cappy: Initialize",
  // ❌ Sem icon
  // ❌ Sem canBeReferencedInPrompt
}
```

---

### 2. **`canBeReferencedInPrompt`**
**Jupyter usa:**
```json
"canBeReferencedInPrompt": true
```

**Propósito:** Permite que a ferramenta seja **referenciada diretamente** no chat com `@tool_name`.

**Cappy:** Não possui este campo em nenhuma tool.

---

### 3. **`toolReferenceName`**
**Jupyter define:**
```json
{
  "name": "configure_notebook",
  "toolReferenceName": "configureNotebook",  // ⬅️ Nome amigável
  "canBeReferencedInPrompt": true
}
```

**Cappy:** Não possui este campo.

**Impacto:** Sem isso, LLMs podem ter dificuldade em identificar a ferramenta pelo nome.

---

### 4. **`userDescription` separado de `modelDescription`**
**Jupyter diferencia:**
```json
{
  "modelDescription": "Tool used to configure a Notebook. ALWAYS use...",  // Para o LLM
  "userDescription": "%jupyter.languageModelTools.configure_notebook.userDescription%",  // Para o usuário
}
```

**Cappy:** Usa apenas `modelDescription`, sem texto para usuário.

**Problema:** O usuário não vê uma descrição amigável no painel de ferramentas.

---

### 5. **`tags` para categorização**
**Jupyter usa tags:**
```json
{
  "tags": [
    "python environment",
    "jupyter environment",
    "extension_installed_by_tool",
    "jupyter",
    "notebooks"
  ]
}
```

**Cappy:** Não possui tags.

**Impacto:** 
- Dificulta descoberta por LLMs
- Não aparece em filtros de categoria
- Menor relevância semântica

---

### 6. **`when` conditions (conditional activation)**
**Jupyter usa:**
```json
{
  "when": "workspacePlatform != webworker"
}
```

**Cappy:** Não usa `when` em nenhuma tool.

**Benefício:** Controla quando a ferramenta é exibida (ex: apenas em workspace local, não web).

---

### 7. **Localização (i18n)**
**Jupyter:**
```json
"displayName": "%jupyter.languageModelTools.configure_notebook.displayName%"
```

Usa arquivo `package.nls.json` para traduções.

**Cappy:** Texto hardcoded em inglês.

---

## 🎯 Resumo: O que adicionar ao Cappy

### Prioridade ALTA (pode afetar visibilidade)
1. ✅ **`icon`** - Ícone visual para cada tool
2. ✅ **`canBeReferencedInPrompt: true`** - Permite referência direta
3. ✅ **`toolReferenceName`** - Nome amigável para LLMs
4. ✅ **`userDescription`** - Descrição visível ao usuário
5. ✅ **`tags`** - Categorização para descoberta

### Prioridade MÉDIA
6. **`when`** - Condições de exibição (se aplicável)

### Prioridade BAIXA
7. **Localização** - Suporte a múltiplos idiomas

---

## 📋 Exemplo de tool COMPLETA (baseado em Jupyter)

```json
{
  "name": "cappy_init",
  "displayName": "Cappy: Initialize Workspace",
  "toolReferenceName": "cappyInit",
  "modelDescription": "Initialize Cappy structure in the workspace (.cappy folder, config files, copilot-instructions.md). ALWAYS use this tool before any other Cappy operation.",
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
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

---

## 🚨 Possível causa raiz de não aparecer

A **falta de `canBeReferencedInPrompt: true`** pode estar impedindo que:
1. O VS Code Chat reconheça as tools como disponíveis
2. O Copilot liste as ferramentas no menu de tools
3. LLMs possam referenciar diretamente com `@cappy_init`

---

## 📝 Próximos passos

1. Adicionar campos ausentes em todas as 13 tools do Cappy
2. Testar com `@cappy_init` no GitHub Copilot Chat
3. Verificar se aparecem no menu de ferramentas
4. Documentar mapeamento de ícones do VSCode Codicons

---

## 📚 Referências

- [VS Code Language Model Tools API](https://code.visualstudio.com/api/extension-guides/language-model)
- [Jupyter Extension package.json](https://github.com/Microsoft/vscode-jupyter/blob/main/package.json)
- [VSCode Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon.html)
