# Reasoning Parts Implementation

## Overview

Implementação de **Reasoning Parts** usando a API oficial do Assistant UI para mostrar o processo de raciocínio do agente em blocos colapsáveis (estilo O1).

## Arquitetura

### 1. **OrchestratedChatEngine** (Backend)

Gera marcadores especiais no stream de texto:

```typescript
// Para non-greetings
yield `__REASONING_START__\n${reasoningText}\n__REASONING_END__\n`
yield result.content // resposta principal
```

**Reasoning Text Structure:**
```
🧠 **Analisando sua solicitação...**

**Objetivo identificado:** criar um novo teste
**Termos técnicos:** test, unit, jest
**Categoria:** testing
**Clareza:** 85%

🔍 **Buscando contexto relevante no projeto...**
```

### 2. **VSCodeChatAdapter** (Frontend Bridge)

Extrai reasoning parts do stream e converte para tipos do Assistant UI:

```typescript
private extractMessageParts(fullText: string): ThreadAssistantMessagePart[] {
  // Regex para encontrar __REASONING_START__ ... __REASONING_END__
  // Separa em: ReasoningMessagePart[] + TextMessagePart[]
}
```

**Output:**
```typescript
[
  { type: "reasoning", text: "🧠 Analisando..." },
  { type: "text", text: "Aqui está seu teste..." }
]
```

### 3. **ChatView Components** (UI)

Renderiza reasoning parts em collapsible:

```tsx
<MessagePrimitive.Parts 
  components={{ 
    Text: AssistantText,           // Markdown com syntax highlighting
    Reasoning: ReasoningText,      // Markdown em estilo diferente
    ReasoningGroup: ReasoningGroup // <details> collapsible
  }} 
/>
```

**ReasoningGroup Component:**
- `<details>` nativo do HTML para collapsible
- Ícone 🧠 no header
- Estado open/closed controlado por React
- Border e background diferenciado
- Transição suave ao abrir/fechar

## Flow Completo

```
User: "quero criar um teste"
         ↓
OrchestratedChatEngine.processMessage()
         ↓
1. Extract intent via LLM
   - objective: "criar um teste"
   - category: "testing"
   - clarityScore: 0.85
         ↓
2. Build reasoning text
   - Intent analysis
   - Technical terms
   - Clarity score
   - Retrieval status
         ↓
3. Yield: __REASONING_START__\n...\n__REASONING_END__
         ↓
4. Orchestrate to AnalysisAgent
         ↓
5. Yield: Response content
         ↓
VSCodeChatAdapter.extractMessageParts()
         ↓
6. Parse stream text
7. Extract reasoning blocks
8. Create typed message parts
         ↓
ChatView (Assistant UI)
         ↓
9. Render ReasoningGroup (collapsible)
10. Render Text parts (markdown)
```

## Tipos Assistant UI

```typescript
// Reasoning part
interface ReasoningMessagePart {
  type: "reasoning"
  text: string
  parentId?: string
}

// Text part
interface TextMessagePart {
  type: "text"
  text: string
  parentId?: string
}

// Union type
type ThreadAssistantMessagePart = 
  | TextMessagePart
  | ReasoningMessagePart
  | ToolCallMessagePart
  | SourceMessagePart
  | FileMessagePart
  | ImageMessagePart
```

## Styling

### ReasoningGroup
- Border: `border-gray-300 dark:border-gray-700`
- Background: `bg-gray-50 dark:bg-gray-900`
- Hover: `hover:bg-gray-100 dark:hover:bg-gray-800`
- Transition: `transition-colors`

### ReasoningText
- Font size: `text-sm`
- Color: `text-gray-600 dark:text-gray-400`
- Prose: `prose dark:prose-invert`

## Diferenças vs Comentários HTML

### ❌ Abordagem Antiga (Comentários HTML)
```typescript
yield '<!-- thinking -->\n'
yield '🧠 Analisando...\n'
yield '<!-- /thinking -->\n\n'
```

**Problemas:**
- Comentários HTML não criam message parts separados
- Assistant UI filtrava/ignorava comentários
- Sem controle sobre styling
- Não aparecia na UI

### ✅ Abordagem Nova (Reasoning Parts)
```typescript
yield '__REASONING_START__\n'
yield '🧠 Analisando...\n'
yield '__REASONING_END__\n'
```

**Vantagens:**
- Message parts tipados e estruturados
- Renderização controlada por componentes
- Styling customizável
- Collapsible nativo
- Compatível com API oficial do Assistant UI

## Skip Reasoning for Greetings

```typescript
const isGreeting = intent?.category === 'greeting'

if (!isGreeting) {
  // Emit reasoning
  yield `__REASONING_START__\n${reasoningText}\n__REASONING_END__\n`
}

// Emit response
yield result.content
```

**Reasoning é pulado para:**
- Greetings simples ("oi", "olá")
- Respostas instantâneas (priority 100)
- Qualquer intent com category='greeting'

## Testing

### Manual Testing Checklist

1. **Greeting Test** (no reasoning)
   ```
   User: "oi"
   Expected: Resposta instantânea sem reasoning block
   ```

2. **Simple Request** (with reasoning)
   ```
   User: "quero criar um teste"
   Expected: Reasoning block + resposta detalhada
   ```

3. **Vague Request** (with reasoning + clarification)
   ```
   User: "ajuda"
   Expected: Reasoning mostrando baixa clareza + pedido de clarificação
   ```

4. **Complex Request** (with reasoning + retrieval)
   ```
   User: "criar um componente React com TypeScript"
   Expected: Reasoning mostrando retrieval + análise técnica
   ```

## Future Improvements

### 1. Shimmer Effect During Streaming
```tsx
const ReasoningTrigger = ({ active }: { active: boolean }) => (
  <summary>
    <span className={active ? 'animate-shimmer' : ''}>
      Reasoning
    </span>
  </summary>
)
```

### 2. Scroll Lock During Collapse
```typescript
import { useScrollLock } from "@assistant-ui/react"

const ReasoningGroup = () => {
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION)
  // Previne page jumps durante animação
}
```

### 3. Multiple Reasoning Parts
```typescript
// Group consecutive reasoning parts
<ReasoningGroup startIndex={0} endIndex={2}>
  <Reasoning text="Part 1" />
  <Reasoning text="Part 2" />
  <Reasoning text="Part 3" />
</ReasoningGroup>
```

### 4. Animated Height Transitions
```css
@keyframes collapsible-down {
  from { height: 0; }
  to { height: var(--radix-collapsible-content-height); }
}
```

## References

- [Assistant UI Reasoning Example](https://github.com/assistant-ui/assistant-ui/tree/main/apps/registry/components/assistant-ui/reasoning.tsx)
- [Assistant UI Message Parts](https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/types/MessagePartTypes.ts)
- [Assistant UI Part Grouping](https://www.assistant-ui.com/docs/ui/PartGrouping)

## Diagrama de Componentes

```
┌─────────────────────────────────────┐
│   OrchestratedChatEngine            │
│   (Backend - nivel2)                │
├─────────────────────────────────────┤
│ • Extract intent                    │
│ • Build reasoning text              │
│ • Emit __REASONING_START__          │
│ • Orchestrate to sub-agent          │
│ • Emit response content             │
└──────────────┬──────────────────────┘
               │ Stream: __REASONING_START__\ntext\n__REASONING_END__\nresponse
               ↓
┌─────────────────────────────────────┐
│   VSCodeChatAdapter                 │
│   (Frontend Bridge - nivel1)        │
├─────────────────────────────────────┤
│ • Receive stream tokens             │
│ • Extract reasoning blocks (regex)  │
│ • Create typed message parts        │
│   - ReasoningMessagePart[]          │
│   - TextMessagePart[]               │
└──────────────┬──────────────────────┘
               │ Array<ThreadAssistantMessagePart>
               ↓
┌─────────────────────────────────────┐
│   ChatView (React Component)        │
│   (UI - nivel1)                     │
├─────────────────────────────────────┤
│ <MessagePrimitive.Parts>            │
│   • ReasoningGroup (collapsible)    │
│   • ReasoningText (markdown)        │
│   • AssistantText (markdown)        │
│ </MessagePrimitive.Parts>           │
└─────────────────────────────────────┘
```

## Status

✅ **IMPLEMENTADO** - Reasoning parts funcionais com collapsible
🔄 **TESTANDO** - Validando comportamento em diferentes cenários
📝 **PRÓXIMO** - Adicionar shimmer effect e scroll lock
