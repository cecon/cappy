# ✅ Tool Confirmation - API Nativa do @assistant-ui/react

## O que Foi Implementado

Migração de sistema custom para a **API nativa** do `@assistant-ui/react` v0.11.29 para confirmação de tool calls.

## API Descoberta

### 1. Tipo Nativo: `ToolCallMessagePart`

```typescript
type ToolCallMessagePart<TArgs = ReadonlyJSONObject, TResult = unknown> = {
  readonly type: "tool-call";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly args: TArgs;
  readonly result?: TResult | undefined;
  readonly isError?: boolean | undefined;
  readonly argsText: string;
  readonly artifact?: unknown;
  readonly interrupt?: {
    type: "human";
    payload: unknown;
  };
  readonly parentId?: string;
  readonly messages?: readonly ThreadMessage[];
};
```

### 2. Componente: `ToolCallMessagePartComponent`

```typescript
type ToolCallMessagePartComponent<TArgs = any, TResult = any> = ComponentType<{
  ...MessagePartState
  ...ToolCallMessagePart<TArgs, TResult>
  addResult: (result: TResult | ToolResponse<TResult>) => void;
  resume: (payload: unknown) => void;
}>;
```

**Métodos importantes**:
- `addResult(result)` - Envia o resultado do tool (confirmação ou erro)
- `resume(payload)` - Retoma execução após interrupção humana
- `interrupt` - Suporte nativo para pausar e aguardar input humano

### 3. Configuração no MessagePrimitive.Content

```typescript
<MessagePrimitive.Content
  components={{
    Text: MyTextComponent,
    tools: {
      // Opção 1: Por nome de tool
      by_name: {
        'cappy_create_file': CreateFileConfirmation,
        'cappy_edit_file': EditFileConfirmation
      },
      
      // Opção 2: Fallback para todos (usado atualmente)
      Fallback: ToolCallConfirmation,
      
      // Opção 3: Override completo
      Override: CustomToolHandler
    }
  }}
/>
```

## Implementação Atual

### ChatView.tsx

```tsx
const ToolCallConfirmation: ToolCallMessagePartComponent = ({ 
  toolName, 
  args, 
  result, 
  isError,
  addResult
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  // 1. Se já executado, mostrar resultado
  if (result !== undefined) {
    return (
      <div className="tool-result">
        {isError ? '❌' : '✅'} {toolName} 
        {isError ? 'falhou' : 'executado com sucesso'}
      </div>
    );
  }
  
  // 2. Se aguardando confirmação
  if (!isConfirmed) {
    return (
      <div className="tool-confirmation">
        <div>🔧 Confirmação de Ferramenta</div>
        <div>A ferramenta <code>{toolName}</code> será executada:</div>
        <pre>{JSON.stringify(args, null, 2)}</pre>
        
        <button onClick={() => {
          setIsConfirmed(true);
          addResult({ confirmed: true });
        }}>
          ✅ Confirmar
        </button>
        
        <button onClick={() => {
          setIsConfirmed(true);
          addResult({ confirmed: false, error: 'Cancelled by user' });
        }}>
          ❌ Cancelar
        </button>
      </div>
    );
  }
  
  // 3. Durante execução
  return <div>⏳ Executando {toolName}...</div>;
};

// Registrar no MessagePrimitive.Content
<MessagePrimitive.Content
  components={{
    Text: ({ text }) => <ReactMarkdown>{text}</ReactMarkdown>,
    tools: {
      Fallback: ToolCallConfirmation  // ✅ API nativa!
    }
  }}
/>
```

## Vantagens da API Nativa

### ✅ Benefícios

1. **Integrado ao @assistant-ui/react**
   - Não precisa de CustomEvents
   - Não precisa de markers no stream (`<!-- userPrompt -->`)
   - Estado gerenciado pela lib

2. **API Limpa**
   - `addResult()` para enviar resposta
   - `resume()` para continuar após pause
   - `interrupt` para pausas humanas

3. **Suporte a Múltiplos Tools**
   - `by_name` - componente específico por tool
   - `Fallback` - componente padrão
   - `Override` - controle total

4. **Typed**
   - `TArgs` genérico para argumentos
   - `TResult` genérico para resultado
   - Type-safe

### ⚠️ Limitações

1. **Requer tool calls no stream**
   - Backend precisa enviar `ToolCallMessagePart` no stream
   - Atualmente estamos usando markers customizados

2. **Fluxo de confirmação**
   - `addResult()` envia resultado, mas precisa integrar com backend
   - Backend precisa aguardar confirmação antes de executar

## Próximos Passos

### 1. ✅ **Implementado**
- [x] Descoberta da API nativa
- [x] Componente `ToolCallConfirmation`
- [x] Registro via `tools.Fallback`

### 2. 🔄 **Backend Integration** (TODO)

Modificar `VSCodeChatAdapter` para enviar `ToolCallMessagePart`:

```typescript
// Em VSCodeChatAdapter.run()
yield {
  content: [{
    type: 'tool-call',
    toolCallId: 'xyz',
    toolName: 'create_file',
    args: { path: 'todo.md', content: '...' },
    argsText: JSON.stringify({ path: 'todo.md' })
  }]
};
```

### 3. 🔄 **Confirmation Flow** (TODO)

Integrar `addResult()` com backend:

```typescript
const ToolCallConfirmation: ToolCallMessagePartComponent = ({ 
  toolCallId,
  addResult 
}) => {
  const handleConfirm = () => {
    // Enviar confirmação ao backend
    vscode.postMessage({
      type: 'toolConfirmation',
      toolCallId,
      confirmed: true
    });
    
    // Atualizar UI
    addResult({ confirmed: true });
  };
};
```

### 4. 🔄 **Remove Custom System** (TODO)

Depois de migrar para API nativa:
- [ ] Remover markers `<!-- userPrompt:start -->`
- [ ] Remover CustomEvents (`prompt-request`)
- [ ] Remover `PromptMessage.tsx` (se não for mais usado)
- [ ] Simplificar `LangGraphChatEngine`

## Comparação: Before vs After

### ❌ Before (Custom System)

```tsx
// Backend envia markers
yield `<!-- userPrompt:start -->`;
yield JSON.stringify({ question: '...', toolCall: {...} });
yield `<!-- userPrompt:end -->`;

// Frontend detecta markers
if (chunk.includes('<!-- userPrompt:start -->')) {
  const promptData = JSON.parse(buffer);
  const event = new CustomEvent('prompt-request', {
    detail: { prompt: promptData, resolve }
  });
  window.dispatchEvent(event);
}

// UI custom separado
{currentPrompt && (
  <PromptMessage 
    prompt={currentPrompt}
    onResponse={handleResponse}
  />
)}
```

### ✅ After (Native API)

```tsx
// Backend envia tool-call part (protocolo padrão)
yield {
  content: [{
    type: 'tool-call',
    toolCallId: 'xyz',
    toolName: 'create_file',
    args: { path: 'todo.md' }
  }]
};

// Frontend registra componente nativo
<MessagePrimitive.Content
  components={{
    tools: {
      Fallback: ToolCallConfirmation  // Automaticamente renderizado!
    }
  }}
/>

// Componente recebe props da lib
const ToolCallConfirmation: ToolCallMessagePartComponent = ({ 
  toolName, 
  args, 
  addResult  // ← Método nativo
}) => {
  return (
    <div>
      <button onClick={() => addResult({ confirmed: true })}>
        Confirmar {toolName}
      </button>
    </div>
  );
};
```

## Documentação Oficial

- **Package**: `@assistant-ui/react` v0.11.29
- **Tipos**: `node_modules/@assistant-ui/react/dist/types/MessagePartTypes.d.ts`
- **Components**: `node_modules/@assistant-ui/react/dist/primitives/message/MessageParts.d.ts`

## Conclusão

A API nativa do `@assistant-ui/react` **já tem tudo pronto** para tool confirmations:
- ✅ Tipos nativos (`ToolCallMessagePart`)
- ✅ Componentes customizáveis (`ToolCallMessagePartComponent`)
- ✅ Métodos de integração (`addResult`, `resume`)
- ✅ Suporte a interrupções (`interrupt`)

Não precisamos criar `useAssistantTool` customizado — **já está embutido**! 🎉
