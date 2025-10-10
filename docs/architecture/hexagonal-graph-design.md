# Graph Visualization Architecture - Hexagonal Design

## 📋 Overview
Este documento descreve a arquitetura hexagonal implementada para o sistema de visualização de grafos do CappyRAG, migrando de vanilla JavaScript para React + TypeScript com máxima modularização.

## 🏗️ Arquitetura Hexagonal

### Core Domain (Centro)
- **Entities**: Modelos de negócio puros
- **Use Cases**: Lógica de negócio
- **Repositories**: Interfaces de dados

### Adapters (Externos)
- **Primary Adapters**: React Components, VS Code WebView
- **Secondary Adapters**: LanceDB, File System, VS Code APIs

### Ports (Interfaces)
- **Input Ports**: Commands, Queries
- **Output Ports**: Repository interfaces, Service interfaces

## 🎯 Benefícios da Arquitetura

### 1. **Separação de Responsabilidades**
- Domain logic independente de frameworks
- UI separada da lógica de negócio
- Infraestrutura isolada

### 2. **Testabilidade**
- Testes unitários do domain
- Mocks fáceis dos adapters
- Testes de integração isolados

### 3. **Flexibilidade**
- Troca fácil de tecnologias
- Múltiplas interfaces (VS Code, web)
- Evolução independente das camadas

## 📁 Estrutura de Pastas

```
src/
├── domains/
│   └── graph/
│       ├── entities/          # Modelos de negócio
│       ├── usecases/          # Casos de uso
│       ├── ports/             # Interfaces
│       └── types/             # Types compartilhados
├── adapters/
│   ├── primary/
│   │   ├── react/            # Componentes React
│   │   └── vscode/           # VS Code WebView
│   └── secondary/
│       ├── database/         # LanceDB adapter
│       ├── filesystem/       # File system adapter
│       └── visualization/    # D3.js adapter
├── shared/
│   ├── types/               # Types globais
│   ├── utils/               # Utilities
│   └── config/              # Configurações
└── infrastructure/
    ├── di/                  # Dependency Injection
    ├── logging/             # Logging
    └── error-handling/      # Error handling
```

## 🔄 Fluxo de Dados

```
React Component → Use Case → Repository → LanceDB
     ↑                                        ↓
   Result ← Domain Entity ← Domain Service ← Data
```

## 🧩 Componentes Principais

### Domain Layer
- `GraphNode`: Entidade de nó
- `GraphEdge`: Entidade de aresta  
- `GraphData`: Agregado raiz
- `GraphRepository`: Interface do repositório
- `GraphVisualizationService`: Serviço de visualização

### Application Layer
- `LoadGraphDataUseCase`: Carregar dados do grafo
- `FilterGraphUseCase`: Filtrar nós/arestas
- `ExpandNodeUseCase`: Expandir vizinhança
- `CalculateMetricsUseCase`: Calcular métricas

### Infrastructure Layer
- `LanceDbGraphRepository`: Implementação LanceDB
- `D3GraphRenderer`: Renderizador D3.js
- `VSCodeWebViewAdapter`: Adapter VS Code

### Presentation Layer
- `GraphVisualization`: Componente principal
- `NodeDetails`: Detalhes do nó
- `GraphControls`: Controles de navegação
- `GraphStats`: Estatísticas

## 📋 Checklist de Implementação

### ✅ Fase 1: Foundation
- [ ] Setup da estrutura de pastas
- [ ] Configuração do DI container
- [ ] Types e interfaces base
- [ ] Error handling centralizado

### ✅ Fase 2: Domain Layer  
- [ ] Entidades (Node, Edge, Graph)
- [ ] Use Cases principais
- [ ] Interfaces dos repositórios
- [ ] Validações de domínio

### ✅ Fase 3: Infrastructure
- [ ] LanceDB repository
- [ ] D3.js renderer
- [ ] VS Code adapter
- [ ] Configuration manager

### ✅ Fase 4: Application
- [ ] Use case implementations
- [ ] Service layer
- [ ] Query/Command handlers
- [ ] Event system

### ✅ Fase 5: Presentation
- [ ] React components
- [ ] State management
- [ ] UI/UX interactions
- [ ] WebView integration

### ✅ Fase 6: Integration
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error scenarios
- [ ] Documentation

## 🎨 Design Patterns Utilizados

### 1. **Repository Pattern**
- Abstração do acesso aos dados
- Testabilidade melhorada
- Troca fácil de implementações

### 2. **Use Case Pattern** 
- Lógica de aplicação centralizada
- Single Responsibility Principle
- Fácil manutenção e teste

### 3. **Adapter Pattern**
- Integração com sistemas externos
- Inversão de dependências
- Flexibilidade de implementação

### 4. **Observer Pattern**
- Atualizações reativas
- Desacoplamento entre componentes
- Event-driven architecture

## 🔧 Tecnologias e Ferramentas

### Core
- **TypeScript**: Type safety
- **React**: UI components
- **D3.js**: Graph visualization

### Infrastructure  
- **LanceDB**: Vector database
- **VS Code API**: Extension integration
- **Vite**: Build tooling

### Testing
- **Vitest**: Unit testing
- **React Testing Library**: Component testing  
- **MSW**: API mocking

### Documentation
- **TSDoc**: Code documentation
- **Storybook**: Component documentation
- **Markdown**: Architecture docs

## 📊 Métricas e Monitoramento

### Performance
- Render time < 100ms para 1k nós
- Memory usage < 500MB
- Bundle size < 2MB

### Quality
- Test coverage > 80%
- TypeScript strict mode
- ESLint/Prettier compliance

### UX
- Loading states
- Error boundaries
- Progressive enhancement

## 🔮 Roadmap Futuro

### v3.1: Core Migration
- Migração básica funcionando
- React components principais
- LanceDB integration

### v3.2: Advanced Features
- Graph algorithms (PageRank, clustering)
- Advanced filtering and search
- Export/import capabilities

### v3.3: Performance & Scale
- Virtual scrolling para large graphs
- WebWorkers para cálculos pesados
- Streaming data updates

### v3.4: AI Integration
- Graph-based RAG queries
- Semantic similarity visualization
- Auto-layout recommendations