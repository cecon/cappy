# SPEC – Chat Agent Tools

## Overview
Especificação das tools que o LangGraph Chat Engine usará para interagir com workspace, graph e sistema.

## Tools Architecture

### Core Interfaces
```typescript
// src/domains/chat/ports/tool-ports.ts
export interface IntelligentRetrieverPort {
  hybridSearch(query: string, options?: SearchOptions): Promise<RetrievalResult[]>
  expandContext(nodeIds: string[], depth: number): Promise<GraphContext>
}

export interface WorkspacePort {
  createFile(path: string, content: string): Promise<void>
  editFile(path: string, changes: FileEdit[]): Promise<void>
  searchFiles(pattern: string): Promise<string[]>
  searchText(query: string, files?: string[]): Promise<SearchResult[]>
  createDirectory(path: string): Promise<void>
  renameItem(oldPath: string, newPath: string): Promise<void>
}

export interface TerminalPort {
  executeCommand(command: string, cwd?: string): Promise<TerminalResult>
  getActiveTerminal(): Promise<Terminal | null>
}
```

## Tool Implementations

### 1. IntelligentRetrieverTool
**Propósito**: Busca híbrida usando graph + vector no SQLite (com sqlite-vec)
```typescript
interface SearchOptions {
  vectorWeight: number;    // 0-1, peso da busca vetorial
  graphWeight: number;     // 0-1, peso da busca por grafos
  maxResults: number;
  includeContext: boolean; // expandir vizinhança
  contextDepth: number;    // profundidade da expansão
}
```

**Casos de Uso**:
- "Encontre documentos relacionados a autenticação JWT"
- "Busque código que implementa caching com Redis"
- "Mostre a arquitetura completa do módulo de pagamentos"

### 2. CreateFileTool
**Propósito**: Criar novos arquivos no workspace
```typescript
interface CreateFileParams {
  path: string;           // caminho relativo do workspace
  content: string;        // conteúdo inicial
  overwrite?: boolean;    // sobrescrever se existir
}
```

**Casos de Uso**:
- "Crie um componente React para lista de usuários"
- "Gere um arquivo de teste para a função authenticate"
- "Crie um README para o módulo de payments"

### 3. ExecuteTerminalTool
**Propósito**: Executar comandos no terminal ativo
```typescript
interface TerminalParams {
  command: string;        // comando a executar
  cwd?: string;          // diretório de trabalho
  timeout?: number;      // timeout em ms
  background?: boolean;  // execução em background
}
```

**Casos de Uso**:
- "Instale a dependência lodash"
- "Execute os testes do módulo auth"
- "Faça build do projeto"
- "Inicie o servidor de desenvolvimento"

### 4. SearchTextTool
**Propósito**: Buscar texto nos arquivos do workspace
```typescript
interface TextSearchParams {
  query: string;          // texto/regex a buscar
  files?: string[];       // filtrar arquivos específicos
  caseSensitive?: boolean;
  useRegex?: boolean;
  maxResults?: number;
}
```

**Casos de Uso**:
- "Encontre todas as funções que usam 'localStorage'"
- "Busque por TODOs no código"
- "Localize imports do React em arquivos .tsx"

### 5. SearchFilesTool
**Propósito**: Buscar arquivos por nome/padrão
```typescript
interface FileSearchParams {
  pattern: string;        // glob pattern ou nome
  excludeDirectories?: string[];
  includeExtensions?: string[];
  maxResults?: number;
}
```

**Casos de Uso**:
- "Encontre todos os arquivos de teste"
- "Busque componentes React no projeto"
- "Liste arquivos de configuração"

### 6. EditFileTool
**Propósito**: Editar arquivos existentes
```typescript
interface FileEditParams {
  path: string;
  edits: FileEdit[];      // múltiplas edições
}

interface FileEdit {
  type: 'replace' | 'insert' | 'delete';
  line?: number;          // para insert/delete
  oldText?: string;       // para replace
  newText: string;
}
```

**Casos de Uso**:
- "Adicione tratamento de erro na função login"
- "Refatore a classe User para usar TypeScript"
- "Atualize a versão no package.json"

### 7. CreateDirectoryTool
**Propósito**: Criar diretórios no workspace
```typescript
interface CreateDirParams {
  path: string;           // caminho do diretório
  recursive?: boolean;    // criar pais se necessário
}
```

**Casos de Uso**:
- "Crie estrutura para novo módulo de analytics"
- "Organize os componentes em subpastas"

### 8. RenameFilesTool
**Propósito**: Renomear/mover arquivos e diretórios
```typescript
interface RenameParams {
  oldPath: string;
  newPath: string;
  updateImports?: boolean; // atualizar referencias
}
```

**Casos de Uso**:
- "Renomeie UserComponent para UserCard"
- "Mova utilities para pasta shared"
- "Reorganize estrutura de pastas"

## LangGraph Integration

### Tool Registration
```typescript
// src/adapters/secondary/agents/tools/index.ts
export function createChatTools(
  retriever: IntelligentRetrieverPort,
  workspace: WorkspacePort,
  terminal: TerminalPort
): BaseTool[] {
  return [
    new IntelligentRetrieverTool(retriever),
    new CreateFileTool(workspace),
    new ExecuteTerminalTool(terminal),
    new SearchTextTool(workspace),
    new SearchFilesTool(workspace),
    new EditFileTool(workspace),
    new CreateDirectoryTool(workspace),
    new RenameFilesTool(workspace)
  ];
}
```

### Agent Workflow
```typescript
// Exemplo de fluxo no LangGraph
const workflow = StateGraph(ChatState)
  .addNode("understand_request", understandUserRequest)
  .addNode("plan_actions", planToolUsage)
  .addNode("execute_tools", executeToolsParallel)
  .addNode("synthesize_response", synthesizeResponse)
  .addEdge("understand_request", "plan_actions")
  .addEdge("plan_actions", "execute_tools")
  .addEdge("execute_tools", "synthesize_response");
```

## Safety & Validation

### File Operations
- Validar caminhos relativos apenas
- Whitelist de extensões permitidas
- Size limits para arquivos criados
- Backup automático antes de edições

### Terminal Commands
- Blacklist de comandos perigosos (`rm -rf`, `format`, etc)
- Timeout automático
- Logs de auditoria
- Confirmação para comandos destrutivos

### Error Handling
- Retry logic para operações de I/O
- Fallback graceful quando tools falham
- User feedback claro sobre limitações
- Rollback para operações críticas

## Integration Points

### With Graph Domain
- Tools acessam GraphRepositoryPort via DI
- Resultado de retrievals pode atualizar contexto visual
- Mudanças em arquivos podem triggerar re-indexação

### With VS Code
- Tools usam VS Code APIs via adapters
- Integração com workspace trust
- Respeita configurações do usuário
- Progress indicators para operações longas

## Performance Considerations

### Caching
- Cache de resultados de busca por sessão
- Debounce para múltiplas operações similares
- Lazy loading de contexto expandido

### Concurrency
- Pool de workers para operações paralelas
- Rate limiting para API calls
- Queue system para operações sequenciais

### Memory
- Streaming de resultados grandes
- Cleanup automático de caches
- Garbage collection de sessões antigas