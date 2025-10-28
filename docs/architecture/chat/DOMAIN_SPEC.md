# SPEC – Domínio do Chat (Contratos)

## Entidades
- Message: id, content, author, timestamp, metadata
- ChatSession: id, title, messages[], createdAt, tags?

## Ports
- ChatAgentPort: processMessage(input, context) -> AsyncIterable<string>
- ChatHistoryPort: save(session), load(sessionId), list(), delete(id)
- ChatConfigPort: get/set preferences (provider, safety, paths)

## Use Cases
- SendMessageUseCase: valida e delega para ChatAgentPort, persiste histórico
- GetHistoryUseCase: lista/filtra sessões
- StartSessionUseCase: cria sessão e define contexto inicial

## Regras
- Domínio não conhece adapters; usa apenas interfaces
- Erros externos convertidos em DomainError
- Suporte a streaming e cancelamento
