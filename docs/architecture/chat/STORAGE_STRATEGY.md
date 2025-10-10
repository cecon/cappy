# Strategy – Storage do Chat

## Opções
- JSON local (workspace/.cappy/chat/*.json)
- SQLite local (file-based)
- LanceDB (quando integrar com RAG do chat)

## Critérios
- Tamanho previsto por sessão
- Criptografia/privacidade
- Portabilidade/backup
- Performance de leitura/escrita

## Decisão Provisória
- Começar com JSON local por simplicidade
- Adapter secundário permite trocar para SQLite/LanceDB sem impacto no domínio
