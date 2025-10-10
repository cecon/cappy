# 🚀 Teste Rápido - Chat com OpenAI

## Status da Implementação

✅ **Concluído:**
- UI do Chat com React + streaming
- Integração com WebviewView na sidebar
- LangGraphChatEngine com ChatOpenAI (gpt-4o-mini)
- Histórico de conversação na memória
- Streaming token-by-token

🔄 **Próximo:**
- Testar com API key real
- Adicionar ferramentas (tools)
- Persistência em JSON/SQLite

## Como Testar Agora

### 1. Configure a API Key

**PowerShell (Permanente):**
```powershell
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-sua-chave-aqui', 'User')
```

**Reinicie o VS Code** depois de configurar!

### 2. Abra o Chat

1. Clique no ícone do **robô** na Activity Bar (barra lateral esquerda)
2. O chat deve abrir na sidebar

### 3. Envie uma Mensagem

Digite algo como:
- "Olá, o que você pode fazer?"
- "Explique o que é TypeScript"
- "Me ajude a criar uma função para calcular fibonacci"

### 4. Observe o Streaming

Você deve ver:
- ⏳ Indicador "Streaming..." no header
- ✨ Tokens aparecendo em tempo real
- ✅ Mensagem completa ao final

## Arquitetura Atual

```
Usuário digita mensagem
    ↓
ChatView.tsx (React)
    ↓
postMessage → ChatViewProvider.ts
    ↓
chatService.sendMessage()
    ↓
LangGraphChatEngine.processMessage()
    ↓
ChatOpenAI.stream() [gpt-4o-mini]
    ↓
Tokens → streamToken messages → ChatView
    ↓
UI atualiza em tempo real
```

## Configuração Atual

**Modelo:** `gpt-4o-mini`
- Rápido e econômico
- Bom para uso geral
- ~$0.15 por 1M tokens input / $0.60 por 1M tokens output

**Parâmetros:**
- `temperature: 0.7` (criativo mas não muito)
- `maxTokens: 2000` (respostas razoáveis)
- `streaming: true` (token-by-token)

**System Prompt:**
> "You are Cappy, an AI coding assistant integrated into VS Code. You help developers write code, debug issues, understand codebases, and improve productivity. Be concise, helpful, and provide actionable advice. Use markdown formatting for code blocks."

## Solução de Problemas

### Chat não carrega
- Abra Developer Tools (Help > Toggle Developer Tools)
- Veja se há erros no Console
- Verifique se os arquivos out/main.js e out/style.css existem

### "Error: API key not found"
- Execute no PowerShell: `echo $env:OPENAI_API_KEY`
- Se vazio, configure conforme passo 1
- **Reinicie o VS Code** (importante!)

### Resposta demora muito
- Primeira requisição pode demorar ~2-5 segundos (cold start)
- Requisições seguintes devem ser mais rápidas
- Verifique sua conexão de internet

### Erro de quota/rate limit
- Sua conta OpenAI não tem créditos suficientes
- Acesse: https://platform.openai.com/usage
- Adicione créditos ou aguarde reset do limite gratuito

## Debug Avançado

### Verificar logs da extensão

1. Abra Output panel: **View > Output**
2. Selecione "Cappy" no dropdown (se disponível)
3. Ou selecione "Log (Extension Host)" para ver logs gerais

### Verificar comunicação webview

No Developer Tools Console, execute:
```javascript
// Ver mensagens enviadas
window.postMessage
// Ver API do VS Code
window.vscodeApi
```

### Ver contexto da conversa

Os logs da extensão devem mostrar:
- Mensagens do usuário sendo recebidas
- Tokens sendo gerados
- Histórico sendo passado ao modelo

## Próximas Melhorias

1. **Markdown Rendering**: Mensagens com syntax highlighting
2. **Tools/Functions**: Integração com workspace, terminal, RAG
3. **Persistent Storage**: Salvar sessões entre reinicializações
4. **Session Management**: UI para criar/deletar/trocar sessões
5. **LangGraph Workflow**: understand → plan → execute → synthesize

## Está Funcionando? 🎉

Se você conseguiu:
- ✅ Ver o chat na sidebar
- ✅ Enviar uma mensagem
- ✅ Ver resposta streaming do GPT-4o-mini

**Parabéns!** O básico está funcionando. Agora podemos adicionar ferramentas e melhorias.

## Não Está Funcionando? 🔧

1. Verifique os logs (Developer Tools)
2. Confirme que a API key está configurada
3. Teste no terminal: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $env:OPENAI_API_KEY"`
4. Recompile e reinstale: `.\install.ps1`
