# Plano – DI e Ports Compartilhados

## Tokens
- TOKENS.ChatAgentPort
- TOKENS.ChatHistoryPort
- TOKENS.ChatConfigPort
- TOKENS.GraphRepositoryPort
- TOKENS.VectorSearchPort
- TOKENS.DocumentReaderPort
- TOKENS.WorkspacePort
- TOKENS.TerminalPort

## Bindings
- ChatAgentPort -> LangGraphChatEngine
- ChatHistoryPort -> LocalJsonHistoryRepo (exemplo)
- WorkspacePort -> VSCodeWorkspaceAdapter
- TerminalPort -> VSCodeTerminalAdapter
- GraphRepositoryPort -> LanceDbGraphRepository
- VectorSearchPort -> LanceDbVectorSearch

## Lifecycle
- Agent: singleton
- History: per-workspace
- Workspace/Terminal: por sessão VS Code
