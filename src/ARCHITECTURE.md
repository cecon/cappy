# 🏗️ CAPPY - Arquitetura Nivel 1/2/Shared

## 📁 Estrutura de Diretórios

```
src/
├── nivel1/                         # PRESENTATION LAYER (Frontend)
│   ├── commands/                   # Command Controllers
│   │   ├── initCappy.ts           # cappy.init
│   │   ├── newTask.ts             # cappy.new
│   │   ├── completeTask.ts        # cappy.complete
│   │   ├── pauseTask.ts           # cappy.pause
│   │   ├── resumeTask.ts          # cappy.resume
│   │   ├── reindex.ts             # cappy.reindex
│   │   └── telemetryConsent.ts    # cappy.telemetry
│   │
│   ├── webviews/                   # UI Components (React)
│   │   ├── chat/                   # ChatView Interface
│   │   │   ├── ChatView.tsx       # Main chat component
│   │   │   ├── MessageList.tsx
│   │   │   ├── InputBox.tsx
│   │   │   └── ToolCard.tsx
│   │   │
│   │   └── knowledge-base/         # Knowledge Base Panel
│   │       ├── DocumentsPage.tsx  # Documents management
│   │       ├── DocumentCard.tsx
│   │       ├── Filters.tsx
│   │       └── Scanner.tsx
│   │
│   └── ui/                         # UI Helpers
│       ├── inputCollector.ts      # Collect user inputs
│       ├── quickPick.ts           # QuickPick wrappers
│       ├── notifications.ts       # Messages & toasts
│       └── progress.ts            # Progress indicators
│
├── nivel2/                         # BACKEND LAYER
│   ├── application/                # Use Cases & Services
│   │   ├── useCases/
│   │   │   ├── createTask.ts      # Create new task
│   │   │   ├── completeTask.ts    # Complete task
│   │   │   ├── pauseTask.ts       # Pause task
│   │   │   ├── resumeTask.ts      # Resume task
│   │   │   ├── orchestrateContext.ts  # Context orchestration
│   │   │   ├── indexDocuments.ts  # Indexing
│   │   │   └── scanWorkspace.ts   # Workspace scanning
│   │   │
│   │   └── services/
│   │       ├── contextOrchestrator.ts  # Context assembly
│   │       ├── documentRetriever.ts    # Semantic search
│   │       ├── embeddingService.ts     # Generate embeddings
│   │       ├── graphService.ts         # Graph operations
│   │       └── telemetryService.ts     # Telemetry
│   │
│   ├── domain/                     # Business Rules
│   │   ├── entities/
│   │   │   ├── Task.ts            # Task entity
│   │   │   ├── Document.ts        # Document entity
│   │   │   ├── CappyConfig.ts     # Config entity
│   │   │   ├── PreventionRule.ts  # Prevention rule
│   │   │   └── GraphNode.ts       # Graph node
│   │   │
│   │   ├── repositories/           # Repository Interfaces
│   │   │   ├── ITaskRepository.ts
│   │   │   ├── IDocumentRepository.ts
│   │   │   ├── IConfigRepository.ts
│   │   │   └── IGraphRepository.ts
│   │   │
│   │   └── valueObjects/
│   │       ├── TaskStatus.ts      # active, paused, done
│   │       ├── TaskCategory.ts    # feature, bugfix, etc
│   │       ├── DocumentStatus.ts  # processed, pending, etc
│   │       └── FilePath.ts        # Value object for paths
│   │
│   └── infrastructure/             # Data Access Layer
│       ├── fileSystem/
│       │   ├── fileManager.ts     # Low-level FS operations
│       │   ├── taskRepository.ts  # Task persistence
│       │   ├── documentRepository.ts  # Document persistence
│       │   └── configRepository.ts    # Config persistence
│       │
│       ├── ai/
│       │   ├── openaiClient.ts    # OpenAI API
│       │   └── embeddingGenerator.ts  # Generate embeddings
│       │
│       ├── graph/
│       │   ├── graphDatabase.ts   # Graph DB operations
│       │   ├── graphRepository.ts # Graph persistence
│       │   └── queryBuilder.ts    # Query construction
│       │
│       └── parsers/
│           ├── xmlHelper.ts       # XML parsing
│           ├── yamlHelper.ts      # YAML parsing
│           └── markdownHelper.ts  # Markdown parsing
│
└── shared/                         # SHARED UTILITIES
    ├── types/                      # TypeScript Types
    │   ├── commands.ts            # Command types
    │   ├── config.ts              # Config types
    │   ├── tasks.ts               # Task types
    │   ├── documents.ts           # Document types
    │   └── graph.ts               # Graph types
    │
    ├── constants/                  # Global Constants
    │   ├── commands.ts            # Command IDs
    │   ├── paths.ts               # Default paths
    │   ├── templates.ts           # Template strings
    │   └── statusCodes.ts         # Status codes
    │
    ├── errors/                     # Custom Errors
    │   ├── CappyError.ts          # Base error
    │   ├── TaskNotFoundError.ts
    │   ├── ConfigInvalidError.ts
    │   └── GraphError.ts
    │
    └── utils/                      # Utility Functions
        ├── logger.ts              # Logging
        ├── validators.ts          # Validation
        └── formatters.ts          # Formatting
```

## 🎯 Separação de Responsabilidades

### Nivel 1 (Presentation Layer)
**Responsabilidade:** Interface com usuário e VS Code API

- ✅ Coleta inputs do usuário
- ✅ Renderiza UI (Webviews React)
- ✅ Mostra notificações e progresso
- ✅ Delega lógica para Nivel 2
- ❌ Não contém business logic
- ❌ Não acessa diretamente File System

### Nivel 2 (Backend Layer)
**Responsabilidade:** Lógica de negócio e persistência

#### Application Layer
- ✅ Use Cases (casos de uso da aplicação)
- ✅ Services (serviços de aplicação)
- ✅ Orquestração de domínio

#### Domain Layer
- ✅ Entities (entidades de negócio)
- ✅ Value Objects (objetos de valor)
- ✅ Repository Interfaces (contratos)
- ✅ Business Rules

#### Infrastructure Layer
- ✅ Implementação de repositories
- ✅ Acesso ao File System
- ✅ Integração com APIs externas (OpenAI)
- ✅ Graph Database
- ✅ Parsers

### Shared
**Responsabilidade:** Código compartilhado entre camadas

- ✅ Types (TypeScript types)
- ✅ Constants (constantes globais)
- ✅ Errors (custom errors)
- ✅ Utils (funções utilitárias puras)

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│  USER ACTION                                             │
│  Ctrl+Shift+P > "Cappy: Create New Task"                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  NIVEL 1: commands/newTask.ts                            │
│  - Coleta input do usuário                              │
│  - Valida campos obrigatórios                           │
│  - Mostra loading indicator                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  NIVEL 2: application/useCases/createTask.ts             │
│  - Valida regras de negócio                             │
│  - Orquestra contexto                                    │
│  - Busca documentos relevantes                          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Domain   │  │ Services │  │ Repos    │
│ Entities │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  NIVEL 2: infrastructure/fileSystem/taskRepository.ts    │
│  - Persiste em .cappy/tasks/                            │
│  - Retorna Task entity                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  NIVEL 1: commands/newTask.ts                            │
│  - Apresenta sucesso                                     │
│  - Pergunta se quer abrir output                        │
└─────────────────────────────────────────────────────────┘
```

## 🎨 Webviews (React UI)

### Chat Interface
```typescript
// nivel1/ui/pages/chat/ChatView.tsx
export const ChatView: React.FC = () => {
    // Comunicação com Extension Host via postMessage
    const vscode = acquireVsCodeApi();
    
    const sendMessage = (text: string) => {
        vscode.postMessage({
            type: 'chat.send',
            payload: { text }
        });
    };
    
    return (
        <div className="chat-container">
            <MessageList messages={messages} />
            <InputBox onSend={sendMessage} />
        </div>
    );
};
```

### Knowledge Base Panel
```typescript
// nivel1/ui/pages/knowledge-base/DocumentsPage.tsx
export const DocumentsPage: React.FC = () => {
    // Lista documentos indexados
    // Permite scan de workspace
    // Mostra status de processamento
    
    const scanWorkspace = () => {
        vscode.postMessage({
            type: 'kb.scan',
            payload: { forceReindex: false }
        });
    };
    
    return (
        <div className="kb-container">
            <Filters />
            <DocumentList documents={documents} />
            <Scanner onScan={scanWorkspace} />
        </div>
    );
};
```

## 🔌 Dependency Injection

```typescript
// extension.ts
export function activate(context: vscode.ExtensionContext) {
    // Infrastructure Layer
    const fileManager = new FileManager(context);
    const taskRepo = new FileSystemTaskRepository(fileManager);
    const docRepo = new FileSystemDocumentRepository(fileManager);
    const configRepo = new FileSystemConfigRepository(fileManager);
    
    // Services
    const embeddingService = new EmbeddingService();
    const documentRetriever = new DocumentRetriever(docRepo, embeddingService);
    const contextOrchestrator = new ContextOrchestrator(docRepo, configRepo);
    
    // Use Cases
    const createTaskUseCase = new CreateTaskUseCase(
        taskRepo,
        docRepo,
        contextOrchestrator
    );
    
    // Commands (Presentation)
    const newTaskCommand = registerNewTaskCommand(context, createTaskUseCase);
    
    context.subscriptions.push(newTaskCommand);
}
```

## 📦 Migration Path

### Fase 1: Shared ✅
- [x] Criar tipos compartilhados
- [x] Criar constantes
- [x] Criar custom errors
- [x] Criar utils

### Fase 2: Domain ✅
- [x] Criar entities
- [x] Criar value objects
- [x] Criar repository interfaces

### Fase 3: Infrastructure ✅
- [x] Migrar fileSystem
- [x] Migrar parsers
- [x] Implementar repositories

### Fase 4: Application ✅
- [x] Criar use cases
- [x] Criar services

### Fase 5: Presentation ✅
- [x] Migrar commands
- [x] Migrar webviews (Chat + KB)
- [x] Criar UI helpers

### Fase 6: Cleanup 🚧
- [ ] Deletar src/commands (legacy)
- [ ] Deletar src/utils (legacy)
- [ ] Atualizar imports
- [ ] Testar build

## 🎯 Benefícios da Nova Arquitetura

✅ **Separação clara de responsabilidades**
- Presentation não conhece Infrastructure
- Domain não conhece VS Code API

✅ **Testabilidade**
- Use Cases podem ser testados isoladamente
- Domain entities são puros (sem dependências)

✅ **Manutenibilidade**
- Fácil localizar código
- Mudanças isoladas por camada

✅ **Escalabilidade**
- Adicionar novo comando = novo file em commands/
- Adicionar novo use case = novo file em useCases/

✅ **Reusabilidade**
- Shared pode ser usado em qualquer camada
- Services podem ser compostos

## 🦫 CAPPY Stack

```
┌────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)      │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │  Nivel 1 (Presentation)          │ │
│  │  - Commands (Controllers)        │ │
│  │  - Webviews (React)              │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │  Nivel 2 (Backend)               │ │
│  │  - Application (Use Cases)       │ │
│  │  - Domain (Business Rules)       │ │
│  │  - Infrastructure (Data)         │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │  Shared (Utilities)              │ │
│  │  - Types, Constants, Errors      │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**Persistence:** File System (.cappy/)
**AI:** OpenAI API
**Graph:** In-memory + FS persistence
**UI:** VS Code Webviews (React)
