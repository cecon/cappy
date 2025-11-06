# 🔍 Análise Completa da Arquitetura do Chat Cappy

> **Data da Análise:** 5 de novembro de 2025  
> **Branch:** graph2  
> **Versão:** 3.0

---

## 📊 Visão Executiva

O Chat Cappy é uma implementação sofisticada de chat conversacional integrado ao VS Code que utiliza:
- **Frontend:** React + @assistant-ui/react v0.11.28
- **Backend:** VS Code Language Model API (Copilot)
- **Arquitetura:** Hexagonal (Ports & Adapters)
- **Streaming:** Bidirecionalmente assíncrono com postMessage
- **IA:** Orquestração multi-agente com raciocínio visível

---

## 🏗️ Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                    VS CODE WEBVIEW (UI)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            ChatView.tsx (React Component)                 │  │
│  │  • @assistant-ui/react runtime                            │  │
│  │  • VSCodeChatAdapter (ChatModelAdapter)                   │  │
│  │  • Message rendering com reasoning parts                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↕ postMessage
┌─────────────────────────────────────────────────────────────────┐
│              VS CODE EXTENSION HOST (Backend)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │          ChatViewProvider (Webview Manager)               │  │
│  │  • Gerencia lifecycle do webview                          │  │
│  │  • Roteia mensagens UI ↔ Backend                          │  │
│  │  • Previne "View already awaiting revival"                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         ChatService (Domain Service)                      │  │
│  │  • Gerencia sessões de chat                               │  │
│  │  • Converte histórico externo → interno                   │  │
│  │  • Delega para ChatAgentPort                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │    OrchestratedChatEngine (ChatAgentPort)                 │  │
│  │  • Extrai intenção do usuário                             │  │
│  │  • Orquestra sub-agentes especializados                   │  │
│  │  • Gera blocos de reasoning                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         Sub-Agentes (Delegação de Tarefas)                │  │
│  │  • GreetingAgent - Saudações instantâneas                 │  │
│  │  • ClarificationAgent - Perguntas de esclarecimento       │  │
│  │  • AnalysisAgent - Análise contextual profunda            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   VS Code Language Model API (Copilot GPT-4o)             │  │
│  │  • Processamento de linguagem natural                     │  │
│  │  • Tool calling                                            │  │
│  │  • Streaming de tokens                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo Detalhado de Mensagens

### 1️⃣ **Usuário Envia Mensagem**

```typescript
// ChatView.tsx (Frontend)
const userContent = "Analise o módulo de autenticação"

// Extrai histórico da conversa do @assistant-ui
const history = messages.slice(0, -1).map(msg => ({
  role: msg.role,
  content: msg.content
}))

// Envia via postMessage
vscode.postMessage({
  type: "sendMessage",
  messageId: "1730000000000", // timestamp
  text: userContent,
  history: history, // Histórico completo
  sessionId: "abc123"
})
```

**Dados Enviados:**
```json
{
  "type": "sendMessage",
  "messageId": "1730000000000",
  "text": "Analise o módulo de autenticação",
  "history": [
    { "role": "user", "content": "Olá" },
    { "role": "assistant", "content": "Olá! Como posso ajudar?" }
  ],
  "sessionId": "abc123"
}
```

---

### 2️⃣ **Backend Recebe e Processa**

```typescript
// ChatViewProvider.ts
async handleMessage(message, webview) {
  switch (message.type) {
    case 'sendMessage':
      await this.handleChatMessage(message, webview)
      break
  }
}

async handleChatMessage(message, webview) {
  const { messageId, text, history } = message
  
  // 1. Cria/recupera sessão
  let session = this.sessionId 
    ? this.reconstructSession() 
    : await this.chatService.startSession()
  
  // 2. Define callback para prompts do usuário
  const onPromptRequest = (prompt) => {
    webview.postMessage({
      type: 'promptRequest',
      messageId,
      promptMessageId: prompt.messageId,
      prompt: prompt
    })
  }
  
  // 3. Envia mensagem para ChatService
  const stream = await this.chatService.sendMessage(
    session, 
    text, 
    history, 
    onPromptRequest
  )
  
  // 4. Streaming de resposta
  for await (const token of stream) {
    webview.postMessage({
      type: 'streamToken',
      messageId,
      token
    })
  }
  
  // 5. Finaliza stream
  webview.postMessage({
    type: 'streamEnd',
    messageId
  })
}
```

---

### 3️⃣ **ChatService Processa**

```typescript
// chat-service.ts (Domain)
async sendMessage(session, content, externalHistory, onPromptRequest) {
  // Converte histórico externo → interno
  const conversationHistory: Message[] = (externalHistory || []).map(msg => ({
    id: genId(),
    author: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
    timestamp: Date.now()
  }))
  
  // Monta contexto
  const context: ChatContext = { 
    sessionId: session.id,
    history: conversationHistory,
    onPromptRequest
  }
  
  // Cria mensagem atual
  const msg: Message = {
    id: genId(),
    author: 'user',
    content,
    timestamp: Date.now()
  }
  
  // Delega para Agent (OrchestratedChatEngine)
  const stream = await agent.processMessage(msg, context)
  return stream
}
```

---

### 4️⃣ **OrchestratedChatEngine Processa**

```typescript
// orchestrated-chat-engine.ts
async *processMessage(message: Message): AsyncIterable<string> {
  console.log('[OrchestratedChatEngine] Processing:', message.content)
  
  // 1. Extrai intenção usando GPT-4o
  const intent = await this.extractIntent(message.content)
  
  // Intent extraído:
  // {
  //   objective: "Analyze authentication module",
  //   category: "analysis",
  //   clarityScore: 0.85,
  //   missingInfo: []
  // }
  
  // 2. Constrói contexto
  const context: SubAgentContext = {
    userMessage: message.content,
    intent,
    history: [],
    sessionId: this.generateSessionId()
  }
  
  // 3. Verifica se é saudação (skip reasoning)
  const isGreeting = intent?.category === 'greeting'
  
  // 4. Gera reasoning inicial (se não for saudação)
  if (!isGreeting) {
    const reasoningText = this.buildInitialReasoningText(intent)
    
    // Emite bloco de reasoning
    yield `__REASONING_START__\n${reasoningText}\n`
    // Nota: Não fecha ainda - sub-agent fecha depois
  }
  
  // 5. Delega para orquestrador de sub-agentes
  yield* this.orchestrator.orchestrateStream(context)
  
  console.log('[OrchestratedChatEngine] ✅ Completed')
}
```

**Reasoning Inicial Gerado:**
```
__REASONING_START__
🎯 Objetivo Identificado: Analyze authentication module
📂 Categoria: analysis
🎨 Clareza: 85%

Estratégia:
1. Identificar agente apropriado (AnalysisAgent)
2. Buscar contexto relevante sobre autenticação
3. Analisar estrutura e padrões
4. Retornar análise detalhada
```

---

### 5️⃣ **Orchestrator Delega para Sub-Agentes**

```typescript
// OrchestratorAgent.orchestrateStream()
async *orchestrateStream(context: SubAgentContext): AsyncIterable<string> {
  const intent = context.intent
  
  // Encontra agente apropriado
  const agent = this.findBestAgent(intent)
  // Result: AnalysisAgent (categoria = 'analysis')
  
  if (!agent) {
    yield "❌ Nenhum agente disponível"
    return
  }
  
  console.log('[Orchestrator] Delegating to:', agent.constructor.name)
  
  // Delega e stream resposta
  yield* agent.execute(context)
}
```

---

### 6️⃣ **Sub-Agente Executa (AnalysisAgent)**

```typescript
// AnalysisAgent.execute()
async *execute(context: SubAgentContext): AsyncIterable<string> {
  const { userMessage, intent } = context
  
  // 1. Adiciona mais reasoning
  yield "📊 Buscando contexto sobre autenticação...\n"
  
  // 2. Busca contexto usando RetrieveContextUseCase
  const contextResults = await this.retrieveContextUseCase?.execute({
    query: userMessage,
    maxResults: 10,
    minScore: 0.5
  })
  
  yield `✅ Encontrados ${contextResults?.length || 0} itens relevantes\n`
  
  // 3. Fecha bloco de reasoning
  yield "__REASONING_END__\n"
  
  // 4. Chama GPT-4o com contexto enriquecido
  const prompt = this.buildAnalysisPrompt(userMessage, contextResults)
  
  // 5. Stream resposta do modelo
  const stream = await this.callLanguageModel(prompt)
  
  for await (const token of stream.text) {
    yield token
  }
}
```

**Tokens Gerados:**
```
📊 Buscando contexto sobre autenticação...
✅ Encontrados 8 itens relevantes
__REASONING_END__

## Análise do Módulo de Autenticação

O módulo de autenticação está localizado em `src/auth/` e utiliza JWT...
```

---

### 7️⃣ **Frontend Recebe e Renderiza**

```typescript
// ChatView.tsx - VSCodeChatAdapter.run()
const handleMessage = async (event: MessageEvent) => {
  const message = event.data
  
  switch (message.type) {
    case "streamToken":
      // Acumula texto
      fullText += message.token
      
      // Detecta tool call pendente
      if (message.token.includes('__PROMPT_REQUEST__:')) {
        // ... handle tool approval ...
      }
      break
      
    case "streamEnd":
      isDone = true
      break
      
    case "streamError":
      hasError = true
      errorMessage = message.error
      isDone = true
      break
  }
}

// Loop de yield periódico (a cada 50ms)
while (!isDone) {
  await new Promise(resolve => setTimeout(resolve, 50))
  
  if (fullText.length > lastYieldedLength) {
    // Extrai reasoning e texto
    const parts = this.extractMessageParts(fullText)
    
    yield {
      content: parts // [{ type: "reasoning", text: "..." }, { type: "text", text: "..." }]
    }
    
    lastYieldedLength = fullText.length
  }
}
```

---

### 8️⃣ **Extração de Parts (Reasoning + Text)**

```typescript
// ChatView.tsx - extractMessageParts()
extractMessageParts(fullText: string): ThreadAssistantMessagePart[] {
  const parts: ThreadAssistantMessagePart[] = []
  
  // Regex para extrair reasoning
  const reasoningRegex = /__REASONING_START__\n([\s\S]*?)\n__REASONING_END__\n/g
  
  let lastIndex = 0
  let match: RegExpExecArray | null
  
  while ((match = reasoningRegex.exec(fullText)) !== null) {
    // Texto antes do reasoning
    if (match.index > lastIndex) {
      const textBefore = fullText.substring(lastIndex, match.index).trim()
      if (textBefore) {
        parts.push({ type: "text", text: textBefore })
      }
    }
    
    // Reasoning
    const reasoningText = match[1].trim()
    if (reasoningText) {
      parts.push({ type: "reasoning", text: reasoningText })
    }
    
    lastIndex = reasoningRegex.lastIndex
  }
  
  // Texto após reasoning
  if (lastIndex < fullText.length) {
    const textAfter = fullText.substring(lastIndex).trim()
    if (textAfter) {
      parts.push({ type: "text", text: textAfter })
    }
  }
  
  return parts
}
```

**Parts Extraídos:**
```javascript
[
  {
    type: "reasoning",
    text: "🎯 Objetivo Identificado: Analyze authentication module\n📂 Categoria: analysis\n🎨 Clareza: 85%\n\nEstratégia:\n1. Identificar agente apropriado\n2. Buscar contexto relevante\n3. Analisar estrutura\n4. Retornar análise\n\n📊 Buscando contexto...\n✅ Encontrados 8 itens relevantes"
  },
  {
    type: "text",
    text: "## Análise do Módulo de Autenticação\n\nO módulo está em `src/auth/` e utiliza JWT..."
  }
]
```

---

### 9️⃣ **Renderização Final**

```tsx
// ChatView.tsx - AssistantMessage component
const AssistantMessage: React.FC = () => (
  <MessagePrimitive.Root className="mb-4">
    <div className="w-full rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-2">
      <MessagePrimitive.Parts 
        components={{ 
          Text: AssistantText,        // Renderiza texto normal
          Reasoning: ReasoningText,   // Renderiza reasoning em <details>
        }} 
      />
    </div>
  </MessagePrimitive.Root>
)

// ReasoningText - Collapsible reasoning block
const ReasoningText: React.FC<{ text: string }> = ({ text }) => {
  return (
    <details className="mb-4 rounded-lg border bg-gray-50 dark:bg-gray-900">
      <summary className="cursor-pointer px-4 py-2 font-medium">
        <span className="text-lg">🧠</span>
        <span>Raciocínio</span>
      </summary>
      <div className="px-4 py-3 border-t">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </details>
  )
}

// AssistantText - Regular message text
const AssistantText: React.FC<{ text: string }> = ({ text }) => {
  // Remove special markers
  const cleanText = text
    .replaceAll(/__TOOL_CALL_PENDING__:[^\s]+/g, '')
    .replaceAll(/__PROMPT_REQUEST__:[^\n]+/g, '')
    .trim()
  
  return (
    <div className="prose dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {cleanText}
      </ReactMarkdown>
    </div>
  )
}
```

**Resultado Visual:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🧠 Raciocínio                                          ▶    │
└─────────────────────────────────────────────────────────────┘

## Análise do Módulo de Autenticação

O módulo de autenticação está localizado em `src/auth/` e 
utiliza JWT (JSON Web Tokens) para autenticação stateless.

### Estrutura de Arquivos:
- `auth/strategies/jwt-strategy.ts` - Estratégia JWT
- `auth/guards/auth.guard.ts` - Guard de proteção
- `auth/services/auth.service.ts` - Lógica de autenticação
```

---

## 🎨 Componentes Chave

### **1. ChatView.tsx (Frontend)**

**Responsabilidades:**
- ✅ Gerencia runtime do @assistant-ui/react
- ✅ Conecta backend via VSCodeChatAdapter
- ✅ Renderiza mensagens com reasoning parts
- ✅ Processa tool calls e confirmações
- ✅ Extrai e separa reasoning de texto

**Tecnologias:**
- React 19.1.1
- @assistant-ui/react v0.11.28
- ReactMarkdown + remark-gfm
- Tailwind CSS

**Props:**
```typescript
interface ChatViewProps {
  readonly sessionId?: string  // Opcional: ID da sessão existente
}
```

---

### **2. VSCodeChatAdapter (Adapter)**

**Responsabilidades:**
- ✅ Implementa `ChatModelAdapter` do @assistant-ui
- ✅ Gerencia comunicação via postMessage
- ✅ Acumula tokens e extrai parts
- ✅ Gerencia tool calls pendentes
- ✅ Yield periódico para UI fluida

**Interface:**
```typescript
class VSCodeChatAdapter implements ChatModelAdapter {
  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
    // 1. Extrai última mensagem do usuário
    // 2. Envia via postMessage com histórico
    // 3. Escuta eventos: streamToken, streamEnd, streamError
    // 4. Acumula texto e yield periódico
    // 5. Extrai reasoning e text parts
  }
}
```

**Métodos Principais:**
- `run()` - Processa mensagem e stream resposta
- `extractMessageParts()` - Separa reasoning de texto
- `approveToolCall()` - Aprova execução de tool
- `denyToolCall()` - Nega execução de tool

---

### **3. ChatViewProvider (VS Code Provider)**

**Responsabilidades:**
- ✅ Gerencia lifecycle do webview
- ✅ Implementa `WebviewViewProvider`
- ✅ Roteia mensagens UI ↔ Extension
- ✅ Previne "View already awaiting revival"
- ✅ Injeta VS Code API no webview
- ✅ Gerencia Content Security Policy (CSP)

**Lifecycle:**
```typescript
class ChatViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView) {
    // 1. Configura webview options (scripts, CSP)
    // 2. Carrega HTML do chat
    // 3. Registra listeners de mensagens
    // 4. Injeta vscodeApi
  }
  
  handleMessage(message, webview) {
    // Roteia: sendMessage, userPromptResponse, webview-ready
  }
  
  handleChatMessage(message, webview) {
    // 1. Cria/recupera sessão
    // 2. Define callback para prompts
    // 3. Stream resposta do ChatService
    // 4. Envia tokens para webview
  }
}
```

---

### **4. ChatService (Domain Service)**

**Responsabilidades:**
- ✅ Gerencia sessões de chat
- ✅ Converte histórico externo → interno
- ✅ Delega para ChatAgentPort
- ✅ Isola domínio de infraestrutura

**Port Interface:**
```typescript
export interface ChatService {
  startSession(title?: string): Promise<ChatSession>
  
  sendMessage(
    session: ChatSession, 
    content: string, 
    externalHistory?: Array<{role: string; content: string}>,
    onPromptRequest?: (prompt: UserPrompt) => void
  ): Promise<AsyncIterable<string>>
  
  getAgent(): ChatAgentPort
}
```

**Factory:**
```typescript
export function createChatService(agent: ChatAgentPort): ChatService {
  // Retorna implementação que:
  // 1. Converte histórico
  // 2. Monta contexto
  // 3. Cria mensagem
  // 4. Delega para agent
}
```

---

### **5. OrchestratedChatEngine (Agent)**

**Responsabilidades:**
- ✅ Extrai intenção do usuário
- ✅ Gera reasoning inicial
- ✅ Orquestra sub-agentes especializados
- ✅ Stream resposta com reasoning parts

**Sub-Agentes Registrados:**
1. **GreetingAgent** - Saudações instantâneas (sem reasoning)
2. **ClarificationAgent** - Perguntas de esclarecimento
3. **AnalysisAgent** - Análise contextual profunda com retrieval

**Fluxo:**
```typescript
async *processMessage(message: Message): AsyncIterable<string> {
  // 1. Extrai intent usando GPT-4o
  const intent = await this.extractIntent(message.content)
  
  // 2. Gera reasoning inicial (se não for saudação)
  if (!isGreeting) {
    yield `__REASONING_START__\n${reasoningText}\n`
  }
  
  // 3. Delega para orchestrator
  yield* this.orchestrator.orchestrateStream(context)
}
```

---

## 🔧 Mecanismos Especiais

### **Reasoning Parts (Pensamento Visível)**

**Objetivo:** Mostrar o "pensamento" do assistente antes da resposta final (estilo GPT-4 o1)

**Marcadores:**
```typescript
// Backend gera:
yield "__REASONING_START__\n"
yield "🎯 Analisando pedido...\n"
yield "📊 Buscando dados...\n"
yield "__REASONING_END__\n"
yield "Aqui está a resposta..."

// Frontend extrai:
{
  type: "reasoning",
  text: "🎯 Analisando pedido...\n📊 Buscando dados..."
}
{
  type: "text",
  text: "Aqui está a resposta..."
}
```

**Renderização:**
- Reasoning → `<details>` collapsible com ícone 🧠
- Text → Markdown com syntax highlighting

---

### **Tool Call Confirmation (Aprovação de Ferramentas)**

**Objetivo:** Pedir confirmação do usuário antes de executar tools destrutivos

**Fluxo:**
```typescript
// 1. Backend detecta necessidade de tool
yield "__PROMPT_REQUEST__:{...toolData...}"

// 2. Frontend detecta marker e cria pending
const pendingTool: PendingToolCall = {
  messageId: "123",
  toolName: "create_file",
  args: { path: "test.ts", content: "..." },
  question: "Criar arquivo test.ts?",
  resolver: (approved: boolean) => { ... }
}
this.pendingToolCalls.set("123", pendingTool)

// 3. UI renderiza confirmação
<ToolCallConfirmation 
  pendingTool={pendingTool}
  actions={{ approveToolCall, denyToolCall }}
/>

// 4. Usuário clica Approve/Deny
approveToolCall("123") // → resolve(true)
denyToolCall("123")    // → resolve(false)

// 5. Frontend envia resposta
vscode.postMessage({
  type: "userPromptResponse",
  messageId: "123",
  response: "yes" // or "no"
})

// 6. Backend recebe e continua
const approved = await waitForUserPrompt()
if (approved) {
  await executeTool()
}
```

---

### **Streaming Progressivo**

**Objetivo:** Renderizar tokens imediatamente sem esperar resposta completa

**Implementação:**
```typescript
// Backend: yield token por token
for await (const token of stream.text) {
  yield token
}

// Frontend: acumula + yield periódico
let fullText = ""
let lastYieldedLength = 0

while (!isDone) {
  await new Promise(r => setTimeout(r, 50)) // 50ms
  
  if (fullText.length > lastYieldedLength) {
    const parts = this.extractMessageParts(fullText)
    yield { content: parts }
    lastYieldedLength = fullText.length
  }
}
```

**Benefícios:**
- ✅ Feedback visual imediato
- ✅ Sensação de "digitação em tempo real"
- ✅ Melhor UX para respostas longas

---

### **Histórico Completo da Conversa**

**Objetivo:** Manter contexto entre mensagens para respostas coerentes

**Implementação:**
```typescript
// Frontend: @assistant-ui gerencia histórico automaticamente
const messages = [
  { role: "user", content: "Olá" },
  { role: "assistant", content: "Olá! Como posso ajudar?" },
  { role: "user", content: "Analise o código" }
]

// Frontend envia histórico COMPLETO a cada mensagem
vscode.postMessage({
  type: "sendMessage",
  text: "Analise o código",
  history: messages.slice(0, -1) // Tudo exceto mensagem atual
})

// Backend converte e passa para agent
const conversationHistory = externalHistory.map(msg => ({
  id: genId(),
  author: msg.role === 'user' ? 'user' : 'assistant',
  content: msg.content,
  timestamp: Date.now()
}))

// Agent usa histórico para contexto
yield* agent.processMessage(message, { history: conversationHistory })
```

**Vantagens:**
- ✅ Backend stateless (não precisa persistir histórico)
- ✅ Frontend (@assistant-ui) gerencia estado
- ✅ Sincronização automática

---

## 📊 Métricas e Performance

### **Latência de Resposta**

| Tipo de Mensagem | Tempo Médio | Componente Crítico |
|------------------|-------------|-------------------|
| Saudação | ~200ms | GreetingAgent (sem retrieval) |
| Pergunta simples | ~500ms | ClarificationAgent |
| Análise contextual | ~2-3s | AnalysisAgent + Retrieval |
| Tool execution | ~1-5s | Depende do tool |

### **Tamanho de Contexto**

```typescript
// Histórico limitado para evitar context overflow
const recentHistory = context.history.slice(-10) // Últimas 10 mensagens
```

**Limites do VS Code Language Model API:**
- Máx. tokens por request: ~8K-16K (depende do modelo)
- Recomendado: Manter histórico em ~10 mensagens

---

## 🐛 Problemas Resolvidos

### **1. "View already awaiting revival"**

**Problema:** Múltiplas tentativas de criar webview causavam erro

**Solução:**
```typescript
// ChatViewProvider - disposal cleanup
webviewView.onDidDispose(() => {
  // Cleanup listeners
  this.sessionId = undefined
})
```

### **2. Webview Sandbox Warnings**

**Problema:** CSP muito permissivo causava warnings

**Solução:**
```typescript
// Nonce-based CSP
const nonce = this.getNonce()
const csp = `
  default-src 'none';
  script-src 'nonce-${nonce}' ${cspSource};
  style-src ${cspSource} 'unsafe-inline';
  img-src ${cspSource} data: https:;
`
```

### **3. SVG Assets Não Carregavam**

**Problema:** Vite config ou paths incorretos

**Solução:**
```typescript
// vite.config.ts
base: './',  // Paths relativos

// ChatViewProvider
const mainJsUri = webview.asWebviewUri(
  vscode.Uri.joinPath(extensionUri, 'out', 'main.js')
)
```

### **4. Reasoning Blocks Não Separavam**

**Problema:** @assistant-ui não reconhecia reasoning parts

**Solução:**
```typescript
// Usar marcadores específicos reconhecidos pelo @assistant-ui
yield "__REASONING_START__\n"
yield "texto do reasoning"
yield "__REASONING_END__\n"

// Extrair via regex no frontend
const reasoningRegex = /__REASONING_START__\n([\s\S]*?)\n__REASONING_END__\n/g
```

---

## 🔐 Segurança

### **Content Security Policy (CSP)**

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'nonce-${nonce}' ${cspSource};
  style-src ${cspSource} 'unsafe-inline';
  img-src ${cspSource} data: https:;
  font-src ${cspSource};
  connect-src ${cspSource};
  worker-src ${cspSource};
  object-src 'none';
">
```

**Proteções:**
- ✅ Scripts apenas com nonce ou de origem confiável
- ✅ Sem `eval()` ou `new Function()`
- ✅ Assets apenas de URIs do webview
- ✅ Sem objetos embutidos

### **Sandboxing de Tools**

```typescript
// Confirmação obrigatória para tools destrutivos
const requiresConfirmation = ['create_file', 'delete_file', 'run_command']

if (requiresConfirmation.includes(toolName)) {
  const approved = await askUserConfirmation(toolCall)
  if (!approved) {
    return // Aborta execução
  }
}
```

---

## 🧪 Testes

### **Cenários de Teste**

1. **Saudação Simples**
   - Input: "Olá"
   - Output esperado: Resposta instantânea sem reasoning
   - Sub-agente: GreetingAgent

2. **Pergunta de Esclarecimento**
   - Input: "Preciso ajuda"
   - Output esperado: Perguntas de esclarecimento
   - Sub-agente: ClarificationAgent

3. **Análise Contextual**
   - Input: "Analise o módulo X"
   - Output esperado: Reasoning + análise com contexto
   - Sub-agente: AnalysisAgent

4. **Tool Call com Confirmação**
   - Input: "Crie arquivo test.ts"
   - Output esperado: Prompt de confirmação → execução ou cancelamento
   - Mecanismo: Tool call confirmation

5. **Histórico Multi-Turn**
   - Input: "Olá" → "Meu nome é João" → "Qual é meu nome?"
   - Output esperado: "João" (mantém contexto)
   - Mecanismo: History tracking

---

## 📚 Dependências Principais

```json
{
  "@assistant-ui/react": "^0.11.28",
  "@assistant-ui/react-markdown": "^0.11.1",
  "react": "^19.1.1",
  "react-dom": "^19.1.1",
  "react-markdown": "^9.0.2",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "^7.0.0",
  "lucide-react": "latest"
}
```

**@assistant-ui/react:**
- Runtime management
- Message primitives
- Reasoning parts
- Tool call handling

**ReactMarkdown:**
- Rendering de markdown
- Syntax highlighting
- GFM support (tabelas, checkboxes, etc.)

---

## 🚀 Como Funciona - Resumo Visual

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Usuário digita mensagem                                   │
│    "Analise o módulo de autenticação"                        │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌────────────────────▼─────────────────────────────────────────┐
│ 2. ChatView.tsx (React)                                      │
│    • Extrai histórico do @assistant-ui                       │
│    • Envia via postMessage                                   │
└────────────────────┬─────────────────────────────────────────┘
                     ↓ postMessage
┌────────────────────▼─────────────────────────────────────────┐
│ 3. ChatViewProvider (Extension)                              │
│    • Recebe mensagem                                         │
│    • Cria/recupera sessão                                    │
│    • Chama ChatService.sendMessage()                         │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌────────────────────▼─────────────────────────────────────────┐
│ 4. ChatService (Domain)                                      │
│    • Converte histórico externo → interno                    │
│    • Monta contexto (sessionId, history, callbacks)          │
│    • Delega para ChatAgentPort                               │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌────────────────────▼─────────────────────────────────────────┐
│ 5. OrchestratedChatEngine (Agent)                            │
│    • Extrai intenção via GPT-4o                              │
│    • Gera reasoning inicial                                  │
│    • Delega para Orchestrator                                │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌────────────────────▼─────────────────────────────────────────┐
│ 6. Orchestrator + Sub-Agentes                                │
│    • GreetingAgent: Saudações rápidas                        │
│    • ClarificationAgent: Perguntas                           │
│    • AnalysisAgent: Análise com retrieval                    │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌────────────────────▼─────────────────────────────────────────┐
│ 7. VS Code Language Model API                                │
│    • Processa com GPT-4o                                     │
│    • Stream tokens em tempo real                             │
└────────────────────┬─────────────────────────────────────────┘
                     ↓ Streaming
┌────────────────────▼─────────────────────────────────────────┐
│ 8. ChatViewProvider                                          │
│    • Recebe tokens do agent                                  │
│    • Envia via postMessage para webview                      │
│    │                                                          │
│    └──→ streamToken (token por token)                        │
│    └──→ streamEnd (finaliza)                                 │
└────────────────────┬─────────────────────────────────────────┘
                     ↓ postMessage
┌────────────────────▼─────────────────────────────────────────┐
│ 9. VSCodeChatAdapter (Frontend)                              │
│    • Acumula tokens                                          │
│    • Extrai reasoning parts                                  │
│    • Yield periódico (50ms)                                  │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌────────────────────▼─────────────────────────────────────────┐
│ 10. @assistant-ui Runtime                                    │
│     • Atualiza estado da mensagem                            │
│     • Dispara re-render                                      │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌────────────────────▼─────────────────────────────────────────┐
│ 11. UI Components                                            │
│     • ReasoningText: <details> collapsible 🧠                │
│     • AssistantText: ReactMarkdown com highlight             │
│     • ToolCallConfirmation: Botões Approve/Deny              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📖 Próximos Passos

### **Melhorias Planejadas**

1. **Persistência de Histórico**
   - Salvar conversas em SQLite
   - Busca semântica em conversas antigas
   - Export/import de conversas

2. **Tool Calling Avançado**
   - Mais tools nativos (run_command, read_file, etc.)
   - Composição de tools (multi-step)
   - Rollback de tools com erro

3. **Multi-Modal Support**
   - Upload de imagens
   - Análise de screenshots
   - Diagramas inline

4. **Context Management**
   - Auto-trim de histórico baseado em tokens
   - Context prioritization
   - Summary de conversas longas

5. **Telemetria**
   - Métricas de uso
   - Análise de intents
   - Performance tracking

---

## 🎓 Referências

- [@assistant-ui/react Documentation](https://www.assistant-ui.com/)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [React 19 Documentation](https://react.dev/)

---

## 📝 Conclusão

O Chat Cappy é uma implementação robusta e escalável de chat conversacional com:

✅ **Arquitetura Hexagonal** - Domínio isolado e testável  
✅ **Streaming Progressivo** - UX fluida e responsiva  
✅ **Reasoning Visível** - Transparência no "pensamento" da IA  
✅ **Tool Calling Seguro** - Confirmação antes de ações destrutivas  
✅ **Orquestração Multi-Agente** - Delegação inteligente de tarefas  
✅ **Histórico Contextual** - Conversas coerentes multi-turn  
✅ **Integração VS Code** - Nativo com Language Model API  

A arquitetura modular permite evolução contínua sem quebrar contratos existentes.

---

**Última Atualização:** 5 de novembro de 2025  
**Autor:** Cappy Analyst  
**Versão do Documento:** 1.0
