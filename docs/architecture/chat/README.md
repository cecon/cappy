# Chat – Arquitetura e Escopo

## Objetivos
- Prover chat na Primary Side Bar do VS Code com UI desacoplada do engine
- Apoiar fluxos de desenvolvimento (buscar, editar, executar) via agent tools
- Integrar com graph/vector retrievers sem acoplar o domínio de grafos ao chat

## Fronteiras com Graph
- Chat Domain não importa módulos do Graph Domain
- Acesso a dados do grafo apenas via ports compartilhados: GraphRepositoryPort, VectorSearchPort, DocumentReaderPort
- Interações visuais opcionais via EventBus em `shared/`

## Requisitos de UX
- Sidebar com TreeView de sessões e WebView de conversa
- Suporte a streaming de respostas e estados (loading/erro)
- Comandos: nova sessão, limpar, exportar

## Privacidade e Permissões
- Confirmação para operações destrutivas (terminal, rename massivo)
- Sandboxing de paths e limites de tamanho
- Opt-in para telemetria e logs
