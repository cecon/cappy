# Arquitetura Hexagonal - Diagrama Visual

## Estrutura de Camadas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          VITE PLUGIN (Entry Point)                       │
│                      vite-plugin-cappy-dev-refactored.ts                 │
│                                                                           │
│  - Inicializa todos os componentes                                       │
│  - Configura middlewares HTTP e WebSocket                                │
│  - Orquestra comunicação entre camadas                                   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER (Use Cases)                     │
│                         src/vite-plugin/application/                     │
│                                                                           │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ DocumentManagement  │  │ DebugAnalyze     │  │  GraphAPIHandler │   │
│  │                     │  │  UseCase         │  │                  │   │
│  │ - refreshDocuments  │  │ - analyzeViaWS   │  │ - handle()       │   │
│  │ - scanDocuments     │  │ - analyzeViaHTTP │  │                  │   │
│  └─────────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                           │
│  ┌─────────────────────┐  ┌──────────────────┐                          │
│  │ TasksAPIHandler     │  │ ChatAPIHandler   │                          │
│  │                     │  │                  │                          │
│  │ - handle()          │  │ - handle()       │                          │
│  └─────────────────────┘  └──────────────────┘                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
┌───────────────────────────────────┐  ┌───────────────────────────────────┐
│    DOMAIN LAYER (Business Logic)  │  │   ADAPTERS (Infrastructure)       │
│    src/vite-plugin/domain/         │  │   src/vite-plugin/adapters/       │
│                                    │  │                                   │
│  ┌────────────────────────────┐   │  │  ┌────────────────────────────┐  │
│  │ TypeScriptAnalyzer         │   │  │  │ WSServerAdapter            │  │
│  │                            │   │  │  │                            │  │
│  │ - analyze()                │   │  │  │ - start()                  │  │
│  │ - extractSignatures()      │   │  │  │ - broadcast()              │  │
│  │ - extractJSDocChunks()     │   │  │  │ - onConnection()           │  │
│  └────────────────────────────┘   │  │  └────────────────────────────┘  │
│                                    │  │                                   │
│  ┌────────────────────────────┐   │  │  ┌────────────────────────────┐  │
│  │ PHPAnalyzer                │   │  │  │ NodeFileSystemAdapter      │  │
│  │                            │   │  │  │                            │  │
│  │ - analyze()                │   │  │  │ - exists()                 │  │
│  │                            │   │  │  │ - readFile()               │  │
│  └────────────────────────────┘   │  │  │ - writeFile()              │  │
│                                    │  │  └────────────────────────────┘  │
│  ┌────────────────────────────┐   │  │                                   │
│  │ EntityProcessingPipeline   │   │  │  ┌────────────────────────────┐  │
│  │                            │   │  │  │ DevServerBridgeAdapter     │  │
│  │ - process()                │   │  │  │                            │  │
│  └────────────────────────────┘   │  │  │ - connect()                │  │
│                                    │  │  │ - send()                   │  │
└───────────────┬────────────────────┘  │  │ - isConnected()            │  │
                │                       │  └────────────────────────────┘  │
                │                       │                                   │
                │                       │  ┌────────────────────────────┐  │
                │                       │  │ SimpleHTTPRouter           │  │
                │                       │  │                            │  │
                │                       │  │ - register()               │  │
                │                       │  │ - route()                  │  │
                │                       │  └────────────────────────────┘  │
                │                       └───────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PORTS (Interfaces/Contracts)                      │
│                         src/vite-plugin/ports/                           │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ IWebSocketServer │  │ IHTTPHandler     │  │ IFileSystem      │      │
│  │ IWebSocketClient │  │ IHTTPRouter      │  │                  │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐                             │
│  │ IBridge          │  │ ICodeAnalyzer    │                             │
│  │                  │  │ IEntityPipeline  │                             │
│  └──────────────────┘  └──────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Fluxo de uma Requisição

### Exemplo 1: Análise de Arquivo (Debug/Analyze)

```
1. Frontend envia mensagem WebSocket
   │
   ▼
2. WSServerAdapter recebe via IWebSocketClient
   │
   ▼
3. Plugin decodifica e identifica tipo: "debug/analyze"
   │
   ▼
4. Chama DebugAnalyzeUseCase.analyzeViaWebSocket()
   │
   ├─▶ 5. DebugAnalyze seleciona ICodeAnalyzer apropriado
   │       (TypeScriptAnalyzer ou PHPAnalyzer)
   │   │
   │   ▼
   │   6. Analyzer usa IFileSystem para criar arquivo temp
   │   │
   │   ▼
   │   7. Analyzer executa análise de código
   │   │
   │   ▼
   │   8. Chama IEntityPipeline.process()
   │   │
   │   ▼
   │   9. EntityProcessingPipeline processa entidades
   │
   ▼
10. DebugAnalyze envia resposta via IWebSocketClient
    │
    ▼
11. Frontend recebe resultado
```

### Exemplo 2: Listagem de Documentos

```
1. Frontend envia mensagem: "document/refresh"
   │
   ▼
2. WSServerAdapter recebe
   │
   ▼
3. Plugin identifica e chama DocumentManagement.refreshDocuments()
   │
   ├─▶ 4. DocumentManagement usa IFileSystem.exists()
   │   │
   │   ▼
   │   5. Se DB existe, lê via FileMetadataDatabase
   │   │
   │   ▼
   │   6. Transforma dados em DocumentItem[]
   │
   ▼
7. DocumentManagement envia via IWebSocketClient
   │
   ▼
8. Frontend recebe lista de documentos
```

## Inversão de Dependências

```
┌─────────────────────────────────────────────────────┐
│              ANTES (Dependências Diretas)            │
│                                                      │
│  Plugin  ──▶  WebSocket Library (ws)                │
│    │                                                 │
│    └─────▶  Node.js fs module                       │
│                                                      │
│  ❌ Plugin depende de implementações concretas       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│         DEPOIS (Inversão de Dependências)            │
│                                                      │
│  Plugin  ──▶  IWebSocketServer (interface)          │
│                      ▲                               │
│                      │                               │
│                      │ implements                    │
│                      │                               │
│              WSServerAdapter                         │
│                      │                               │
│                      └─▶ WebSocket Library (ws)      │
│                                                      │
│  ✅ Plugin depende de abstrações, não implementações │
└─────────────────────────────────────────────────────┘
```

## Princípios SOLID Aplicados

### 🔹 S - Single Responsibility Principle
Cada classe tem uma única responsabilidade:
- `WSServerAdapter`: Apenas gerencia WebSocket
- `TypeScriptAnalyzer`: Apenas analisa TypeScript
- `DocumentManagement`: Apenas gerencia documentos

### 🔹 O - Open/Closed Principle
Fácil estender sem modificar:
```typescript
// Adicionar novo analisador sem modificar código existente
class RustAnalyzer implements ICodeAnalyzer { /* ... */ }
debugAnalyze.registerAnalyzer(new RustAnalyzer(fs, root));
```

### 🔹 L - Liskov Substitution Principle
Qualquer implementação de `IWebSocketServer` pode substituir outra:
```typescript
const wsServer: IWebSocketServer = new WSServerAdapter();
// ou
const wsServer: IWebSocketServer = new SocketIOAdapter();
```

### 🔹 I - Interface Segregation Principle
Interfaces pequenas e específicas:
- `IWebSocketServer` só define operações de servidor
- `IWebSocketClient` só define operações de cliente
- Não há interface gigante com tudo

### 🔹 D - Dependency Inversion Principle
Classes dependem de abstrações (interfaces), não de concretizações:
```typescript
class DocumentManagement {
  constructor(
    private fileSystem: IFileSystem,  // ← interface, não NodeFileSystemAdapter
    private workspaceRoot: string
  ) {}
}
```

## Benefícios da Refatoração

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Linhas de código** | 1863 linhas | ~250 linhas + módulos |
| **Testabilidade** | Difícil (muitos mocks) | Fácil (cada classe isolada) |
| **Manutenibilidade** | Baixa (código misturado) | Alta (separação clara) |
| **Extensibilidade** | Modificar arquivo gigante | Adicionar novos módulos |
| **Reusabilidade** | Baixa | Alta (componentes reutilizáveis) |
| **Acoplamento** | Alto | Baixo (via interfaces) |
| **Coesão** | Baixa | Alta (responsabilidade única) |
