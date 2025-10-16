# Workspace Scanner - TODO List

## ✅ Fase 1 - Implementação Base (CONCLUÍDA)

- [x] WorkspaceScanner service
- [x] WorkspaceScanQueue com controle de concorrência
- [x] FileHashService para change detection
- [x] IgnorePatternMatcher (.gitignore + .cappyignore)
- [x] FileMetadataExtractor (LOC, size, etc.)
- [x] ASTRelationshipExtractor (base para relacionamentos)
- [x] Comando VS Code (cappy.scanWorkspace)
- [x] Integração com extension.ts
- [x] Atualização de tipos (FileIndexEntry)
- [x] GraphStorePort.deleteFile()
- [x] KuzuAdapter.deleteFile()
- [x] Documentação completa
- [x] Testes unitários básicos

## 🚧 Fase 2 - Cross-File Relationships

### 2.1 Import/Export Mapping
- [ ] Criar tabela `ImportDeclaration` no Kuzu
  - [ ] Schema: `from_file`, `imported_symbol`, `from_module`, `line_number`
- [ ] Criar tabela `ExportDeclaration` no Kuzu
  - [ ] Schema: `from_file`, `exported_symbol`, `is_default`, `line_number`
- [ ] Criar relacionamento `IMPORTS` no Kuzu
  - [ ] `File -[IMPORTS]-> File`
  - [ ] Propriedades: `symbols[]`, `is_namespace`, `alias`
- [ ] Criar relacionamento `EXPORTS_TO` no Kuzu
  - [ ] `File -[EXPORTS_TO]-> File`

### 2.2 Function Call Tracking
- [ ] Detectar chamadas de função via AST
- [ ] Resolver função para arquivo de origem
- [ ] Criar relacionamento `CALLS` no Kuzu
  - [ ] `Chunk -[CALLS]-> Chunk`
  - [ ] Propriedades: `call_count`, `line_numbers[]`

### 2.3 Type Reference Tracking
- [ ] Detectar referências de tipos via AST
- [ ] Resolver tipo para arquivo de definição
- [ ] Criar relacionamento `USES_TYPE` no Kuzu
  - [ ] `Chunk -[USES_TYPE]-> Chunk`

### 2.4 Class Hierarchy
- [ ] Detectar extends/implements
- [ ] Criar relacionamento `EXTENDS` no Kuzu
  - [ ] `Chunk -[EXTENDS]-> Chunk`
- [ ] Criar relacionamento `IMPLEMENTS` no Kuzu
  - [ ] `Chunk -[IMPLEMENTS]-> Chunk`

## 🔄 Fase 3 - File Watchers & Incremental Indexing

### 3.1 File System Watchers
- [ ] Implementar `FileSystemWatcher` do VS Code
- [ ] Detectar criação de arquivos
- [ ] Detectar modificação de arquivos
- [ ] Detectar exclusão de arquivos
- [ ] Detectar renomeação de arquivos

### 3.2 Incremental Indexing
- [ ] Re-processar apenas arquivos modificados
- [ ] Atualizar relacionamentos afetados
- [ ] Limpar relacionamentos órfãos
- [ ] Debounce para múltiplas mudanças rápidas

### 3.3 Workspace Events
- [ ] Escutar evento `onDidSaveTextDocument`
- [ ] Escutar evento `onDidCreateFiles`
- [ ] Escutar evento `onDidDeleteFiles`
- [ ] Escutar evento `onDidRenameFiles`

## 💾 Fase 4 - Persistência de Índice

### 4.1 File Index Table no Kuzu
- [ ] Criar tabela `FileIndex` no Kuzu
- [ ] Schema completo do `FileIndexEntry`
- [ ] Métodos CRUD no `KuzuAdapter`
- [ ] Carregar índice na inicialização

### 4.2 Metadata Storage
- [ ] Criar tabela `ScanMetadata` no Kuzu
  - [ ] `last_full_scan`, `total_files`, `total_chunks`, etc.
- [ ] Salvar estatísticas de scan
- [ ] Recuperar histórico de scans

### 4.3 Index Recovery
- [ ] Detectar índice corrompido
- [ ] Opção de rebuild completo
- [ ] Backup automático antes de scans

## 📊 Fase 5 - UI & Observability

### 5.1 Progress Webview
- [ ] Criar webview customizado para progresso
- [ ] Mostrar estatísticas em tempo real
- [ ] Gráfico de progresso por tipo de arquivo
- [ ] Lista de erros com links para arquivos

### 5.2 Statistics Dashboard
- [ ] Total de arquivos indexados
- [ ] Total de chunks criados
- [ ] Total de relacionamentos
- [ ] Distribuição por linguagem
- [ ] Top 10 arquivos maiores
- [ ] Arquivos com mais dependências

### 5.3 Error Reporting
- [ ] Painel de erros detalhado
- [ ] Quick fix para adicionar ao .cappyignore
- [ ] Link direto para arquivo com erro
- [ ] Sugestões de correção

## 🔍 Fase 6 - Análise Avançada

### 6.1 Dependency Graph
- [ ] Visualizar grafo de dependências
- [ ] Detectar dependências circulares
- [ ] Sugerir refatorações
- [ ] Identificar módulos isolados

### 6.2 Code Duplication
- [ ] Detectar código duplicado via similarity
- [ ] Usar embeddings para comparação semântica
- [ ] Sugerir extração de funções comuns

### 6.3 Complexity Metrics
- [ ] Calcular complexidade ciclomática
- [ ] Detectar funções muito grandes
- [ ] Identificar code smells
- [ ] Sugerir simplificações

### 6.4 Dead Code Detection
- [ ] Identificar exports não usados
- [ ] Detectar funções nunca chamadas
- [ ] Sugerir remoções seguras

## 🌍 Fase 7 - Multi-Language Support

### 7.1 Python Support
- [ ] Criar `PythonParser` usando AST do Python
- [ ] Extrair docstrings
- [ ] Detectar imports
- [ ] Detectar classes e funções
- [ ] Relacionamentos Python-específicos

### 7.2 Java Support
- [ ] Criar `JavaParser`
- [ ] Extrair Javadoc
- [ ] Detectar packages e imports
- [ ] Relacionamentos Java-específicos

### 7.3 Go Support
- [ ] Criar `GoParser`
- [ ] Extrair godoc
- [ ] Detectar packages
- [ ] Relacionamentos Go-específicos

### 7.4 Rust Support
- [ ] Criar `RustParser`
- [ ] Extrair doc comments
- [ ] Detectar modules e crates
- [ ] Relacionamentos Rust-específicos

## ⚙️ Fase 8 - Configuration & Customization

### 8.1 Workspace Configuration
- [ ] Criar `.cappy/config.json`
- [ ] Configurar linguagens habilitadas
- [ ] Configurar estratégias de chunking
- [ ] Configurar padrões de ignore customizados

### 8.2 Per-Language Settings
- [ ] Configurar parsing por linguagem
- [ ] Habilitar/desabilitar features específicas
- [ ] Ajustar limites de tamanho

### 8.3 Performance Tuning
- [ ] Configurar concorrência
- [ ] Configurar batch size
- [ ] Configurar timeout por arquivo
- [ ] Configurar uso de memória

## 📤 Fase 9 - Import/Export

### 9.1 Export Index
- [ ] Exportar para JSON
- [ ] Exportar para GraphML
- [ ] Exportar estatísticas para CSV

### 9.2 Import Index
- [ ] Importar de JSON
- [ ] Merge com índice existente
- [ ] Validar integridade

### 9.3 Share Index
- [ ] Compartilhar índice entre desenvolvedores
- [ ] Versionamento de índices
- [ ] Diff de índices

## 🧪 Fase 10 - Testing & Quality

### 10.1 Unit Tests
- [ ] Testes para todos os parsers
- [ ] Testes para extração de relacionamentos
- [ ] Testes para change detection
- [ ] Testes para fila de processamento

### 10.2 Integration Tests
- [ ] Teste de scan completo em projeto real
- [ ] Teste de incremental indexing
- [ ] Teste de file watchers
- [ ] Teste de cross-file relationships

### 10.3 Performance Tests
- [ ] Benchmark em projetos pequenos/médios/grandes
- [ ] Profiling de memória
- [ ] Otimização de queries Kuzu
- [ ] Otimização de embeddings

### 10.4 E2E Tests
- [ ] Teste completo de instalação
- [ ] Teste de comandos VS Code
- [ ] Teste de UI
- [ ] Teste de recuperação de erros

## 📚 Fase 11 - Documentation

### 11.1 User Documentation
- [ ] Tutorial de getting started
- [ ] Guia de configuração
- [ ] FAQ
- [ ] Troubleshooting guide

### 11.2 Developer Documentation
- [ ] Guia de arquitetura
- [ ] Como adicionar novos parsers
- [ ] Como adicionar novos relacionamentos
- [ ] Guia de contribuição

### 11.3 API Documentation
- [ ] JSDoc completo
- [ ] Exemplos de uso
- [ ] TypeScript types bem documentados

## 🚀 Fase 12 - Optimization

### 12.1 Query Optimization
- [ ] Adicionar índices no Kuzu
- [ ] Otimizar queries comuns
- [ ] Cache de resultados frequentes

### 12.2 Memory Optimization
- [ ] Streaming de arquivos grandes
- [ ] Limpeza de memória entre batches
- [ ] Limitar tamanho de chunks

### 12.3 Disk Optimization
- [ ] Compactação de dados
- [ ] Limpeza de dados obsoletos
- [ ] Rotação de logs

## 🔐 Fase 13 - Security & Privacy

### 13.1 Privacy
- [ ] Opção de não indexar arquivos sensíveis
- [ ] Filtrar tokens/secrets de chunks
- [ ] Logs sem informações sensíveis

### 13.2 Security
- [ ] Validar input de comandos
- [ ] Sanitizar queries Cypher
- [ ] Validar paths de arquivos

## 🎯 Backlog / Ideas

- [ ] Integração com GitHub Copilot Chat
- [ ] Sugestões de código baseadas no grafo
- [ ] Detecção de padrões arquiteturais
- [ ] Geração de documentação automática
- [ ] Análise de impacto de mudanças
- [ ] Recomendação de testes baseada em cobertura
- [ ] Integração com linters
- [ ] Integração com formatters
- [ ] Plugin system para parsers customizados
- [ ] API REST para acesso externo
- [ ] CLI para operações batch
- [ ] VS Code extension marketplace

## 📝 Notes

### High Priority
- Fase 2 (Cross-file relationships) é crítica para value proposition
- Fase 3 (File watchers) é essencial para UX
- Fase 4 (Persistência) é necessária para performance

### Medium Priority
- Fase 5 (UI) melhora UX mas não é blocker
- Fase 6 (Análise avançada) é value-add
- Fase 7 (Multi-language) expande mercado

### Low Priority
- Fases 8-13 são polimento e maturidade
- Podem ser feitas incrementalmente
- Baseadas em feedback de usuários

### Dependencies
- Fase 3 depende de Fase 2 estar estável
- Fase 5 pode ser paralela a Fase 2-4
- Fase 6 depende de Fase 2
- Fase 7 pode ser incremental (uma linguagem por vez)

### Metrics to Track
- Tempo de scan (avg, p95, p99)
- Uso de memória (avg, peak)
- Acurácia de relacionamentos (precision/recall)
- Taxa de erros por tipo de arquivo
- Satisfação do usuário (NPS)
