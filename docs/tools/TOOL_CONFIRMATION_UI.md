# Tool Confirmation UI com @assistant-ui/react

## Sistema Atual
✅ **Auto-approve** - Tools executam automaticamente sem confirmação

## Como Implementar Confirmações Manuais

### 1. Modificar o Adapter para Pausar

```typescript
// src/components/ChatView.tsx

interface PendingToolCall {
  messageId: string;
  toolName: string;
  args: Record<string, unknown>;
  resolver: (approved: boolean) => void;
}

class VSCodeChatAdapter implements ChatModelAdapter {
  private pendingToolCalls: Map<string, PendingToolCall> = new Map();

  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    // ... código existente ...

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.messageId !== messageId) return;

      switch (message.type) {
        case "promptRequest":
          // Em vez de auto-aprovar, pausar e esperar confirmação do usuário
          const pendingTool = {
            messageId: message.promptMessageId,
            toolName: message.prompt?.toolCall?.name || "unknown",
            args: message.prompt?.toolCall?.input || {},
            resolver: null as any,
          };

          // Criar uma Promise que será resolvida quando o usuário clicar Allow/Deny
          const userDecision = new Promise<boolean>((resolve) => {
            pendingTool.resolver = resolve;
          });

          this.pendingToolCalls.set(message.promptMessageId, pendingTool);

          // Yield tool call para o @assistant-ui mostrar na UI
          yield {
            content: [
              {
                type: "tool-call",
                toolCallId: message.promptMessageId,
                toolName: pendingTool.toolName,
                argsText: JSON.stringify(pendingTool.args, null, 2),
                args: pendingTool.args,
              },
            ],
          };

          // Esperar decisão do usuário
          const approved = await userDecision;

          // Enviar resposta ao backend
          this.vscode.postMessage({
            type: "userPromptResponse",
            messageId: message.promptMessageId,
            response: approved ? "yes" : "no",
          });
          break;
      }
    };
  }

  // Método público para o componente React chamar
  public approveToolCall(messageId: string) {
    const pending = this.pendingToolCalls.get(messageId);
    if (pending) {
      pending.resolver(true);
      this.pendingToolCalls.delete(messageId);
    }
  }

  public denyToolCall(messageId: string) {
    const pending = this.pendingToolCalls.get(messageId);
    if (pending) {
      pending.resolver(false);
      this.pendingToolCalls.delete(messageId);
    }
  }
}
```

### 2. Criar Componente de Confirmação

```tsx
import { ActionBarPrimitive, useThreadContext } from "@assistant-ui/react";

const ToolCallUI: FC = () => {
  const { useThread } = useThreadContext();
  const messages = useThread((t) => t.messages);
  const lastMessage = messages[messages.length - 1];

  // Verificar se a última mensagem tem tool call pendente
  const toolCall = lastMessage?.content.find((c) => c.type === "tool-call");
  if (!toolCall || toolCall.type !== "tool-call") return null;

  const handleApprove = () => {
    // Chamar método do adapter
    adapterRef.current.approveToolCall(toolCall.toolCallId);
  };

  const handleDeny = () => {
    // Chamar método do adapter
    adapterRef.current.denyToolCall(toolCall.toolCallId);
  };

  return (
    <div className="my-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm">🔧 Tool: {toolCall.toolName}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            <pre className="overflow-auto max-h-32">
              {toolCall.argsText}
            </pre>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleApprove}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
        >
          <CheckIcon className="size-3" />
          Allow
        </button>
        <button
          onClick={handleDeny}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
        >
          <XIcon className="size-3" />
          Deny
        </button>
      </div>
    </div>
  );
};
```

### 3. Integrar no AssistantMessage

```tsx
AssistantMessage: () => (
  <MessagePrimitive.Root className="mb-4">
    <div className="max-w-[80%] rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-2">
      <MessagePrimitive.Content
        components={{
          Text: ({ text }) => <ReactMarkdown>{text}</ReactMarkdown>,
          ToolCall: () => <ToolCallUI />, // Renderizar confirmação aqui
        }}
      />
    </div>
  </MessagePrimitive.Root>
)
```

## Alternativa: Usar ActionBarPrimitive

O `@assistant-ui/react` fornece `ActionBarPrimitive` para adicionar botões inline:

```tsx
<MessagePrimitive.Root>
  <MessagePrimitive.Content />
  <ActionBarPrimitive.Root>
    <ActionBarPrimitive.Copy />
    <ActionBarPrimitive.Reload />
    {/* Botões personalizados de Allow/Deny */}
  </ActionBarPrimitive.Root>
</MessagePrimitive.Root>
```

## Referências

- [@assistant-ui/react docs](https://www.assistant-ui.com/docs)
- [Tool Calling Guide](https://www.assistant-ui.com/docs/runtimes/external-store/tool-calling)
- [Human-in-the-Loop Pattern](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)

## Status Atual

- ✅ Backend: LangGraph com suporte a Human-in-the-Loop
- ✅ Frontend: @assistant-ui/react com suporte a tool calls
- ✅ Comunicação: Mensagens `promptRequest` e `userPromptResponse`
- ⏸️ **Auto-approve ativo** - Pronto para adicionar UI quando necessário
