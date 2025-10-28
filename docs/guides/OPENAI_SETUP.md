# Configurando a OpenAI API Key

A extensão Cappy agora usa o OpenAI GPT-4o-mini para processar suas mensagens. Para usar o chat, você precisa configurar sua chave de API.

## Opção 1: Variável de Ambiente (Recomendado)

### Windows PowerShell

Defina a variável de ambiente permanentemente:

```powershell
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-your-api-key-here', 'User')
```

Depois, **reinicie o VS Code** para que ele pegue a nova variável de ambiente.

### Windows Command Prompt

```cmd
setx OPENAI_API_KEY "sk-your-api-key-here"
```

Depois, **reinicie o VS Code**.

### Linux/macOS

Adicione ao seu `~/.bashrc` ou `~/.zshrc`:

```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

Execute `source ~/.bashrc` (ou `~/.zshrc`) e **reinicie o VS Code**.

## Opção 2: Arquivo .env (Desenvolvimento)

1. Copie o arquivo `.env.example` para `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Edite `.env` e coloque sua chave real:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

3. **Reinicie o VS Code**.

> ⚠️ **Atenção**: Nunca faça commit do arquivo `.env` com sua chave real! O `.gitignore` já está configurado para ignorá-lo.

## Obtendo sua Chave de API

1. Acesse https://platform.openai.com/api-keys
2. Faça login (ou crie uma conta)
3. Clique em "Create new secret key"
4. Copie a chave (ela começa com `sk-`)
5. Configure conforme as instruções acima

## Testando

1. Abra a extensão Cappy (ícone de robô na Activity Bar)
2. Digite uma mensagem no chat
3. Você deve ver a resposta streaming do GPT-4o-mini

## Modelos Disponíveis

Por padrão, usamos `gpt-4o-mini` por ser rápido e econômico. Para mudar o modelo, edite:

`src/adapters/secondary/agents/langgraph-chat-engine.ts`

```typescript
this.model = new ChatOpenAI({
  modelName: 'gpt-4o',  // ou 'gpt-4-turbo', 'gpt-3.5-turbo', etc.
  temperature: 0.7,
  streaming: true,
  maxTokens: 2000,
})
```

## Solução de Problemas

### "Error: API key not found"

- Verifique se a variável de ambiente está definida corretamente
- **Reinicie o VS Code** depois de definir a variável
- No terminal do VS Code, execute: `echo $env:OPENAI_API_KEY` (PowerShell) ou `echo %OPENAI_API_KEY%` (CMD)

### "Error: quota exceeded" ou "rate limit"

- Você excedeu o limite de uso da sua conta OpenAI
- Verifique sua cota em: https://platform.openai.com/usage
- Aguarde ou adicione créditos à sua conta

### Chat não responde

1. Abra o Developer Tools: **Help > Toggle Developer Tools**
2. Vá para a aba **Console**
3. Procure por erros relacionados a "OpenAI" ou "API key"
4. Se encontrar erros, copie e cole para análise

## Próximos Passos

Depois de configurar a API key e testar, você pode:

- ✅ Conversar com o assistente AI
- ✅ Ver streaming de respostas em tempo real
- ✅ Histórico de conversação mantido na sessão
- 🔜 Ferramentas de análise de código (em desenvolvimento)
- 🔜 Integração com workspace e terminal (em desenvolvimento)
