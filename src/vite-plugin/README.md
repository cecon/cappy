# Arquitetura Hexagonal - Vite Plugin Cappy Dev Server

## Visão Geral

O plugin Vite foi refatorado usando **Arquitetura Hexagonal (Ports & Adapters)** para melhorar:
- 🧩 **Modularidade**: Componentes independentes e reutilizáveis
- 🧪 **Testabilidade**: Fácil de criar testes unitários com mocks
- 🔄 **Manutenibilidade**: Código organizado em camadas bem definidas
- 🔌 **Extensibilidade**: Novos adaptadores podem ser adicionados sem modificar o core

## Estrutura de Diretórios

```
src/vite-plugin/
├── ports/                    # Interfaces (contratos)
│   ├── IWebSocketServer.ts  # Interface para WebSocket
│   ├── IHTTPHandler.ts      # Interface para HTTP
│   ├── IFileSystem.ts       # Interface para File System
│   ├── IBridge.ts           # Interface para VS Code Bridge
│   └── IAnalyzer.ts         # Interface para análise de código
│
├── adapters/                 # Implementações técnicas
│   ├── WSServerAdapter.ts   # Adaptador WebSocket (ws library)
│   ├── NodeFileSystemAdapter.ts  # Adaptador File System (Node.js fs)
│   ├── DevServerBridgeAdapter.ts # Adaptador Bridge para extensão
│   └── SimpleHTTPRouter.ts  # Roteador HTTP simples
│
├── domain/                   # Lógica de negócio (core)
│   ├── TypeScriptAnalyzer.ts    # Análise de código TS/JS
│   ├── PHPAnalyzer.ts           # Análise de código PHP
│   └── EntityProcessingPipeline.ts  # Pipeline de entidades
│
└── application/              # Casos de uso
    ├── DocumentManagement.ts     # Gerenciamento de documentos
    ├── DebugAnalyzeUseCase.ts    # Debug e análise de arquivos
    ├── GraphAPIHandler.ts        # Handler para API de grafo
    ├── TasksAPIHandler.ts        # Handler para API de tasks
    └── ChatAPIHandler.ts         # Handler para API de chat
```

## Camadas da Arquitetura

### 1. **Ports (Interfaces)**
Definem os contratos que devem ser implementados. São agnósticas de tecnologia.

```typescript
// Exemplo: IWebSocketServer.ts
export interface IWebSocketServer {
  start(port: number): Promise<void>;
  close(): Promise<void>;
  broadcast(message: unknown): void;
  onConnection(handler: (client: IWebSocketClient) => void): void;
}
```

### 2. **Adapters (Implementações)**
Implementam as interfaces dos ports usando tecnologias específicas.

```typescript
// Exemplo: WSServerAdapter.ts
export class WSServerAdapter implements IWebSocketServer {
  private wss: WebSocketServer | null = null;
  
  async start(port: number): Promise<void> {
    this.wss = new WebSocketServer({ port });
    // ...
  }
}
```

### 3. **Domain (Domínio)**
Contém a lógica de negócio pura, independente de frameworks.

```typescript
// Exemplo: TypeScriptAnalyzer.ts
export class TypeScriptAnalyzer implements ICodeAnalyzer {
  async analyze(filePath: string, content: string): Promise<AnalysisResult> {
    // Lógica de análise de código TypeScript
  }
}
```

### 4. **Application (Casos de Uso)**
Orquestra o domínio e os adapters para implementar funcionalidades.

```typescript
// Exemplo: DocumentManagement.ts
export class DocumentManagement {
  constructor(
    private fileSystem: IFileSystem,
    private workspaceRoot: string
  ) {}
  
  async refreshDocuments(client: IWebSocketClient): Promise<void> {
    // Orquestra lógica de negócio
  }
}
```

## Fluxo de Dados

```
┌─────────────────┐
│   Vite Plugin   │  (Entry Point)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Application    │  (Use Cases)
│  - DocumentMgmt │
│  - DebugAnalyze │
└────────┬────────┘
         │
         ├─────────────┐
         ▼             ▼
┌─────────────┐  ┌──────────┐
│   Domain    │  │ Adapters │
│  - Analyzers│  │ - WS     │
│  - Pipeline │  │ - FS     │
└─────────────┘  └──────────┘
         │             │
         ▼             ▼
      [Ports - Interfaces]
```

## Benefícios

### 🧪 Testabilidade
Agora é fácil testar cada componente isoladamente:

```typescript
// Teste unitário do DocumentManagement
const mockFileSystem: IFileSystem = {
  exists: jest.fn().mockReturnValue(true),
  readFile: jest.fn(),
  // ...
};

const docMgmt = new DocumentManagement(mockFileSystem, "/workspace");
await docMgmt.refreshDocuments(mockClient);
```

### 🔌 Extensibilidade
Adicionar novos analisadores é simples:

```typescript
class RustAnalyzer implements ICodeAnalyzer {
  getSupportedExtensions() { return [".rs"]; }
  async analyze(filePath: string, content: string) { /* ... */ }
}

// No plugin principal:
debugAnalyze.registerAnalyzer(new RustAnalyzer(fileSystem, workspaceRoot));
```

### 🔄 Substituibilidade
Trocar implementações sem alterar lógica de negócio:

```typescript
// De WSServerAdapter para SocketIOAdapter
const wsServer = new SocketIOAdapter(); // Implementa IWebSocketServer
// O resto do código continua funcionando!
```

## Comparação: Antes vs Depois

### ❌ Antes (Monolito)
- 1863 linhas em um único arquivo
- Lógica misturada (WebSocket + HTTP + Análise)
- Difícil de testar
- Dependências acopladas
- Dificuldade para adicionar features

### ✅ Depois (Hexagonal)
- ~250 linhas no arquivo principal
- Lógica separada em camadas
- Fácil de testar (cada classe isoladamente)
- Dependências invertidas (via interfaces)
- Fácil adicionar novos adaptadores/analisadores

## Migrando para a Nova Arquitetura

### Passo 1: Atualizar imports no vite.config.ts

```typescript
// Antes
import { cappyDevServerPlugin } from "./vite-plugin-cappy-dev";

// Depois
import { cappyDevServerPlugin } from "./vite-plugin-cappy-dev-refactored";
```

### Passo 2: (Opcional) Remover arquivo antigo

Após validar que tudo funciona:
```bash
rm vite-plugin-cappy-dev.ts
mv vite-plugin-cappy-dev-refactored.ts vite-plugin-cappy-dev.ts
```

## Próximos Passos

1. ✅ Estrutura criada
2. ✅ Ports definidos
3. ✅ Adapters implementados
4. ✅ Domain services criados
5. ✅ Use cases implementados
6. ✅ Plugin refatorado
7. 🔄 Testes unitários (próximo passo)
8. 🔄 Documentação de API

## Exemplo de Uso

```typescript
// Criar novos adaptadores personalizados
class CustomWebSocketAdapter implements IWebSocketServer {
  // Implementação customizada
}

// Registrar novo analisador
class GoAnalyzer implements ICodeAnalyzer {
  getSupportedExtensions() { return [".go"]; }
  async analyze(filePath: string, content: string) {
    // Análise de código Go
  }
}

// No plugin
debugAnalyze.registerAnalyzer(new GoAnalyzer(fileSystem, workspaceRoot));
```

## Recursos

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Ports and Adapters Pattern](https://softwarecampament.wordpress.com/portsadapters/)
