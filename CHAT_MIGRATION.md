# Cappy Chat - LangGraph + Assistant UI

## Nova Arquitetura do Chat

O chat do Cappy foi completamente migrado para usar **LangGraph SDK** com **LangChain JS/TypeScript** e **assistant-ui** como interface padrão.

## Principais Mudanças

### ✅ Tecnologias Implementadas

- **LangGraph SDK** - Para orquestração de conversas e workflows
- **LangChain JS/TypeScript** - Para integração com LLMs e tools
- **Assistant UI** - Interface de chat padrão e moderna
- **Estrutura de Services/Tools** - Organização modular das funcionalidades

### 🏗️ Nova Estrutura de Arquivos

```
src/
├── components/
│   └── chat-new/
│       ├── Chat.tsx         # Componente principal do chat
│       ├── Chat.css         # Estilos do chat
│       └── index.ts         # Exports do módulo
├── services/
│   ├── langgraph/
│   │   ├── adapter.ts       # Adaptador legado (removido)
│   │   ├── engine.ts        # Engine principal do LangGraph
│   │   ├── runtime.ts       # Runtime para gerenciar conversas
│   │   └── config.ts        # Configurações do LangGraph
│   └── tools/
│       └── terminal/
│           ├── index.ts     # Utilitários básicos
│           └── terminalTool.ts # Tool LangChain para terminal
└── TestChatPage.tsx         # Página de teste para validação
```

### 🛠️ Tools Implementadas

#### Terminal Tool
- **Localização**: `src/services/tools/terminal/terminalTool.ts`
- **Funcionalidades**:
  - Execução de comandos no terminal
  - Suporte a interação do usuário
  - Controle de diretório de trabalho
  - Captura de saída e erros

**Exemplo de uso**:
```typescript
import { terminalTool } from '../services/tools/terminal/terminalTool';

// A tool é automaticamente registrada no LangGraph
// e pode ser chamada pelo usuário através do chat
```

### 🔧 Configuração

#### LangGraph Config
```typescript
// src/services/langgraph/config.ts
export const langGraphConfig = {
  model: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
  }),
  tools: [terminalTool],
  graph: {
    maxIterations: 10,
    recursionLimit: 50,
  }
};
```

## Como Usar

### Desenvolvimento
1. As dependências foram adicionadas ao `package.json`:
   - `@langchain/core`
   - `@langchain/openai` 
   - `@langchain/langgraph`
   - `@assistant-ui/react`

2. Para testar o chat:
   ```typescript
   import { testChatPage } from './components/TestChatPage';
   // Renderizar o componente em uma aplicação React
   ```

### Comandos de Exemplo
- "Executar comando dir" - Executa comando no terminal
- "Execute npm install" - Instala dependências
- "Listar arquivos da pasta src" - Lista arquivos

## Arquivos Removidos

### ❌ Chat Legado Removido
- `src/webview/chat.html`
- `src/webview/chat.css` 
- `src/webview/chat-app/` (pasta completa)
- `src/ui/chatProvider.ts`
- Referências no `extension.ts` comentadas/removidas

## Próximos Passos

1. **Integração com VS Code**: Criar novo provider para VS Code
2. **Mais Tools**: Adicionar tools para análise de código, geração de docs, etc.
3. **Persistência**: Implementar salvamento de conversas
4. **Customização**: Permitir configuração de modelos e tools pelo usuário

## Dependências

```json
{
  "@langchain/core": "^0.3.15",
  "@langchain/openai": "^0.3.12", 
  "@langchain/langgraph": "^0.2.17",
  "@assistant-ui/react": "^0.11.28"
}
```

## Status da Migração

- [x] ✅ Configurar dependências LangGraph + Assistant UI
- [x] ✅ Criar estrutura services/tools
- [x] ✅ Implementar terminal tool com interação
- [x] ✅ Migrar interface para assistant-ui
- [x] ✅ Integrar LangGraph com assistant-ui  
- [x] ✅ Remover código legado do chat
- [x] ✅ Integrar com VS Code Extension (ChatViewProvider)
- [x] ✅ Criar build system para React component (esbuild)
- [x] ✅ Registrar provider e comandos no extension.ts
- [x] ✅ Configurar viewsContainer no package.json
- [ ] 🚧 Testar integração completa
- [ ] 🚧 Implementar persistência de conversas

## 🚀 Integração em Produção (Concluída)

### Arquivos Criados/Modificados

1. **`src/ui/chatViewProvider.ts`** - Provider VS Code para webview do chat
2. **`src/components/chat-new/chatBundle.tsx`** - Entry point React para bundle
3. **`build-chat.js`** - Script esbuild para bundle React
4. **`src/extension.ts`** - Registrado ChatViewProvider e comando cappy.chat
5. **`package.json`** - Adicionado scripts e dependência esbuild

### Como Usar em Produção

1. **Build da extensão**:
   ```bash
   npm run compile     # Compila TypeScript + build React
   ```

2. **Abrir Chat**:
   - Command Palette: `Cappy: Open Task Chat`
   - Ou clique no ícone na Activity Bar: "Cappy Task Chat"

3. **Features Disponíveis**:
   - ✅ Interface React moderna com assistant-ui
   - ✅ Integração com LangGraph para orquestração
   - ✅ Terminal tool para executar comandos
   - ✅ Acesso ao contexto do workspace
   - ✅ Informações da task ativa

### Arquitetura de Produção

```
VS Code Extension (TypeScript)
    ↓
ChatViewProvider (WebviewViewProvider)
    ↓
Webview (HTML + React Bundle)
    ↓
Chat Component (React + assistant-ui)
    ↓
LangGraphRuntime → LangGraphChatEngine
    ↓
Tools (terminal, workspace, tasks)
```