# @assistant-ui/react - Funcionalidades Avançadas

## 🚀 Visão Geral

A biblioteca **@assistant-ui/react** é uma solução completa para criar interfaces de chat com IA, similar ao ChatGPT. Ela oferece muito mais do que apenas exibir mensagens!

## 📚 Funcionalidades Principais

### 1. ✅ **Implementado no Cappy**

- ✅ **Streaming de Respostas**: Tokens chegam progressivamente
- ✅ **Reasoning Display**: Exibir processo de pensamento (estilo o1)
- ✅ **Custom Message Components**: Personalização completa de mensagens
- ✅ **Runtime Management**: Gerenciamento de estado do chat
- ✅ **Message History**: Histórico de conversação
- ✅ **Error Handling**: Tratamento de erros do LLM

### 2. 🔨 **Parcialmente Implementado**

- 🔨 **Tool Call Display**: Mostrar quando tools são usadas (básico funcionando)
- 🔨 **Multi-turn Conversations**: Conversas com múltiplas rodadas (funciona mas pode melhorar)

### 3. ⏳ **Planejado / TODO**

- ⏳ **User Prompts/Confirmation**: Perguntar ao usuário durante processamento
- ⏳ **Attachments**: Suporte a anexos (imagens, arquivos)
- ⏳ **Branching**: Criar ramificações na conversa
- ⏳ **Message Editing**: Editar mensagens enviadas
- ⏳ **Message Regeneration**: Regenerar resposta do assistente
- ⏳ **Thread Management**: Múltiplas threads de conversa
- ⏳ **Feedback System**: Like/dislike em respostas
- ⏳ **Speech-to-Text**: Input por voz
- ⏳ **Text-to-Speech**: Ler respostas em voz alta
- ⏳ **Collaborative Editing**: Edição colaborativa de código

## 🎯 Funcionalidades Detalhadas

### 🧠 Reasoning Display (o1-style)

**Status**: ✅ Implementado

```tsx
// Suportado via ReasoningMessagePart
{
  type: 'reasoning',
  text: '🧠 Analisando código... encontrei 3 problemas...'
}
```

**Como funciona**:
- Backend envia marcadores `<!-- reasoning:start -->` e `<!-- reasoning:end -->`
- Adapter processa e cria `ReasoningMessagePart`
- UI renderiza em caixa separada com estilo diferenciado

**Documentação**: `docs/architecture/chat/REASONING_SUPPORT.md`

---

### 🛠️ Tool Calls Interativos

**Status**: 🔨 Parcialmente implementado

**O que falta**:
- Mostrar progresso de tool execution
- Permitir cancelar tool call
- Mostrar resultado da tool inline
- Pedir confirmação antes de executar tool perigosa

**Exemplo futuro**:
```tsx
<ToolCallMessage 
  tool="cappy_createFile"
  status="running"
  onCancel={() => cancelTool()}
>
  Criando arquivo component.tsx...
</ToolCallMessage>
```

---

### ❓ User Prompts (Perguntas ao Usuário)

**Status**: ⏳ Planejado

**Casos de uso**:
1. **Confirmação**: "Deletar 50 arquivos?"
2. **Input**: "Qual nome do componente?"
3. **Seleção**: "React, Vue ou Angular?"

**Exemplo**:
```typescript
// Backend pausa e pergunta
const componentName = await runtime.prompt({
  type: 'input',
  question: 'Nome do componente?',
  placeholder: 'MyComponent'
});

// Continua processamento com resposta
createComponent(componentName);
```

**Documentação**: `docs/architecture/chat/USER_PROMPTS_SUPPORT.md`

---

### 📎 Attachments (Anexos)

**Status**: ⏳ Planejado

**Tipos suportados**:
- Imagens (PNG, JPG, GIF)
- Arquivos de código
- PDFs
- Links

**API**:
```tsx
<ComposerPrimitive.Attachments>
  <AttachmentUpload 
    accept="image/*,.ts,.tsx"
    onUpload={handleUpload}
  />
</ComposerPrimitive.Attachments>
```

**Integração com Language Model**:
```typescript
// VS Code Language Model API suporta imagens!
const messages = [
  vscode.LanguageModelChatMessage.User([
    { type: 'text', text: 'O que há nesta imagem?' },
    { type: 'image', data: imageBuffer }
  ])
];
```

---

### 🌳 Branching (Ramificações)

**Status**: ⏳ Planejado

**Cenário**:
- Usuário não gostou da resposta
- Quer explorar alternativa sem perder contexto
- Cria branch da conversa

**API**:
```typescript
// Create branch from message
const newBranch = runtime.branch(messageId);

// Switch between branches
runtime.switchBranch(branchId);

// Merge branches
runtime.mergeBranches(branch1, branch2);
```

---

### ✏️ Message Editing

**Status**: ⏳ Planejado

**Funcionalidade**:
- Editar mensagem do usuário
- Reprocessar conversa a partir dali
- Manter histórico de edições

**UI**:
```tsx
<MessagePrimitive.Actions>
  <button onClick={() => editMessage(messageId)}>
    ✏️ Editar
  </button>
  <button onClick={() => regenerateFrom(messageId)}>
    🔄 Regenerar
  </button>
</MessagePrimitive.Actions>
```

---

### 🔄 Message Regeneration

**Status**: ⏳ Planejado

**Casos de uso**:
- Resposta não foi boa
- Quero outra alternativa
- Erro durante geração

**API**:
```typescript
// Regenerate last assistant message
await runtime.regenerate();

// Regenerate specific message
await runtime.regenerate(messageId);

// Regenerate with different model
await runtime.regenerate(messageId, { 
  model: 'gpt-4o-mini' 
});
```

---

### 📚 Thread Management

**Status**: ⏳ Planejado

**Funcionalidade**:
- Múltiplas conversas simultâneas
- Alternar entre threads
- Arquivar threads
- Buscar em threads

**Estrutura**:
```typescript
interface Thread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  lastMessageAt: Date;
  isArchived: boolean;
}

// Thread list UI
<ThreadList
  threads={threads}
  active={activeThreadId}
  onSelect={handleSelectThread}
/>
```

---

### 👍👎 Feedback System

**Status**: ⏳ Planejado

**Funcionalidade**:
- Like/dislike em respostas
- Reportar resposta problemática
- Feedback com comentário

**UI**:
```tsx
<MessagePrimitive.Feedback>
  <button onClick={() => feedback('positive')}>👍</button>
  <button onClick={() => feedback('negative')}>👎</button>
  <button onClick={() => report()}>🚩 Reportar</button>
</MessagePrimitive.Feedback>
```

---

### 🎤 Speech-to-Text

**Status**: ⏳ Planejado

**Tecnologias**:
- Web Speech API
- Whisper API (OpenAI)
- Azure Speech Services

**UI**:
```tsx
<ComposerPrimitive.VoiceInput
  onTranscript={(text) => appendToInput(text)}
  language="pt-BR"
/>
```

---

### 🔊 Text-to-Speech

**Status**: ⏳ Planejado

**Funcionalidade**:
- Ler resposta em voz alta
- Pausar/retomar
- Ajustar velocidade/voz

**UI**:
```tsx
<MessagePrimitive.Audio
  text={message.content}
  autoplay={false}
  voice="pt-BR-Standard-A"
/>
```

---

### 🤝 Collaborative Editing

**Status**: ⏳ Planejado

**Cenário**:
- Múltiplos usuários no mesmo chat
- Editor de código colaborativo inline
- Ver o que outros estão digitando

**Tecnologias**:
- WebSockets
- Operational Transforms
- CRDTs

---

## 🎨 Componentes Avançados

### 1. Custom Message Renderers

```tsx
<ThreadPrimitive.Messages
  components={{
    UserMessage: CustomUserMessage,
    AssistantMessage: CustomAssistantMessage,
    SystemMessage: CustomSystemMessage,
    ToolCallMessage: ToolCallRenderer,
    ErrorMessage: ErrorRenderer
  }}
/>
```

### 2. Custom Composer

```tsx
<ComposerPrimitive.Root>
  <ComposerPrimitive.Input />
  <ComposerPrimitive.Attachments />
  <ComposerPrimitive.Suggestions />
  <ComposerPrimitive.Send />
  <ComposerPrimitive.Cancel />
</ComposerPrimitive.Root>
```

### 3. Message Actions

```tsx
<MessagePrimitive.Actions>
  <CopyButton />
  <EditButton />
  <RegenerateButton />
  <BranchButton />
  <DeleteButton />
</MessagePrimitive.Actions>
```

## 🔧 Runtime API

### Estado

```typescript
// Get current state
const state = runtime.getState();

// Subscribe to changes
runtime.subscribe((state) => {
  console.log('State changed:', state);
});

// Get messages
const messages = runtime.messages;

// Check if generating
const isRunning = runtime.isRunning;
```

### Ações

```typescript
// Append message
runtime.append({
  role: 'user',
  content: [{ type: 'text', text: 'Hello' }]
});

// Cancel current generation
runtime.cancel();

// Clear thread
runtime.clear();

// Switch model
runtime.switchModel('gpt-4o-mini');
```

## 📊 Priorização de Implementação

### 🔥 Alta Prioridade (Próximos Steps)
1. **User Prompts** - Essencial para workflows interativos
2. **Tool Call UI** - Melhorar visualização de tools
3. **Message Regeneration** - UX importante
4. **Feedback System** - Qualidade de respostas

### 🔶 Média Prioridade
5. **Attachments** - Útil mas não crítico
6. **Branching** - Power user feature
7. **Message Editing** - Complementar a regeneração
8. **Thread Management** - Escala com uso

### 🔵 Baixa Prioridade
9. **Speech-to-Text** - Nice to have
10. **Text-to-Speech** - Acessibilidade
11. **Collaborative Editing** - Caso de uso específico

## 🎯 Roadmap

### Q4 2024
- ✅ Setup básico com @assistant-ui/react
- ✅ Reasoning display
- ✅ Tool calls básicos

### Q1 2025
- ⏳ User prompts
- ⏳ Tool call UI melhorado
- ⏳ Message regeneration
- ⏳ Feedback system

### Q2 2025
- ⏳ Attachments
- ⏳ Branching
- ⏳ Message editing
- ⏳ Thread management

### Q3 2025+
- ⏳ Speech features
- ⏳ Collaborative editing
- ⏳ Advanced analytics

## 📚 Recursos

- [assistant-ui Documentation](https://www.assistant-ui.com/)
- [assistant-ui GitHub](https://github.com/assistant-ui/assistant-ui)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [React 19 Documentation](https://react.dev/)

## 🎓 Exemplos de Código

Todos os exemplos estão em:
- `docs/architecture/chat/REASONING_SUPPORT.md` - Reasoning
- `docs/architecture/chat/USER_PROMPTS_SUPPORT.md` - User prompts
- `src/components/ChatView.tsx` - Implementação atual
