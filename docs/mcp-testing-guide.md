# Como Testar a Configuração MCP

## ✅ Versão Corrigida: 2.9.64

A configuração MCP agora cria corretamente o arquivo `.vscode/mcp.json` no workspace.

---

## 🧪 Teste Passo a Passo

### 1. Recarregar VS Code

```
Ctrl+Shift+P > Developer: Reload Window
```

### 2. Abrir um Workspace de Teste

Crie ou abra uma pasta qualquer para testar.

### 3. Executar Inicialização do Cappy

```
Ctrl+Shift+P > Cappy: Initialize Project
```

### 4. Verificar o Arquivo Criado

Após a execução, você deve ver:

```
✅ MCP Server configurado para VS Code! Reinicie o editor para ativar.
```

### 5. Verificar o Arquivo `.vscode/mcp.json`

Abra o arquivo `.vscode/mcp.json` no workspace:

```json
{
  "mcpServers": {
    "cappy": {
      "command": "node",
      "args": [
        "C:\\Users\\seu-usuario\\.vscode\\extensions\\eduardocecon.cappy-2.9.64\\out\\extension.mcp.js"
      ],
      "env": {
        "NODE_ENV": "production"
      },
      "description": "Cappy Memory - Context Orchestration and RAG System"
    }
  }
}
```

### 6. Reiniciar VS Code

```
Ctrl+Shift+P > Developer: Reload Window
```

### 7. Verificar se MCP está Ativo

Abra o Output do Cappy:

```
View > Output > Selecione "Cappy" no dropdown
```

Procure por mensagens como:

```
🦫 Cappy MCP: Starting activation...
🛠️ Cappy MCP: CappyRAG MCP tools registered
```

---

## 🔍 Verificação Manual

### Verificar Estrutura do Workspace

Após `cappy.init`, seu workspace deve ter:

```
seu-projeto/
├─ .cappy/
│  ├─ config.yaml
│  ├─ stack.md
│  ├─ schemas/
│  ├─ tasks/
│  └─ history/
└─ .vscode/
   └─ mcp.json  👈 NOVO!
```

### Verificar Conteúdo do mcp.json

O arquivo deve ter:
- ✅ `mcpServers` object
- ✅ `cappy` server configurado
- ✅ Caminho correto para `extension.mcp.js`
- ✅ Environment variable `NODE_ENV`

---

## 🐛 Troubleshooting

### Arquivo não foi criado?

1. Verifique se você está em um workspace válido
2. Verifique os logs: `View > Output > Cappy`
3. Tente criar manualmente:
   ```json
   // .vscode/mcp.json
   {
     "mcpServers": {
       "cappy": {
         "command": "node",
         "args": ["SEU_CAMINHO/out/extension.mcp.js"],
         "env": { "NODE_ENV": "production" }
       }
     }
   }
   ```

### MCP não está ativo após reiniciar?

1. Verifique se o caminho em `args` está correto
2. Teste o comando manualmente:
   ```powershell
   node "C:\caminho\para\extension.mcp.js"
   ```
3. Verifique se não há erros de sintaxe no JSON

### Arquivo já existia?

Se `.vscode/mcp.json` já existia, o Cappy:
- ✅ Lê o arquivo existente
- ✅ Adiciona o servidor `cappy` se não existir
- ✅ Mantém outras configurações intactas
- ✅ Não sobrescreve configurações existentes

---

## 📊 Comparação: Antes vs Depois

### ❌ Versão 2.9.63 (Incorreta)

```
Tentava criar em: settings.json (global)
❌ Arquivo errado
❌ Local errado
❌ Não funcionava
```

### ✅ Versão 2.9.64 (Corrigida)

```
Cria em: .vscode/mcp.json (workspace)
✅ Arquivo correto
✅ Local correto
✅ Funciona!
```

---

## 🎯 Próximos Passos

Após verificar que o MCP está configurado:

1. **Testar comandos MCP:**
   - `cappyrag.addDocument`
   - `cappy.query`
   - `cappyrag.getStats`

2. **Integrar com Copilot Chat:**
   - Use `@workspace` no chat
   - Pergunte sobre documentos indexados

3. **Verificar Dashboard:**
   ```
   Ctrl+Shift+P > CappyRAG: Upload Documents
   ```

---

**Obrigado por reportar o problema! A versão 2.9.64 está corrigida.** 🦫✨
