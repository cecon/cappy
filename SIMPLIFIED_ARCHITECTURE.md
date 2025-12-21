# Cappy - Arquitetura Simplificada

## Visão Geral

Cappy foi completamente refatorado para ser um **assistente de chat simples e direto** com gerenciamento de todo list. Todo o sistema RAG (vector/graph/hybrid retriever) foi removido.

## Estrutura do Projeto

### 🎯 Core (11 arquivos principais)

```
src/
├── domains/todo/                           # Domínio Todo
│   ├── types.ts                           # Interfaces Todo
│   └── repositories/todo-repository.ts    # Storage em memória
│
├── nivel1/adapters/vscode/bootstrap/      # Inicialização
│   ├── ExtensionBootstrap.ts              # Bootstrap principal (130 linhas)
│   ├── LanguageModelToolsBootstrap.ts     # Registro de tools
│   └── index.ts                           # Exports
│
└── nivel2/infrastructure/
    ├── tools/                              # VS Code Language Model Tools
    │   ├── grep-search-tool.ts            # Busca em arquivos
    │   ├── read-file-tool.ts              # Leitura de arquivos
    │   ├── create-task-tool.ts            # Criação de tasks
    │   └── todo/                          # Todo tools
    │       ├── create-todo-tool.ts        # Criar todo
    │       ├── list-todos-tool.ts         # Listar todos
    │       └── complete-todo-tool.ts      # Completar todo
    │
    ├── agents/                             # Agentes conversacionais
    │   └── IntelligentAgent               # Agente com LLM Selector
    │
    └── services/
        └── llm-selector.ts                 # Seleção de modelo LLM
```

## Funcionalidades

### 💬 Chat
- Chat participant `@cappy` no VS Code
- Suporte a Claude Sonnet 4.5, GPT-4o, GPT-4
- Configurável via `cappy.llm.preferredModel`

### ✅ Todo List
- Criar todos: `@cappy create a todo to review PR #123`
- Listar todos: `@cappy show my todos`
- Completar: `@cappy complete todo abc123`

### 🛠️ Tools Disponíveis
1. **grep_search** - Busca texto em arquivos
2. **read_file** - Lê conteúdo de arquivos
3. **create_task_file** - Cria arquivo XML de task
4. **create_todo** - Cria novo todo
5. **list_todos** - Lista todos os todos
6. **complete_todo** - Marca todo como completo

## Configuração

```json
{
  "cappy.llm.preferredModel": "auto" // ou "claude-sonnet", "gpt-4o", "gpt-4"
}
```

## Arquitetura

### ExtensionBootstrap (Entrada)
```typescript
class ExtensionBootstrap {
  async activate(context) {
    // 1. Registra Language Model Tools
    new LanguageModelToolsBootstrap().register(context);
    
    // 2. Registra Chat Participant @cappy
    await this.registerChatParticipant(context);
  }
}
```

### LanguageModelToolsBootstrap (Tools)
```typescript
class LanguageModelToolsBootstrap {
  register(context) {
    const todoRepo = new TodoRepository();
    
    // Registra 6 tools
    vscode.lm.registerTool('cappy_grep_search', new GrepSearchTool());
    vscode.lm.registerTool('cappy_read_file', new ReadFileTool());
    vscode.lm.registerTool('cappy_create_task_file', new CreateTaskTool());
    vscode.lm.registerTool('cappy_create_todo', new CreateTodoTool(todoRepo));
    vscode.lm.registerTool('cappy_list_todos', new ListTodosTool(todoRepo));
    vscode.lm.registerTool('cappy_complete_todo', new CompleteTodoTool(todoRepo));
  }
}
```

### LLMSelector (Inteligência)
```typescript
class LLMSelector {
  async selectBestModel() {
    // Prioridade: Claude Sonnet 4.5 → GPT-4o → GPT-4 → Qualquer
    const models = await vscode.lm.selectChatModels();
    return this.findBestMatch(models);
  }
}
```

### TodoRepository (Storage)
```typescript
class TodoRepository {
  private todos = new Map<string, Todo>();
  
  create(input): Todo { /* ... */ }
  getAll(): Todo[] { /* ... */ }
  update(id, updates): Todo { /* ... */ }
  delete(id): void { /* ... */ }
}
```

## Removido (Lixo)

❌ **12.830 linhas de código deletadas:**
- Sistema RAG completo (vector/graph/hybrid retriever)
- EmbeddingService, IndexingService, HybridRetriever
- SQLite vector store (sqlite-vec)
- Graph database integrations
- FileProcessingSystem completo
- Dashboard com WebView
- Vite plugin com processamento de entidades
- 15+ comandos VS Code
- Bootstrap complexo (CommandsBootstrap, ViewsBootstrap, FileProcessingSystemBootstrap)
- Todos os testes relacionados
- Toda a documentação RAG

## Estatísticas

| Métrica | Antes | Depois |
|---------|-------|--------|
| Arquivos TS principais | ~500+ | 11 |
| Linhas de código | ~20.000+ | ~2.000 |
| Comandos VS Code | 15+ | 0 |
| Tools registrados | 8 (RAG) | 6 (simples) |
| Bootstrap files | 4 | 2 |
| Complexidade | Muito Alta | Baixa |

## Build & Deploy

```bash
# Build
npm run build

# Compile extension
npm run compile-extension

# Package
npm run package

# Install
code --install-extension cappy-X.X.X.vsix --force
```

## Uso

1. Abra VS Code
2. Use `@cappy` no chat
3. Exemplos:
   - `@cappy create a todo to fix login bug`
   - `@cappy show me all todos`
   - `@cappy complete todo abc123`
   - `@cappy search for "AuthService" in the codebase`
   - `@cappy read src/main.ts`

## Filosofia

> **"Simplicidade é a sofisticação máxima"** - Leonardo da Vinci

A nova arquitetura foca em:
- ✅ Fazer uma coisa bem feita: chat + todos
- ✅ Código limpo e manutenível
- ✅ Sem over-engineering
- ✅ Performance via simplicidade
- ✅ Fácil de entender e debugar

---

**Versão**: 3.1.3  
**Data**: Dezembro 2024  
**Status**: ✅ Produção (Simplificado)
