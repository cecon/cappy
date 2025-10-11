# 🧪 Guia Rápido de Teste - Sistema de Confirmação

## ⚡ Setup Rápido

### 1. Compilar tudo
```bash
npm run compile-extension
npm run build
```

### 2. Iniciar em Debug
- Pressionar **F5** no VS Code
- Nova janela do VS Code abre com extensão carregada

---

## 🎯 Casos de Teste

### ✅ Teste 1: Criar Arquivo (Happy Path)

**Objetivo**: Verificar fluxo completo de confirmação

1. **Abrir Chat**
   - Clicar no ícone Cappy na Activity Bar
   - Ou: `Ctrl+Shift+P` → "Cappy: Open Chat"

2. **Enviar mensagem**
   ```
   crie um arquivo hello.md com conteúdo:
   # Hello World
   Este é um teste.
   ```

3. **Verificar**
   - [ ] PromptMessage aparece inline (não popup)
   - [ ] Mostra pergunta: "A ferramenta 'create_file' será executada..."
   - [ ] Mostra código JSON do tool call
   - [ ] Botões visíveis: [✅ Sim] [❌ Não]
   - [ ] Background azul com borda

4. **Clicar em "Sim"**
   - [ ] Prompt desaparece
   - [ ] Mostra: "🔧 Executando: create_file"
   - [ ] Arquivo é criado no workspace
   - [ ] Mostra: "✅ File created successfully: hello.md"
   - [ ] Arquivo abre no editor

**Resultado esperado**: ✅ Arquivo criado com sucesso

---

### ❌ Teste 2: Cancelar Operação

**Objetivo**: Verificar cancelamento funciona

1. **Enviar mensagem**
   ```
   crie um arquivo cancel-test.md
   ```

2. **Clicar em "Não"**
   - [ ] Prompt desaparece
   - [ ] Mostra: "❌ Operação cancelada pelo usuário"
   - [ ] Arquivo NÃO é criado

**Resultado esperado**: ❌ Operação cancelada, arquivo não criado

---

### ⏰ Teste 3: Timeout (60s)

**Objetivo**: Verificar timeout automático

1. **Enviar mensagem**
   ```
   crie arquivo timeout-test.md
   ```

2. **NÃO clicar em nada**
   - Esperar 60 segundos

3. **Verificar**
   - [ ] Após 60s, operação é cancelada automaticamente
   - [ ] Mostra mensagem de timeout/cancelamento

**Resultado esperado**: ⏰ Timeout após 60s

---

### 🎨 Teste 4: UI/UX

**Objetivo**: Verificar aparência e animações

1. **Abrir Developer Tools**
   - Help > Toggle Developer Tools
   - Ir para aba Elements

2. **Enviar mensagem que requer tool**

3. **Verificar estilos**
   - [ ] Classe: `.message-prompt`
   - [ ] Background: `#2a3f5f`
   - [ ] Border-left: `4px solid #4a90e2`
   - [ ] Animação: slideIn
   - [ ] Hover nos botões funciona
   - [ ] Transições suaves

4. **Após responder**
   - [ ] Classe muda para: `.message-prompt--responded`
   - [ ] Background muda para verde
   - [ ] Mostra: "✅ Respondido"

**Resultado esperado**: ✨ UI bonita e responsiva

---

## 🐛 Debug

### Console Logs Esperados

**No VS Code Developer Tools** (Help > Toggle Developer Tools):

```
🛠️ Available Cappy tools: cappy_create_file
📝 Sending messages to model
💬 Last message: crie um arquivo...

<!-- userPrompt:start -->
{"messageId":"1234567890","promptType":"confirm",...}
<!-- userPrompt:end -->

[ChatPanel] Forwarding: 1234567890 -> yes

🔧 Executando: create_file
✅ File created successfully: hello.md
```

### Se algo der errado

**Prompt não aparece?**
- Verificar console: há erros?
- Verificar se Copilot está ativo
- Verificar se há subscription do GitHub Copilot

**confirm() nativo aparece?**
- Verificar se build do React foi feito: `npm run build`
- Verificar se `out/main.js` existe
- Recarregar extensão: Ctrl+R na janela de debug

**Arquivo não é criado?**
- Verificar logs: "Forwarding: ... -> yes"
- Verificar se workspace está aberto
- Verificar permissões de escrita

---

## ✅ Checklist Rápido

Antes de dar OK:

- [ ] Compilação sem erros
- [ ] PromptMessage aparece inline
- [ ] Botões funcionam
- [ ] Arquivo é criado ao confirmar
- [ ] Arquivo NÃO é criado ao cancelar
- [ ] UI bonita e responsiva
- [ ] Sem popups nativos
- [ ] Logs corretos no console

---

## 🎉 Se tudo funcionar

**Parabéns! Sistema de confirmação está pronto!** 🚀

Próximos passos:
1. Commit das mudanças
2. Push para repositório
3. Testar em ambiente de produção
4. Adicionar testes automatizados

---

**Tempo estimado de teste**: 10-15 minutos  
**Dificuldade**: Fácil  
**Requer**: VS Code + GitHub Copilot ativo
