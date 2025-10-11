# 🚀 Quick Start - Testando o Chat com Reasoning

## ⚡ Início Rápido (30 segundos)

### 1. Recarregar VS Code
```
Pressione: Ctrl+R (Windows/Linux) ou Cmd+R (Mac)
```

### 2. Abrir Cappy Chat
- Clique no ícone 🦫 na sidebar esquerda
- Ou: `Ctrl+Shift+P` → "Cappy: Open Chat"

### 3. Fazer Pergunta de Teste
Cole uma destas perguntas:

```
Como otimizar este código React?
```

```
Explique a diferença entre Promise.all e Promise.race
```

```
Crie um componente TypeScript com hooks
```

## 👀 O que Observar

### ✅ Reasoning em Ação

Você deverá ver:

1. **Caixa de Reasoning** (cinza escuro, ícone 🧠):
```
🧠 Analisando sua pergunta...
🔍 Selecionando modelo apropriado...
✅ Usando modelo: gpt-4o
📊 Processando contexto de X mensagens...
```

2. **Resposta Normal** (abaixo):
```
Para otimizar esse código React, você pode:
1. Usar useMemo para...
2. Implementar useCallback para...
```

### ✅ Tool Calls (se aplicável)

Se o modelo usar uma tool:

```
🔧 Usando tool: create file

✅ File created successfully: component.tsx
```

## 🎯 Perguntas que Ativam Reasoning

### Análise de Código
```
"Analise este componente e sugira melhorias"
"O que está errado neste código?"
"Como refatorar esta função?"
```

### Explicações Técnicas
```
"Explique como funciona o Virtual DOM"
"Diferença entre var, let e const"
"O que é hoisting em JavaScript?"
```

### Criação de Código
```
"Crie um hook customizado para fetch"
"Implemente autenticação JWT"
"Gere testes unitários para este componente"
```

## 🐛 Troubleshooting

### Não vejo o reasoning

**Causa**: Backend não está emitindo marcadores

**Solução**: Verificar console:
```javascript
// Abra DevTools: Help > Toggle Developer Tools
// Console tab
// Procure por logs [Reasoning] ou [ChatView]
```

### Reasoning aparece no texto normal

**Causa**: Marcadores não estão sendo processados

**Solução**: Verifique que os marcadores estão corretos:
```
<!-- reasoning:start -->
<!-- reasoning:end -->
```

### Erro "No Copilot models available"

**Causa**: GitHub Copilot não está ativo

**Solução**:
1. Instale GitHub Copilot extension
2. Faça login na sua conta GitHub
3. Verifique assinatura ativa

## 🔍 Debug Mode

### Ver todos os eventos

1. Abra DevTools: `Help > Toggle Developer Tools`
2. Console tab
3. Envie mensagem no chat
4. Observe logs:

```
[ChatViewProvider] Sending message...
[LangGraphChatEngine] Processing message...
[VSCodeChatAdapter] Received thinking event
[VSCodeChatAdapter] Received streamStart
[VSCodeChatAdapter] Processing token...
```

### Ver estado do runtime

No Console do DevTools:

```javascript
// Ver mensagens atuais
window.runtime?.getState()

// Ver se está processando
window.runtime?.isRunning
```

## 📊 Métricas de Sucesso

### ✅ Tudo OK se você vê:

- [ ] Caixa de reasoning aparece
- [ ] Reasoning tem conteúdo relevante
- [ ] Resposta aparece abaixo do reasoning
- [ ] Streaming funciona suavemente
- [ ] Sem erros no console

### ⚠️ Precisa investigar se:

- [ ] Reasoning não aparece
- [ ] Reasoning aparece vazio
- [ ] Marcadores aparecem no texto
- [ ] Erros no console
- [ ] Streaming trava

## 🎨 Personalização Rápida

### Mudar cor do reasoning

Edite `src/components/ChatView.tsx`:

```tsx
// Linha ~216
backgroundColor: '#1a1a2e',  // Azul escuro
borderLeft: '3px solid #ff6b6b'  // Borda vermelha
```

### Mudar ícone

```tsx
// Linha ~212
<span style={{ marginRight: '6px' }}>🤔</span>  // Ou outro emoji
```

### Adicionar animação

```tsx
animation: 'pulse 2s infinite'
```

## 🔧 Comandos Úteis

### Recompilar extensão
```powershell
npm run build; npm run compile-extension
```

### Reinstalar extensão
```powershell
code --install-extension (Get-ChildItem -Filter "cappy-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
```

### Ver logs
```powershell
# Abra Output panel
# Selecione "Cappy" no dropdown
```

## 📝 Checklist de Teste

Teste cada item:

- [ ] Chat abre sem erros
- [ ] Mensagem é enviada
- [ ] Reasoning aparece
- [ ] Resposta é streamada
- [ ] Pode enviar múltiplas mensagens
- [ ] Histórico funciona
- [ ] Tool calls aparecem (se aplicável)
- [ ] Erros são tratados graciosamente

## 🎯 Casos de Teste Específicos

### Teste 1: Reasoning Básico
**Input**: "Explique async/await"
**Esperado**: Reasoning sobre análise do conceito

### Teste 2: Tool Call
**Input**: "Crie um arquivo teste.ts"
**Esperado**: 
1. Reasoning sobre criação
2. Tool call: cappy_createFile
3. Confirmação de sucesso

### Teste 3: Erro Handling
**Input**: [Desconecte Copilot]
**Esperado**: Mensagem de erro amigável

### Teste 4: Histórico
**Input**: 
1. "Meu nome é João"
2. "Qual é o meu nome?"
**Esperado**: Resposta "João" (contexto mantido)

## 🆘 Suporte

### Documentação Completa
- `IMPLEMENTATION_SUMMARY.md` - Visão geral
- `REASONING_SUPPORT.md` - Detalhes de reasoning
- `USER_PROMPTS_SUPPORT.md` - Perguntas ao usuário
- `ADVANCED_FEATURES.md` - Todas as features

### Código Fonte
- `src/components/ChatView.tsx` - Frontend
- `src/adapters/primary/vscode/chat/ChatViewProvider.ts` - Bridge
- `src/adapters/secondary/agents/langgraph-chat-engine.ts` - Backend

### Logs
```powershell
# Ver logs em tempo real
code --log-level=trace
```

## 🎉 Sucesso!

Se você viu o reasoning funcionando, parabéns! 🎊

Você agora tem um chat com:
- ✅ Reasoning estilo GPT-4 o1
- ✅ Streaming suave
- ✅ Tool calls integrados
- ✅ UI moderna com @assistant-ui/react

**Próximo passo**: Testar perguntas mais complexas e explorar customizações!
