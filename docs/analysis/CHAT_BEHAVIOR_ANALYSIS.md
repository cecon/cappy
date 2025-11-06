# 📊 Análise do Comportamento do Chat

## 🔍 Análise Atual

### Fluxo de Mensagens

```
User Input
    ↓
ChatView.tsx (Frontend)
    ↓ postMessage
ChatViewProvider.ts (Backend)
    ↓
ChatService
    ↓
OrchestratedChatEngine
    ↓ [Extrai Intent + Sub-agents]
    ├─ GreetingAgent (priority: 100)
    ├─ ClarificationAgent (priority: 90)
    └─ AnalysisAgent (priority: 80)
        └─ RetrievalHelper (busca contexto)
    ↓ [Stream Response]
Backend → Frontend (tokens)
    ↓
Assistant UI (renderiza)
```

### Componentes Identificados

#### 1. **Backend: OrchestratedChatEngine**
- **Local:** `src/nivel2/infrastructure/agents/chat-engine/orchestrated-chat-engine.ts`
- **Responsabilidade:** 
  - Extrai intent via LLM
  - Delega para sub-agentes
  - **Envia reasoning ANTES da resposta principal**

**Código atual (linha 88-91):**
```typescript
if (!isGreeting) {
  const reasoningText = this.buildReasoningText(intent)
  yield `__REASONING_START__\n${reasoningText}\n__REASONING_END__\n`
}
```

#### 2. **Sub-Agent: AnalysisAgent**
- **Local:** `src/nivel2/infrastructure/agents/sub-agents/analysis/agent.ts`
- **Responsabilidade:**
  - Usa `RetrievalHelper` para buscar contexto
  - Faz chamada ao LLM com contexto enriquecido
  - **Atualmente NÃO mostra o progresso da busca**

**Problema identificado:**
```typescript
// Linha 67-83: constrói thinking mas não emite
let thinkingContent = ''
thinkingContent += '🔍 **Buscando contexto no projeto...**\n\n'
const retrievedContext = await this.retrievalHelper.retrieveContext(intent)
// ... monta thinkingContent mas não envia ao usuário em tempo real
```

#### 3. **Frontend: ChatView.tsx**
- **Local:** `src/nivel1/ui/pages/chat/ChatView.tsx`
- **Responsabilidade:**
  - Recebe tokens via `postMessage`
  - Extrai reasoning parts (`__REASONING_START__` ... `__REASONING_END__`)
  - Renderiza com Assistant UI

**Código atual (linha 267-298):**
```typescript
private extractMessageParts(fullText: string): ThreadAssistantMessagePart[] {
  const reasoningRegex = /__REASONING_START__\n([\s\S]*?)\n__REASONING_END__\n/g;
  // Processa e separa reasoning de conteúdo
}
```

---

## ❌ Problemas Identificados

### 1. **Subagente de Retrieval não é visível**

**Comportamento esperado:**
```
Usuário: "preciso criar um chat"
Agente: 
  🧠 Raciocínio
  [mostra reasoning instantâneo]
  ↓
  🔍 Buscando contexto...
  [usuário vê "..." enquanto busca]
  ↓
  ✅ Encontrei 15 referências
  [mostra resultados]
  ↓
  🧠 Analisando com IA...
  [LLM processa]
  ↓
  [Resposta final]
```

**Comportamento atual:**
```
Usuário: "preciso criar um chat"
Agente: 
  🧠 Raciocínio
  [mostra reasoning instantâneo]
  ↓
  [SILÊNCIO - usuário não sabe que está buscando]
  ↓
  [SILÊNCIO - usuário não sabe que LLM está processando]
  ↓
  [Resposta final aparece de uma vez]
```

**Causa:**
- `AnalysisAgent` constrói `thinkingContent` internamente
- Mas apenas retorna no `content` final
- Não há streaming progressivo durante a busca

### 2. **Falta indicador "pensando" após reasoning**

**Problema:**
```
[Reasoning termina]
   ↓
[Pausa de 2-5s enquanto LLM processa]
   ↓ [usuário acha que travou]
"Ah, chegou a resposta!"
```

**Solução esperada:**
```
[Reasoning termina]
   ↓
"💭 Pensando..." [typing indicator]
   ↓
[Resposta começa a aparecer]
```

---

## ✅ Soluções Propostas

### Solução 1: **Streaming Progressivo no AnalysisAgent**

**Mudança:** Fazer `AnalysisAgent.process()` retornar `AsyncIterable<string>`

**Implementação:**

```typescript
// src/nivel2/infrastructure/agents/sub-agents/analysis/agent.ts

async *processStream(context: SubAgentContext): AsyncIterable<string> {
  this.log('Starting analysis...')
  
  // Emit reasoning start
  yield '__REASONING_START__\n'
  
  // Step 1: Show we're searching
  yield '🔍 **Buscando contexto no projeto...**\n\n'
  
  const retrievedContext = await this.retrievalHelper.retrieveContext(intent)
  
  // Step 2: Show results
  if (retrievedContext.totalResults > 0) {
    yield `✅ Encontrei **${retrievedContext.totalResults} referências**:\n`
    if (retrievedContext.code.length > 0) {
      yield `- ${retrievedContext.code.length} exemplos de código\n`
    }
    yield '\n'
  }
  
  // Step 3: Show we're analyzing
  yield '🧠 **Analisando com IA...**\n'
  yield '__REASONING_END__\n\n'
  
  // Step 4: Stream LLM response
  const response = await this.analyzeWithLLM(...)
  for await (const token of response) {
    yield token
  }
}
```

**Vantagens:**
- ✅ Usuário vê cada etapa em tempo real
- ✅ Não precisa esperar tudo antes de ver algo
- ✅ Feedback contínuo (não parece travado)

### Solução 2: **Typing Indicator após Reasoning**

**Mudança:** Frontend detecta fim do reasoning e mostra "..."

**Implementação:**

```typescript
// src/nivel1/ui/pages/chat/ChatView.tsx

private extractMessageParts(fullText: string): ThreadAssistantMessagePart[] {
  const parts: ThreadAssistantMessagePart[] = [];
  
  // ... código de extração de reasoning ...
  
  // NOVO: Detectar se acabou reasoning mas ainda não tem conteúdo
  const hasReasoning = reasoningRegex.test(fullText);
  const contentAfterReasoning = fullText.substring(lastReasoningEnd).trim();
  
  if (hasReasoning && !contentAfterReasoning) {
    // Mostrar "Pensando..." DEPOIS do reasoning
    parts.push({ 
      type: "text", 
      text: "__THINKING_INDICATOR__" 
    });
  }
  
  return parts;
}

// No componente de mensagem:
const AssistantText: React.FC<{ text: string }> = ({ text }) => {
  if (text === "__THINKING_INDICATOR__") {
    return <TypingIndicator />;
  }
  // ... resto do código ...
}
```

**Vantagens:**
- ✅ Usuário sabe que algo está acontecendo
- ✅ Expectativa correta (não travou)
- ✅ Comportamento similar ao ChatGPT/Claude

---

## 📋 Plano de Implementação

### Fase 1: Streaming no AnalysisAgent
1. Modificar `SubAgentResponse` para suportar streaming
2. Alterar `AnalysisAgent.process()` para retornar `AsyncIterable<string>`
3. Emitir reasoning progressivamente durante retrieval
4. Testar isoladamente

### Fase 2: Indicador "Pensando"
1. Adicionar detecção de "reasoning acabou, conteúdo não chegou"
2. Emitir marker especial `__THINKING_INDICATOR__`
3. Frontend detecta e mostra `<TypingIndicator />`
4. Testar transição reasoning → pensando → resposta

### Fase 3: Integração com Orchestrator
1. Fazer `OrchestratorAgent` propagar streams
2. Garantir que reasoning + conteúdo fluem corretamente
3. Testar todos os sub-agentes (Greeting, Clarification, Analysis)

### Fase 4: UX Polish
1. Adicionar animações de transição
2. Garantir que reasoning é "collapsible" (pode minimizar)
3. Adicionar timestamps nos estados
4. Testar experiência completa

---

## 🎯 Resultados Esperados

**Antes:**
```
[usuário] "criar um chat"
[agente - reasoning instantâneo]
[silêncio 3s] 🤔 travou?
[resposta aparece]
```

**Depois:**
```
[usuário] "criar um chat"
[agente - reasoning com progresso]
  🔍 Buscando... 
  ✅ Encontrei 15 refs
  🧠 Analisando...
[typing indicator] 💭 ...
[resposta começa a aparecer progressivamente]
```

---

## 📚 Referências

- **Assistant UI Reasoning:** https://www.assistant-ui.com/docs/primitives/MessagePrimitive#reasoning
- **Streaming Best Practices:** Mostrar progresso em cada etapa longa (>500ms)
- **UX Pattern:** ChatGPT mostra "Thinking..." entre reasoning e resposta

---

## ⚠️ Notas Importantes

1. **Backward Compatibility:** Garantir que sub-agentes sem streaming continuem funcionando
2. **Error Handling:** Se retrieval falhar, mostrar no reasoning
3. **Performance:** Streaming não deve adicionar latência total
4. **Testing:** Criar cenários com/sem contexto encontrado
