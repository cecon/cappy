# 🚀 Próximos Passos - Sistema de Confirmação

## ✅ Implementação Base Completa

- [x] Tipos TypeScript (prompt.ts)
- [x] Componente PromptMessage.tsx
- [x] Estilos CSS
- [x] Backend: LangGraphChatEngine
- [x] Frontend: VSCodeChatAdapter (parsing)
- [x] ChatPanel: Handler básico

## 🔧 Integração Final Pendente

### 1. Remover confirm()/prompt() Nativos ⚠️

**Arquivo**: `src/components/ChatView.tsx`

**Status atual**: Usa `confirm()` e `prompt()` do browser (temporário)

**O que fazer**:
```tsx
// Substituir promptUser() para renderizar PromptMessage inline
// ao invés de usar confirm()/prompt()

// Adicionar estado:
const [currentPrompt, setCurrentPrompt] = useState<UserPrompt | null>(null)
const [promptResolver, setPromptResolver] = useState<((response: string) => void) | null>(null)

// Modificar promptUser():
private async promptUser(promptData: UserPrompt): Promise<string> {
  return new Promise((resolve) => {
    setCurrentPrompt(promptData)
    setPromptResolver(() => resolve)
  })
}

// Renderizar no JSX:
{currentPrompt && (
  <PromptMessage
    prompt={currentPrompt}
    onResponse={(response) => {
      if (promptResolver) {
        promptResolver(response)
        setCurrentPrompt(null)
        setPromptResolver(null)
      }
    }}
  />
)}
```

### 2. Conectar Engine ao ChatPanel 🔗

**Arquivo**: `src/adapters/primary/vscode/chat/ChatPanel.ts`

**Problema atual**: Handler de `userPromptResponse` não encaminha para o engine

**O que fazer**:

**2.1. Modificar ChatService para expor engine**
```typescript
// Em src/domains/chat/services/chat-service.ts
export class ChatService {
  private engine: LangGraphChatEngine

  public getEngine(): LangGraphChatEngine {
    return this.engine
  }
}
```

**2.2. Atualizar ChatPanel.onMessage()**
```typescript
case 'userPromptResponse': {
  if (msg.messageId && msg.response !== undefined) {
    const engine = this.chat.getEngine()
    engine.handleUserPromptResponse(msg.messageId, msg.response)
  }
  break
}
```

### 3. Testar Fluxo Completo 🧪

**Como testar**:

1. Abrir extensão em modo debug (F5)
2. Abrir chat do Cappy
3. Enviar: "crie um arquivo test.md com conteúdo de exemplo"
4. **Verificar**:
   - [ ] Aparece PromptMessage inline (não confirm() nativo)
   - [ ] Mostra detalhes do tool call
   - [ ] Botões Sim/Não funcionam
   - [ ] Ao clicar Sim: arquivo é criado
   - [ ] Ao clicar Não: operação é cancelada
   - [ ] Mensagem de confirmação aparece no chat

### 4. Melhorias de UX 🎨

#### 4.1. Timeout Visual
```tsx
// Em PromptMessage.tsx
const [timeLeft, setTimeLeft] = useState(60)

useEffect(() => {
  const timer = setInterval(() => {
    setTimeLeft(prev => prev - 1)
  }, 1000)
  return () => clearInterval(timer)
}, [])

// Renderizar progress bar:
<div className="prompt-timeout">
  Tempo restante: {timeLeft}s
  <progress value={timeLeft} max={60} />
</div>
```

#### 4.2. Cancelar Manualmente
```tsx
<button 
  className="prompt-button prompt-button--cancel"
  onClick={() => handleResponse('cancel')}
>
  ⏹️ Cancelar
</button>
```

#### 4.3. Preview de Operações
```tsx
{prompt.toolCall?.name === 'create_file' && (
  <div className="prompt-preview">
    <h4>Preview do arquivo:</h4>
    <pre>{prompt.toolCall.input.content}</pre>
  </div>
)}
```

### 5. Multi-Step Wizards 🪄

**Caso de uso**: Criar componente com múltiplas perguntas

```typescript
// 1. Perguntar nome
const name = await promptUser({
  promptType: 'input',
  question: 'Nome do componente?'
})

// 2. Perguntar tipo
const type = await promptUser({
  promptType: 'select',
  question: 'Tipo de componente?',
  options: ['Function', 'Class', 'Hooks']
})

// 3. Confirmar
const withTests = await promptUser({
  promptType: 'confirm',
  question: 'Incluir testes?'
})

// Executar com todas as respostas
createComponent({ name, type, withTests })
```

## 📊 Prioridades

### 🔥 Crítico (Fazer Agora)
1. ✅ Implementação base completa
2. ⏳ Remover confirm()/prompt() nativos
3. ⏳ Conectar engine ao panel

### 🔶 Importante (Próxima Sprint)
4. Testar fluxo completo
5. Adicionar timeout visual
6. Permitir cancelamento manual

### 🔵 Desejável (Backlog)
7. Preview de operações
8. Multi-step wizards
9. Histórico de prompts
10. Analytics

## 🐛 Issues a Resolver

1. **Engine não recebe resposta**
   - **Causa**: ChatPanel não encaminha para engine
   - **Fix**: Implementar getEngine() e chamar handleUserPromptResponse()

2. **Prompt usa confirm() nativo**
   - **Causa**: Implementação temporária
   - **Fix**: Renderizar PromptMessage inline com estado

3. **Sem feedback visual de timeout**
   - **Causa**: User não sabe que tem 60s
   - **Fix**: Adicionar progress bar e contador

## 📝 Checklist de Verificação

Antes de dar merge:
- [ ] Código compila sem erros
- [ ] Testes unitários (se houver)
- [ ] Testar manualmente fluxo completo
- [ ] Documentação atualizada
- [ ] Screenshots/GIFs da funcionalidade
- [ ] Code review
- [ ] Performance check (não trava UI)

## 🔗 Links Úteis

- [CONFIRMATION_SYSTEM.md](./CONFIRMATION_SYSTEM.md) - Spec completa
- [CONFIRMATION_IMPLEMENTATION_STATUS.md](./CONFIRMATION_IMPLEMENTATION_STATUS.md) - Status atual
- [USER_PROMPTS_SUPPORT.md](./USER_PROMPTS_SUPPORT.md) - Detalhes técnicos

---

**Última atualização**: 11 de Outubro de 2025  
**Status**: Base implementada, integração final pendente
