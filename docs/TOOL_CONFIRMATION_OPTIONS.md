# Opções para Confirmação de Tools no Chat

## Situação Atual

Estamos usando um sistema **customizado** com:
- Markers no stream (`<!-- userPrompt:start -->`)
- CustomEvents (`prompt-request`)
- Componente `PromptMessage` separado
- Estado manual com `useState`

## Opção 1: useAssistantTool (@assistant-ui/react) ⚠️

**Status**: Precisa verificar se está disponível na versão atual

```tsx
import { useAssistantTool } from '@assistant-ui/react';

function ToolConfirmations() {
  useAssistantTool({
    toolName: 'cappy_create_file',
    render: ({ args, status }) => {
      if (status.type === 'requires-action') {
        return (
          <div className="tool-confirmation">
            <p>Criar arquivo: {args.path}</p>
            <button onClick={() => status.confirm()}>Sim</button>
            <button onClick={() => status.cancel()}>Não</button>
          </div>
        );
      }
      return null;
    }
  });
  
  return null;
}
```

**Prós**:
- ✅ Integração nativa com @assistant-ui
- ✅ Gerenciamento automático de estado
- ✅ API limpa e declarativa

**Contras**:
- ❌ Precisa verificar se existe na versão 0.11.29
- ❌ Pode não suportar confirmações via backend (nosso caso)

## Opção 2: Custom Message Type (Sistema Atual - Melhorado)

**Status**: ✅ Já implementado, funciona

```tsx
// No ChatView, adicionar tipo customizado de mensagem
<ThreadPrimitive.Messages
  components={{
    UserMessage: () => <MessagePrimitive.Root>...</MessagePrimitive.Root>,
    AssistantMessage: () => <MessagePrimitive.Root>...</MessagePrimitive.Root>,
    // Adicionar tipo customizado
    PromptMessage: () => (
      <PromptMessage 
        prompt={currentPrompt} 
        onResponse={handlePromptResponse} 
      />
    )
  }}
/>
```

**Prós**:
- ✅ Já funciona
- ✅ Controle total sobre UI
- ✅ Suporta nosso fluxo backend → frontend
- ✅ Compatível com markers no stream

**Contras**:
- ⚠️ Usa `confirm()`/`prompt()` nativos (temporário)
- ⚠️ Precisa integrar melhor com o fluxo de mensagens

## Opção 3: Inline Messages com useAssistantRuntime

**Status**: Alternativa viável

```tsx
import { useAssistantRuntime } from '@assistant-ui/react';

function ChatView() {
  const runtime = useLocalRuntime(adapter);
  const [currentPrompt, setCurrentPrompt] = useState<UserPrompt | null>(null);

  useEffect(() => {
    const handlePromptRequest = (event: PromptRequestEvent) => {
      setCurrentPrompt(event.detail.prompt);
    };
    
    window.addEventListener('prompt-request', handlePromptRequest);
    return () => window.removeEventListener('prompt-request', handlePromptRequest);
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Messages normais */}
      <ThreadPrimitive.Messages />
      
      {/* Prompt inline renderizado fora do thread */}
      {currentPrompt && (
        <div className="inline-prompt-overlay">
          <PromptMessage 
            prompt={currentPrompt}
            onResponse={(response) => {
              vscode.postMessage({
                type: 'userPromptResponse',
                messageId: currentPrompt.messageId,
                response
              });
              setCurrentPrompt(null);
            }}
          />
        </div>
      )}
    </AssistantRuntimeProvider>
  );
}
```

**Prós**:
- ✅ Remove `confirm()`/`prompt()` nativos
- ✅ Renderiza inline no chat (visualmente integrado)
- ✅ Mantém fluxo backend → frontend
- ✅ Fácil de implementar

**Contras**:
- ⚠️ Ainda usa CustomEvents (não é nativo do @assistant-ui)

## Opção 4: Tool Calling com Streaming Pausa

**Status**: Mais complexo, mas mais "correto"

```tsx
class VSCodeChatAdapter implements ChatModelAdapter {
  private pendingPrompts = new Map<string, (response: string) => void>();

  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    // ... stream normal ...
    
    // Quando detectar tool call no stream
    if (isToolCallDetected) {
      // Yield uma mensagem especial
      yield {
        content: [{ 
          type: 'tool-call',
          toolCallId: 'abc',
          toolName: 'create_file',
          args: { path: 'todo.md' }
        }]
      };
      
      // Pausar stream e aguardar confirmação
      const confirmed = await this.waitForConfirmation('abc');
      
      if (confirmed) {
        // Continuar stream
        yield { content: [{ type: 'text', text: 'Executando...' }] };
      } else {
        yield { content: [{ type: 'text', text: 'Cancelado' }] };
      }
    }
  }
  
  private async waitForConfirmation(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingPrompts.set(id, (response) => {
        resolve(response === 'yes');
      });
    });
  }
}
```

**Prós**:
- ✅ Integrado ao fluxo de streaming
- ✅ Não usa CustomEvents
- ✅ Mais "React-like"

**Contras**:
- ❌ Mais complexo
- ❌ Requer mudanças no adapter

## Recomendação

### Curto Prazo (Solução Imediata)
**Opção 3**: Inline Messages com useAssistantRuntime

- Remove `confirm()`/`prompt()` nativos
- Mantém sistema atual funcionando
- Melhora UX imediatamente
- Mudança mínima no código

### Longo Prazo (Refatoração)
**Investigar**: Se `useAssistantTool` existe na versão atual do @assistant-ui

- Se existe: migrar para API nativa
- Se não existe: manter Opção 3 como definitiva

## Próximos Passos

1. ✅ Verificar docs do @assistant-ui/react versão 0.11.29
2. ✅ Testar se `useAssistantTool` está disponível
3. ✅ Se não, implementar **Opção 3**
4. ✅ Remover `confirm()`/`prompt()` nativos
5. ✅ Adicionar testes visuais
