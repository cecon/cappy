# TODO - Migração Cappy para React + Vite

## Migração para React com Vite

### 🏗️ Fase 1: Preparação e Backup ✅
- [x] Mover todo o projeto atual para pasta `old/`
- [x] Criar nova estrutura base com Vite + React + TypeScript
- [x] Configurar extensão VS Code vazia (manifest mínimo)
- [x] Verificar que extensão carrega sem erros
- [x] Documentar estrutura atual na pasta `old/`

### 🎯 Fase 2: Configuração Base da Extensão ✅
- [x] Criar `package.json` básico para extensão VS Code
- [x] Configurar manifest mínimo (`package.json` com contributes vazios)
- [x] Criar `extension.ts` vazio com activation básica
- [x] Configurar build com Vite para desenvolvimento
- [x] Testar carregamento da extensão vazia

### ⚛️ Fase 3: Setup React + Vite ✅
- [x] Configurar Vite com React + TypeScript
- [x] Criar estrutura de pastas para componentes React
- [x] Configurar hot-reload para desenvolvimento
- [x] Integrar build do React com build da extensão
- [x] Configurar webview para VS Code com React

### 🔧 Fase 4: Migração Gradual das Funcionalidades
#### Core Cappy
- [ ] Migrar `cappy_init` (inicialização workspace)
- [ ] Migrar `cappy_knowstack` (análise stack tecnológico)  
- [ ] Migrar `cappy_create_task` (criação de tasks)
- [ ] Migrar `cappy_work_on_task` (execução tasks)
- [ ] Migrar `cappy_complete_task` (finalização tasks)
- [ ] Migrar `cappy_reindex` (reindexação)

#### CappyRAG (Sistema de Conhecimento)
- [ ] Migrar `cappyrag_add_document` (adicionar documentos)
- [ ] Migrar `cappy_query` (busca knowledge base)
- [ ] Migrar `cappyrag_get_stats` (estatísticas)
- [ ] Migrar `cappyrag_get_supported_formats` (formatos suportados)
- [ ] Migrar `cappyrag_estimate_processing_time` (estimativa processamento)

#### Comandos VS Code
- [x] **Migrar comando cappy.openGraph** ✅ (Knowledge Graph)
- [ ] Migrar comandos básicos (init, version, etc)
- [ ] Migrar comandos de task management
- [ ] Migrar outros comandos CappyRAG
- [ ] Migrar comandos CappyChain
- [ ] Migrar comandos de configuração

### 🎨 Fase 5: Interface React
#### Componentes Base
- [ ] Criar componente TaskManager
- [ ] Criar componente KnowledgeBase  
- [ ] Criar componente ChatInterface
- [🚧] **Criar componente GraphVisualization** (INICIADO - Arquitetura Hexagonal)
- [ ] Criar componente Settings

#### **🏗️ GraphVisualization - Arquitetura Hexagonal (EM PROGRESSO)**
##### ✅ Domain Layer (Concluído)
- [x] **Entities**: GraphNode, GraphEdge, GraphData (entities completas com TSDoc)
- [x] **Types**: Interfaces e tipos base (Position, VisualProperties, etc.)
- [x] **Ports**: GraphRepository, GraphVisualizationService, GraphAnalyticsService

##### 🆕 VS Code Integration (Concluído)
- [x] **Comando**: `cappy.openGraph` implementado e funcionando (padrão cappy.*)
- [x] **WebView**: HTML base com loading e CSP security
- [x] **Extension**: v3.0.0 instalada com comando ativo

##### 🔄 Application Layer (Próximo)
- [ ] **Use Cases**: LoadGraphDataUseCase, FilterGraphUseCase, ExpandNodeUseCase
- [ ] **Services**: Graph domain services
- [ ] **Queries/Commands**: CQRS implementation

##### ⏳ Infrastructure Layer (Pendente)
- [ ] **Repository Implementation**: LanceDbGraphRepository
- [ ] **Visualization Implementation**: D3GraphVisualizationService  
- [ ] **Analytics Implementation**: NetworkXGraphAnalyticsService

##### ⏳ Presentation Layer (Pendente)
- [ ] **React Components**: GraphVisualization, NodeDetails, GraphControls
- [ ] **State Management**: Zustand/Context para state do graph
- [ ] **WebView Integration**: VS Code webview adapter

#### Webviews
- [ ] Migrar Chat Task para React
- [ ] Migrar Graph Visualization para React
- [ ] Migrar Upload UI para React
- [ ] Criar Dashboard principal em React

### 🔌 Fase 6: Integrações
- [ ] Migrar integração LanceDB
- [ ] Migrar integração Transformers (@xenova)
- [ ] Migrar integração LangChain
- [ ] Migrar MCP (Model Context Protocol)
- [ ] Migrar Language Model Tools

### 📝 Fase 7: Configurações e Snippets
- [ ] Migrar configurações VS Code (settings)
- [ ] Migrar snippets markdown
- [ ] Migrar syntax highlighting (task XML)
- [ ] Migrar language configuration

### 🧪 Fase 8: Testes e Validação
- [ ] Configurar ambiente de testes com React Testing Library
- [ ] Criar testes para componentes React
- [ ] Migrar testes existentes da extensão
- [ ] Testar compatibilidade VS Code + Cursor
- [ ] Validar performance comparativa

### 📦 Fase 9: Build e Deploy
- [ ] Configurar build de produção otimizado
- [ ] Configurar scripts de publicação
- [ ] Otimizar bundle size
- [ ] Configurar CI/CD para novo setup
- [ ] Testar instalação em ambiente limpo

### 🔄 Fase 10: Migração Completa
- [ ] Comparar funcionalidades old vs new
- [ ] Migrar dados de usuários (se necessário)
- [ ] Atualizar documentação
- [ ] Publicar nova versão
- [ ] Deprecar versão antiga

## 📋 Checklist de Funcionalidades a Migrar

### Language Model Tools (VS Code Copilot Integration)
- [ ] `cappy_init` - Inicialização workspace
- [ ] `cappy_knowstack` - Análise stack tecnológico
- [ ] `cappy_create_task` - Criação tasks XML
- [ ] `cappy_work_on_task` - Execução tasks
- [ ] `cappy_complete_task` - Finalização tasks
- [ ] `cappy_reindex` - Reindexação
- [ ] `cappyrag_add_document` - Adicionar docs
- [ ] `cappy_query` - Query knowledge base
- [ ] `cappyrag_get_stats` - Estatísticas
- [ ] `cappyrag_get_supported_formats` - Formatos
- [ ] `cappyrag_estimate_processing_time` - Estimativas

### Comandos VS Code (42 comandos)
- [ ] Comandos Cappy básicos (init, version, knowstack, etc)
- [ ] Comandos Task Management (create, complete, change status)
- [ ] Comandos CappyRAG (index, search, graph, upload)
- [ ] Comandos CappyChain (demo, templates, execute)
- [ ] Comandos Prevention Rules (add, remove)
- [ ] Comandos Configuração (copilot config)

### Configurações
- [ ] `cappy.*` settings (auto-update, notifications, etc)
- [ ] `cappyrag.*` settings (model, topK, storage, excludes)
- [ ] `cappy.chat.*` settings (custom models, ollama)

### Views e Webviews
- [ ] Activity Bar: "Cappy Task Chat"
- [ ] Webview: Task Assistant
- [ ] Graph Visualization
- [ ] Upload UI

### Assets e Recursos
- [ ] Ícones e imagens
- [ ] Snippets markdown
- [ ] Syntax highlighting (task XML)
- [ ] Templates dashboard

### Dependências Críticas
- [ ] `@lancedb/lancedb` - Vector database
- [ ] `@xenova/transformers` - ML models
- [ ] `langchain` + `@langchain/*` - AI chain
- [ ] `@modelcontextprotocol/sdk` - MCP
- [ ] `@assistant-ui/react` - Chat UI

## 🎯 Objetivos da Migração

### Performance
- [ ] Melhor hot-reload durante desenvolvimento
- [ ] Bundle otimizado com tree-shaking
- [ ] Lazy loading de componentes
- [ ] Cache inteligente de recursos

### Desenvolvimento
- [ ] Developer Experience melhorado
- [ ] Componentes reutilizáveis
- [ ] TypeScript strict mode
- [ ] Testes automatizados

### Manutenibilidade
- [ ] Separação clara de responsabilidades
- [ ] Arquitetura modular
- [ ] Documentação componentizada
- [ ] Refatoração gradual

## 🚨 Riscos e Mitigações

### Riscos Identificados
- [ ] Perda de funcionalidades durante migração
- [ ] Incompatibilidade com VS Code APIs
- [ ] Performance degraded
- [ ] Quebra de workflows dos usuários

### Mitigações
- [ ] Manter versão old como backup
- [ ] Testes extensivos antes de cada release
- [ ] Migração gradual e incremental
- [ ] Feedback loop com usuários beta

## 📅 Timeline Estimado

### Semana 1-2: Preparação (Fases 1-3)
- Setup inicial e configuração base

### Semana 3-6: Core Migration (Fase 4)
- Migração das funcionalidades principais

### Semana 7-8: Interface (Fase 5)
- Desenvolvimento componentes React

### Semana 9-10: Integrações (Fase 6)
- Migração dependências complexas

### Semana 11: Polimento (Fases 7-8)
- Configurações e testes

### Semana 12: Deploy (Fases 9-10)
- Build e publicação

## ✅ Concluído
- [x] Análise da estrutura atual do projeto
- [x] Criação do plano de migração detalhado
- [x] Identificação de todas as funcionalidades a migrar
- [x] Definição de fases e timeline

### 🚀 FASES CONCLUÍDAS
- [x] **Fase 1: Preparação e Backup** - Projeto movido para `old/`, estrutura limpa criada
- [x] **Fase 2: Configuração Base** - Extensão VS Code mínima configurada com manifest básico
- [x] **Fase 3: Setup React + Vite** - Ambiente de desenvolvimento moderno configurado
- [x] **🎯 MILESTONE: Extensão v3.0.0 instalada e funcionando!**

### 🚧 FASE EM PROGRESSO: Dashboard Graph com Arquitetura Hexagonal

#### 📋 **Análise Completa da Versão Antiga**
- [x] Mapeamento dos arquivos do sistema de graph existente
- [x] Análise do `graphD3View.ts` e `graphHandlers.ts`
- [x] Compreensão do dashboard.js (1225 linhas) e dashboard.css
- [x] Identificação das funcionalidades: D3.js visualization, node expansion, estatísticas

#### 🏗️ **Arquitetura Hexagonal - Domain Layer (100% Concluído)**
- [x] **Documentação**: `docs/architecture/hexagonal-graph-design.md` (detalhada)
- [x] **Estrutura de Pastas**: Organização modular (domains/adapters/shared/infrastructure)
- [x] **Types**: `domains/graph/types/index.ts` (interfaces completas)
- [x] **Entities**: 
  - [x] `GraphNode.ts` (309 linhas, TSDoc completo, validações)
  - [x] `GraphEdge.ts` (298 linhas, TSDoc completo, relacionamentos)
  - [x] `GraphData.ts` (agregado raiz, 350+ linhas, operações CRUD)
- [x] **Ports (Interfaces)**:
  - [x] `GraphRepository.ts` (persistência, LanceDB adapter)
  - [x] `GraphVisualizationService.ts` (renderização, D3.js adapter)
  - [x] `GraphAnalyticsService.ts` (algoritmos, métricas, PageRank)

### 📁 Estrutura Atual
```
cappy1/
├── src/
│   ├── extension.ts (entry point da extensão)
│   ├── main.tsx (entry point React)
│   ├── App.tsx (componente principal)
│   ├── App.css
│   └── index.css
├── old/ (projeto original completo)
├── package.json (configurado para extensão VS Code + React)
├── vite.config.ts (configuração Vite)
├── tsconfig.json (TypeScript config)
├── index.html (HTML base)
├── .gitignore (atualizado)
└── todo.md (este arquivo)
```

### 🎯 Próximas Etapas
Pronto para iniciar **Fase 4: Migração Gradual das Funcionalidades**
- Core Cappy (language model tools)
- CappyRAG (sistema de conhecimento)  
- Comandos VS Code

-### 🔧 Últimas Atualizações
- **[Oct 9, 2025]** Extensão v3.0.0 reinstalada com comando `cappy.openGraph` corrigido
- Comando deve agora aparecer no Command Palette como "📊 Cappy: Open Knowledge Graph"
- Adicionado `menus.commandPalette` e `onCommand:cappy.openGraph` para forçar visibilidade do comando
- Próximo: Implementar Use Cases para carregar dados do LanceDB
- Integrações e dependências