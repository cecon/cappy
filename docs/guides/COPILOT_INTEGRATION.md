# 🎯 Integração com GitHub Copilot

A extensão Cappy agora usa a **API de Language Model do VS Code** para acessar os modelos do GitHub Copilot diretamente, sem necessidade de configurar API keys externas!

## ✨ Vantagens

✅ **Sem API Keys**: Usa sua assinatura do GitHub Copilot
✅ **Integração Nativa**: Via `vscode.lm.selectChatModels()`
✅ **Streaming Real**: Tokens aparecem em tempo real
✅ **Múltiplos Modelos**: Suporte a GPT-4o e outros modelos Copilot
✅ **Gerenciamento de Permissões**: VS Code cuida do consentimento do usuário

## 📋 Pré-requisitos

1. **GitHub Copilot Extension** instalada e ativa
2. **Assinatura do GitHub Copilot** válida
3. **Login no GitHub** dentro do VS Code

## 🚀 Como Usar

### 1. Verifique suas Extensões

Certifique-se que tem o GitHub Copilot instalado:
```
Extensions > Search: "GitHub Copilot"
```

### 2. Faça Login no GitHub

Se ainda não fez:
1. Clique no ícone de conta no canto inferior esquerdo
2. Selecione "Sign in to Sync Settings" ou "Sign in with GitHub"
3. Autorize no navegador

### 3. Abra o Chat

1. Clique no **ícone do robô** na Activity Bar
2. O chat abrirá na sidebar
3. Digite uma mensagem e pressione Enter

### 4. Primeira Mensagem - Consentimento

Na **primeira vez** que usar o chat, o VS Code pode mostrar um dialog pedindo permissão para usar o Language Model. Clique em **"Allow"** para continuar.

## 🔧 Implementação Técnica

### Seleção do Modelo

```typescript
const models = await vscode.lm.selectChatModels({
  vendor: 'copilot',
  family: 'gpt-4o'
})
```

### Envio de Mensagens

```typescript
const messages: vscode.LanguageModelChatMessage[] = [
  vscode.LanguageModelChatMessage.User('System prompt...'),
  vscode.LanguageModelChatMessage.User('User message'),
  vscode.LanguageModelChatMessage.Assistant('Previous response')
]

const response = await model.sendRequest(messages, {}, token)
```

### Streaming de Tokens

```typescript
for await (const chunk of response.text) {
  yield chunk // Stream to UI
}
```

## 📊 Modelos Disponíveis

| Família | Modelos | Descrição |
|---------|---------|-----------|
| `gpt-4o` | gpt-4o, gpt-4o-mini | Modelos multimodais mais recentes |
| `gpt-4` | gpt-4-turbo, gpt-4 | Modelos GPT-4 clássicos |
| `gpt-3.5` | gpt-3.5-turbo | Modelo mais rápido e econômico |

Por padrão, Cappy usa `gpt-4o` que é o mais capaz e rápido.

## 🛠️ Implementação no Cappy

O agente conversacional está implementado em:
`src/nivel2/infrastructure/agents/conversational/graph.ts`

Ele utiliza um **thinking loop** de 5 etapas:
1. **Analysis** - Analisa intenção do usuário
2. **Planning** - Cria plano de ação com tools
3. **Execution** - Executa tools (cappy_retrieve_context, cappy_grep_search, cappy_read_file)
4. **Reflection** - Reflete sobre informações coletadas
5. **Response** - Gera resposta final

## ❌ Erros Comuns

### "No Copilot models available"

**Causa**: GitHub Copilot não instalado ou não ativo

**Solução**:
1. Instale GitHub Copilot extension
2. Verifique que sua assinatura está ativa
3. Reinicie o VS Code

### "NoPermissions" Error

**Causa**: Usuário não concedeu permissão para usar o Language Model

**Solução**:
- O VS Code mostrará um dialog na primeira requisição
- Clique em "Allow" para autorizar
- A extensão lembrará da sua escolha

### "NotFound" Error

**Causa**: Modelo solicitado não existe

**Solução**:
- Verifique se está usando um modelo válido
- Atualize GitHub Copilot para a versão mais recente
- Tente com `family: 'gpt-3.5-turbo'` como fallback

### "Blocked" Error

**Causa**: Limite de quota ou rate limit atingido

**Solução**:
- Aguarde alguns minutos
- Sua cota é gerenciada pela assinatura do GitHub Copilot
- Entre em contato com suporte do GitHub se persistir

## 🔐 Privacidade e Segurança

- ✅ Suas mensagens são processadas pela API do GitHub Copilot
- ✅ Mesmo nível de privacidade que usar o Copilot Chat
- ✅ Não enviamos dados para servidores terceiros
- ✅ VS Code gerencia tokens e autenticação

## 📈 Próximos Passos

Agora que o chat básico está funcionando com Copilot:

1. ✅ **Testar streaming** - Envie mensagens e veja respostas em tempo real
2. 🔜 **Adicionar Tools** - Integrar ferramentas de análise de código
3. 🔜 **Persistência** - Salvar sessões e histórico
4. 🔜 **Markdown Rendering** - Mostrar código formatado
5. 🔜 **LangGraph Workflow** - Adicionar planejamento e execução

## 🎉 Vantagens vs OpenAI Direto

| Aspecto | Copilot API | OpenAI Direto |
|---------|-------------|---------------|
| **API Key** | Não precisa | Necessária |
| **Custo** | Incluso na assinatura | Pay-per-use |
| **Setup** | Zero configuração | Configurar .env |
| **Integração** | Nativa no VS Code | Via biblioteca |
| **Permissões** | Gerenciadas pelo VS Code | Manual |
| **Modelos** | Copilot curados | Todos OpenAI |

## 📚 Referências

- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [GitHub Copilot](https://github.com/features/copilot)
- [VS Code Extension API](https://code.visualstudio.com/api)
