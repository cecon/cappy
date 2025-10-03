# Changelog

All notable changes to the Cappy extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.9.9] - 2025-09-30

### Added
- **Cursor Compatibility**: Extensão agora é totalmente compatível com o editor Cursor
- **Environment Detection**: Novo utilitário `EnvironmentDetector` para identificar o ambiente de execução (VS Code ou Cursor)
- **Cursor Documentation**: Documentação completa para usuários do Cursor em `docs/cursor-compatibility.md`
- **Enhanced Welcome Messages**: Mensagens de ativação agora mostram o ambiente detectado

### Changed
- **package.json**: Adicionado engine `cursor: >=0.1.0` para suporte oficial
- **Keywords**: Incluído "cursor" e "cursor-compatible" nas palavras-chave
- **Description**: Atualizada para mencionar compatibilidade com VS Code e Cursor
- **README**: Seção de instalação expandida com instruções específicas para Cursor
- **Version Badge**: Atualizado badge de versão para 2.9.9 com badge de compatibilidade Cursor

### Technical Details
- API do VS Code é totalmente compatível com Cursor
- Detecção automática do ambiente baseada em `vscode.env.appName` e `vscode.env.uriScheme`
- Todos os comandos funcionam identicamente em ambos os editores
- Prevention Rules e Context Orchestration totalmente funcionais no Cursor

## [2.9.0] - 2025-09-18

### Added
- **Auto-Update Copilot Instructions**: Extensão agora atualiza automaticamente o arquivo `.github/copilot-instructions.md` na ativação
- **Smart Content Preservation**: Preserva conteúdo personalizado existente, atualizando apenas a seção CAPPY
- **Comprehensive Test Suite**: Testes unitários completos para validar funcionalidade de atualização automática
- **Graceful Error Handling**: Tratamento robusto de cenários como template ausente ou arquivos sem marcadores

### Changed
- **Extension Activation**: Modificada função `checkAndCopyXsdSchemas` para incluir atualização automática das instruções do Copilot
- **Template Processing**: Melhoria na lógica de processamento de templates com marcadores `<!-- CAPPY INI -->` e `<!-- CAPPY END -->`

### Fixed
- **Missing Auto-Update**: Corrigido problema onde `.github/copilot-instructions.md` não era atualizado automaticamente na ativação da extensão

## [2.8.0] - 2025-09-18

### Added
- **Reindex Command**: New `cappy.reindex` command for rebuilding semantic indexes
- **Semantic Indexation**: Automatic indexation of tasks, documentation, and prevention rules
- **VS Code API Integration**: Leverages native VS Code APIs for enhanced file processing and symbol extraction
- **Context Discovery Support**: Provides indexed data for Cappy 2.0's context orchestration system
- **Progress Reporting**: Real-time progress notifications during reindexation process
- **Comprehensive Testing**: Full test suite for reindex functionality with various scenarios

### Changed
- **Index Structure**: Organized indexes in `.cappy/indexes/` directory with separate files for tasks, docs, and rules
- **Keyword Extraction**: Enhanced keyword extraction using VS Code's WorkspaceSymbolProvider and FileSearchProvider
- **Error Handling**: Robust error handling with graceful degradation for API failures

## [2.7.8] - 2025-09-16

### Added
- **Automatic XSD Schema Management**: XSD schemas are now automatically copied from `resources/` to `.cappy/schemas/` during project initialization
- **Startup Schema Sync**: Schemas are automatically updated when VS Code loads projects with existing `.cappy/schemas/` directories
- **Enhanced FileManager**: New `copyXsdSchemas()` method for robust schema file management
- **Detailed Logging**: Added comprehensive debug logging for schema copy operations

### Changed
- **Init Process**: Enhanced `cappy.init` command to include automatic schema provisioning
- **Extension Activation**: Added automatic schema sync check during extension startup
- **Error Handling**: Improved error handling for schema copy operations to prevent init failures

### Technical Details
- All `*.xsd` files in `resources/` are recursively discovered and copied to `.cappy/schemas/`
- Schema directory is created automatically if it doesn't exist
- Existing schema files are replaced to ensure consistency with extension updates
- Process is resilient to missing resources directory or permission issues

### Testing
- All existing tests continue to pass
- New functionality verified through integration tests
- Manual testing confirms proper schema management in real projects

## [2.7.7] - Previous Release
- (Previous features and changes...)

## [Unreleased]
- Planning for future enhancements to context orchestration
- Investigating advanced schema validation features