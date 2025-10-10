# Plano – VS Code Chat Provider

## Sidebar (TreeView)
- Nó raiz: "Chat Sessions"
- Itens: sessões ordenadas por recência
- Context menu: New, Rename, Delete, Export

## WebView de Conversa
- Header com título da sessão, status e ações
- Body com mensagens (markdown, code blocks)
- Input com multiline, atalhos e histórico

## Comandos
- cappy.chat.new, cappy.chat.clear, cappy.chat.export
- cappy.chat.focus, cappy.chat.rename

## Integração
- DI: recebe ChatService (ports: ChatAgentPort, ChatHistoryPort)
- Eventos: notifica atualizações de sessão para TreeView
- Acessibilidade: labels, roles, navegação por teclado
