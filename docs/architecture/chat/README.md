# 📚 Chat Cappy 3.0 - Documentação Completa

## 🎯 Visão Geral

O Chat Cappy 3.0 usa a biblioteca **@assistant-ui/react** para fornecer uma experiência de chat moderna, com suporte a:
- 💬 Streaming de respostas em tempo real
- 🧠 Reasoning/Pensamento (estilo GPT-4 o1)
- 🛠️ Tool Calls interativos
- ❓ Perguntas ao usuário
- 🎨 UI componibilizada com primitives

## 📖 Documentação Detalhada

### 📝 Guias de Implementação

1. **[REASONING_SUPPORT.md](./REASONING_SUPPORT.md)**
   - Implementação da funcionalidade de "pensamento" similar ao GPT-4 o1
   - Como funciona no backend e frontend
   - Customização visual e exemplos

2. **[ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md)**
   - Guia completo das features da @assistant-ui/react
   - Tool calls, attachments, multimodal
   - Context management avançado

3. **[USER_PROMPTS.md](./USER_PROMPTS.md)**
   - Como fazer o assistente fazer perguntas ao usuário
   - Implementação de fluxos interativos
   - Casos de uso práticos

4. **[ICONS_UPDATE.md](./ICONS_UPDATE.md)**
   - Mudança de emojis para SVG nos avatares
   - Design system dos ícones
   - Como personalizar

5. **[QUICK_START.md](./QUICK_START.md)**
   - Guia rápido para começar a usar
   - Setup, teste e debug

6. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)**
   - Resumo executivo da implementação
   - Arquitetura e decisões técnicas

---

## 🏗️ Arquitetura

### Objetivos
- Chat na Primary Side Bar do VS Code com UI desacoplada
- Streaming de respostas com @assistant-ui/react
- Apoiar fluxos de desenvolvimento via agent tools
- Integrar com graph/vector retrievers

### Fronteiras com Graph Domain
- Chat Domain não importa módulos do Graph Domain
- Acesso a dados via ports: GraphRepositoryPort, VectorSearchPort, DocumentReaderPort
- Interações visuais via EventBus em `shared/`

### Stack Tecnológica
- **@assistant-ui/react** v0.11.28 - Framework de chat UI
- **@assistant-ui/react-markdown** v0.11.1 - Rendering de markdown
- **React** 19.1.1 - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool
- **VS Code Webview API** - Integração

---

## 🚀 Quick Start

```powershell
# 1. Instalar dependências
npm install

# 2. Compilar frontend e extension
npm run build
npm run compile-extension

# 3. Empacotar e instalar
npx @vscode/vsce package --out cappy-3.0.2.vsix
code --install-extension cappy-3.0.2.vsix --force

# 4. Recarregar VS Code (Ctrl+R)

# 5. Abrir chat: Ctrl+Shift+P → "Cappy: Open Chat"
```

---

## 🎨 Componentes Principais

### ChatView.tsx
Componente React principal que renderiza o chat.

**Responsabilidades**:
- Gerenciar runtime com `useLocalRuntime()`
- Conectar backend via `VSCodeChatAdapter`
- Renderizar mensagens com `ThreadPrimitive`
- Processar reasoning, tool calls, user prompts

### VSCodeChatAdapter
Adapter que conecta o backend VS Code com @assistant-ui/react.

**Funcionalidades**:
- Recebe eventos do backend via `postMessage`
- Transforma em `ChatModelRunResult` para assistant-ui
- Gerencia fila de reasoning
- Suporta streaming progressivo

### ChatViewProvider.ts
Provider VS Code que gerencia o webview.

**Responsabilidades**:
- Criar e gerenciar webview
- Rotear mensagens entre extension e webview
- Prevenir "View already awaiting revival"
- Cleanup e disposal

---

## 🔄 Fluxo de Eventos

```
User Input
    ↓
ChatView (React)
    ↓
VSCodeChatAdapter.run()
    ↓
postMessage → Backend
    ↓
LangGraphChatEngine
    ↓
Generate Response
    ↓
Events: thinking → streamStart → streamToken(s) → streamEnd
    ↓
VSCodeChatAdapter processa
    ↓
assistant-ui runtime
    ↓
UI atualiza (reasoning, texto, tool calls)
```

---

## 📝 Requisitos de UX

- ✅ Sidebar com sessões e WebView de conversa
- ✅ Streaming de respostas em tempo real
- ✅ Estados visuais (loading, erro, thinking)
- ✅ Avatares personalizados (SVG)
- ✅ Reasoning display (estilo o1)
- ✅ Comandos: nova sessão, limpar, exportar
- 🔄 Tool calls interativos (em progresso)
- 🔄 User prompts (em progresso)

---

## 🔒 Privacidade e Permissões

- Confirmação para operações destrutivas
- Sandboxing de paths e limites de tamanho
- Opt-in para telemetria e logs
- Content Security Policy (CSP) com nonce

---

## 🐛 Debug e Troubleshooting

### Ver eventos do webview
1. `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"
2. Console mostrará todos os `postMessage` events

### Logs da extensão
```powershell
# Output window
View → Output → Cappy Extension Host
```

### Erros comuns

**"View already awaiting revival"**
- Causa: Múltiplas tentativas de criar webview
- Solução: Implementado disposal cleanup no provider

**Webview sandbox warnings**
- Causa: CSP muito permissivo
- Solução: Implementado nonce-based CSP

**SVG não carrega**
- Causa: Vite config ou path incorreto
- Solução: Usar `base: './'` e imports relativos

---

## 📚 Recursos Externos

- [@assistant-ui/react Documentation](https://www.assistant-ui.com/)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [React 19 Docs](https://react.dev/)

---

## 🤝 Contribuindo

Para adicionar funcionalidades:

1. **Backend**: Modifique `LangGraphChatEngine.ts`
2. **Adapter**: Atualize `VSCodeChatAdapter` no `ChatView.tsx`
3. **UI**: Adicione componentes em `MessagePrimitive.Parts`
4. **Docs**: Documente aqui ou em arquivo específico
5. **Teste**: Compile, instale e recarregue VS Code

---

**Última atualização**: 10 de outubro de 2025  
**Versão**: 3.0.2  
**Status**: ✅ Produção com @assistant-ui/react
