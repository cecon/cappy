# Plano – VS Code Chat Provider

## Sidebar (TreeView)
- Nó raiz: "Chat Sessions"
- Itens: sessões ordenadas por recência
- Context menu: New, Rename, Delete, Export

## WebView de Conversa
- Header com título da sessão, status e ações
- Body com mensagens (markdown, code blocks)
- Input com multiline, atalhos e histórico

## UI Library
- **assistant-ui**: lib React para chat UI com suporte a streaming, markdown, code blocks
- **Tema**: Dark theme o mais próximo possível do GitHub Copilot Chat
  - Cores de fundo: tons de cinza escuro (#1e1e1e, #252526)
  - Mensagens do usuário: azul suave (#007acc)
  - Mensagens do assistant: cinza neutro (#2d2d30)
  - Code blocks: VS Code syntax highlighting
  - Inputs: bordas sutis, focus state com accent color

## Comandos
- cappy.chat.new, cappy.chat.clear, cappy.chat.export
- cappy.chat.focus, cappy.chat.rename

## Integração
- DI: recebe ChatService (ports: ChatAgentPort, ChatHistoryPort)
- Eventos: notifica atualizações de sessão para TreeView
- Acessibilidade: labels, roles, navegação por teclado
