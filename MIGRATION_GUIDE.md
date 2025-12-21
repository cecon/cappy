# Guia de Migração - Cappy 3.1.3 Simplificado

## O que mudou?

### ❌ Removido Completamente

1. **Sistema RAG**
   - Não há mais vector store
   - Não há mais graph database
   - Não há mais hybrid retriever
   - Não há mais embeddings

2. **Comandos VS Code**
   - Removidos todos os comandos (`cappy.init`, `cappy.openGraph`, `cappy.scanWorkspace`, etc)
   - Use apenas o chat `@cappy`

3. **Dashboard/WebView**
   - Removido dashboard visual
   - Removido graph visualization
   - Removido documents management UI

4. **File Processing System**
   - Sem scan automático de workspace
   - Sem indexação de arquivos
   - Sem processamento em background

5. **Context Retrieval Tools**
   - `cappy_retrieve_context` - REMOVIDO
   - `cappy_workspace_search` - REMOVIDO
   - `cappy_symbol_search` - REMOVIDO

### ✅ Mantido e Simplificado

1. **Chat @cappy**
   - Funciona normalmente
   - Suporte a melhores modelos (Claude Sonnet 4.5)
   - Sem thinking loops complexos

2. **Tools Básicos**
   - `cappy_grep_search` - Busca texto em arquivos ✅
   - `cappy_read_file` - Lê conteúdo de arquivos ✅
   - `cappy_create_task_file` - Cria task XML ✅

3. **Novo: Todo System**
   - `cappy_create_todo` - Cria todos 🆕
   - `cappy_list_todos` - Lista todos 🆕
   - `cappy_complete_todo` - Completa todos 🆕

## Migração Passo a Passo

### 1. Desinstale versão antiga

```bash
# Liste extensões instaladas
code --list-extensions | grep cappy

# Desinstale se necessário
code --uninstall-extension eduardocecon.cappy
```

### 2. Instale versão simplificada

```bash
# Build e package
npm run build
npm run package

# Instale (macOS ARM)
code --install-extension cappy-3.1.3.vsix --force

# Ou abra no VS Code
open -a "Visual Studio Code" cappy-3.1.3.vsix
```

### 3. Remova dados antigos (opcional)

Se quiser limpar completamente:

```bash
# Remova banco de dados SQLite antigo
rm -rf ~/.vscode/extensions/eduardocecon.cappy-*/cappy.db*

# Remova configurações antigas
# VS Code → Settings → busque "cappy" e remova configs antigas
```

### 4. Configure LLM preferido

```json
// settings.json
{
  "cappy.llm.preferredModel": "claude-sonnet" // ou "auto", "gpt-4o", "gpt-4"
}
```

## Mudanças de Workflow

### Antes (RAG)

```typescript
// 1. Initialize workspace
await vscode.commands.executeCommand('cappy.init');

// 2. Scan workspace
await vscode.commands.executeCommand('cappy.scanWorkspace');

// 3. Wait for indexing...
await sleep(30000);

// 4. Use context retrieval
const context = await vscode.lm.invokeTool('cappy_retrieve_context', {
  query: 'authentication',
  maxResults: 10
});

// 5. Chat with context
@cappy using context from RAG...
```

### Depois (Simplificado)

```typescript
// 1. Just chat! 🎉
@cappy how does authentication work?

// Cappy usa tools grep/read_file automaticamente quando necessário
```

## Exemplos de Uso

### Chat Simples

```
@cappy explain how authentication works in this codebase
```

O Cappy vai:
1. Usar `grep_search` para encontrar "auth" no código
2. Usar `read_file` para ler arquivos relevantes
3. Responder com base no código real

### Gerenciar Todos

```
@cappy create a todo to implement JWT refresh token

@cappy show my todos

@cappy complete todo abc123
```

### Ler Código

```
@cappy read src/main.ts and explain what it does

@cappy search for "database" in all TypeScript files
```

## Breaking Changes

### ⚠️ APIs Removidas

```typescript
// ❌ NÃO EXISTE MAIS
import { HybridRetriever } from './services/hybrid-retriever';
import { EmbeddingService } from './services/embedding-service';
import { IndexingService } from './services/indexing-service';
import { VectorStore } from './vector/sqlite-vector-adapter';

// ✅ USE AGORA
import { TodoRepository } from './domains/todo/repositories/todo-repository';
import { LLMSelector } from './services/llm-selector';
```

### ⚠️ Comandos Removidos

```typescript
// ❌ NÃO FUNCIONAM MAIS
vscode.commands.executeCommand('cappy.init');
vscode.commands.executeCommand('cappy.openGraph');
vscode.commands.executeCommand('cappy.scanWorkspace');
vscode.commands.executeCommand('cappy.reanalyzeRelationships');
vscode.commands.executeCommand('cappy.diagnoseGraph');
vscode.commands.executeCommand('cappy.resetDatabase');

// ✅ USE CHAT
@cappy [sua pergunta]
```

### ⚠️ Tools Removidos

```typescript
// ❌ NÃO EXISTEM MAIS
await vscode.lm.invokeTool('cappy_retrieve_context', {...});
await vscode.lm.invokeTool('cappy_workspace_search', {...});
await vscode.lm.invokeTool('cappy_symbol_search', {...});

// ✅ USE AGORA
await vscode.lm.invokeTool('cappy_grep_search', {...});
await vscode.lm.invokeTool('cappy_read_file', {...});
await vscode.lm.invokeTool('cappy_create_todo', {...});
await vscode.lm.invokeTool('cappy_list_todos', {});
await vscode.lm.invokeTool('cappy_complete_todo', {id: '...'});
```

## Performance

### Antes
- **Tempo de inicialização**: 30-60 segundos (indexing)
- **Uso de memória**: 500-800 MB (embeddings + graph)
- **Storage**: 50-200 MB (SQLite database)
- **CPU em background**: Alto (continuous indexing)

### Depois
- **Tempo de inicialização**: < 1 segundo ⚡
- **Uso de memória**: 50-100 MB 📉
- **Storage**: < 1 MB (in-memory todos)
- **CPU em background**: Zero 🔋

## FAQ

### P: E o contexto inteligente?
**R:** O Cappy agora usa `grep_search` e `read_file` sob demanda, quando necessário. É mais simples e funciona melhor na prática.

### P: Posso voltar para versão RAG?
**R:** Sim, use git para voltar ao commit anterior:
```bash
git checkout <commit-antes-da-simplificação>
npm install
npm run build
npm run package
```

### P: Por que foi simplificado?
**R:** O sistema RAG era complexo demais e não estava entregando valor proporcional à complexidade. A versão simplificada é mais rápida, mais confiável e mais fácil de manter.

### P: Os todos são persistentes?
**R:** Não, atualmente são em memória. Para persistência, pode ser adicionado storage em arquivo JSON/SQLite em versão futura, se necessário.

### P: Posso usar outros modelos além do Claude?
**R:** Sim! Configure `cappy.llm.preferredModel` para "gpt-4o" ou "gpt-4", ou deixe em "auto" para seleção automática.

## Rollback (se necessário)

Se quiser voltar para versão RAG:

```bash
# 1. Volte ao commit anterior
git log --oneline | head -20
git checkout <commit-hash>

# 2. Reinstale dependências
npm install

# 3. Build e package
npm run build
npm run package

# 4. Instale versão antiga
code --install-extension cappy-3.1.2.vsix --force
```

## Suporte

Para problemas ou dúvidas:
1. Verifique logs: VS Code → Help → Toggle Developer Tools → Console
2. Recarregue window: `Cmd+R` (Mac) ou `Ctrl+R` (Windows/Linux)
3. Reinstale extensão se necessário

---

**Última atualização**: Dezembro 2024  
**Versão**: 3.1.3
