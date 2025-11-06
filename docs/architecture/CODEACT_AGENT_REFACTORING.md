# Refatoração do Agente Cappy - Inspiração OpenHands CodeActAgent

## 🎯 Objetivo

Reestruturar o agente do Cappy seguindo o padrão **CodeActAgent** do OpenHands para criar uma arquitetura mais limpa, escalável e fácil de manter.

## 📊 Análise da Arquitetura Atual

### Problemas Identificados

1. **Fragmentação Excessiva**: Múltiplos sub-agentes (Greeting, Clarification, Planning, Analysis, ContextOrganizer) com responsabilidades sobrepostas
2. **Orquestração Complexa**: Sistema de orquestração adiciona overhead e dificulta debugging
3. **Falta de Estado Unificado**: Não há um sistema de State consolidado como no OpenHands
4. **Sistema de Tools Não Estruturado**: Tools são chamadas diretas ao VS Code API sem abstração
5. **Sem Sistema de Actions/Observations**: Não há padronização de como ações são executadas e resultados retornados

### Arquitetura Atual

```
┌─────────────────────────────────────────┐
│     OrchestratedChatEngine              │
│  (implementa ChatAgentPort)             │
└──────────────┬──────────────────────────┘
               │
               ▼
      ┌────────────────┐
      │  Orchestrator  │
      └────────┬───────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────┐      ┌──────────┐
│ Greeting │      │Planning  │
│  Agent   │      │  Agent   │
└──────────┘      └──────────┘
      ▼                 ▼
┌──────────┐      ┌──────────┐
│Clarifica-│      │Analysis  │
│tion Agent│      │  Agent   │
└──────────┘      └──────────┘
```

## 🏗️ Nova Arquitetura - Inspirada no OpenHands

### Princípios do OpenHands

1. **Agent Loop**: `step()` method que executa uma iteração de cada vez
2. **State Management**: Estado unificado que armazena história, métricas, contexto
3. **Actions & Observations**: Sistema padronizado de ações e observações
4. **Tool System**: Tools são chamados via abstração, não diretamente
5. **Single Responsibility**: Um agente principal com capabilities, não múltiplos sub-agentes

### Nova Arquitetura Proposta

```
┌─────────────────────────────────────────┐
│          CappyAgent                     │
│   (extends BaseAgent)                   │
│                                         │
│  - step(state: State): Action           │
│  - tools: Tool[]                        │
│  - llm: LanguageModel                   │
│  - capabilities: Capability[]           │
└──────────────┬──────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
  ┌─────────┐      ┌─────────┐
  │  State  │      │  Tools  │
  └─────────┘      └─────────┘
      │                 │
      ▼                 ▼
┌──────────┐      ┌──────────┐
│ History  │      │ Retrieval│
│ Metrics  │      │ Creation │
│ Context  │      │  Edit    │
└──────────┘      └──────────┘
```

## 📐 Componentes da Nova Arquitetura

### 1. **BaseAgent** (Abstract)

```typescript
/**
 * Base class for all agents in Cappy
 * Inspired by OpenHands Agent class
 */
export abstract class BaseAgent {
  protected llm: LanguageModel
  protected tools: Tool[]
  protected config: AgentConfig
  
  constructor(config: AgentConfig, llm: LanguageModel) {
    this.config = config
    this.llm = llm
    this.tools = this.initializeTools()
  }
  
  /**
   * Execute one step of the agent loop
   * Returns an Action to be executed
   */
  abstract step(state: State): Promise<Action>
  
  /**
   * Initialize tools available to this agent
   */
  protected abstract initializeTools(): Tool[]
  
  /**
   * Reset agent state
   */
  reset(): void {
    // Clear any internal state
  }
}
```

### 2. **State** (Estado Unificado)

```typescript
/**
 * Unified state management for agent execution
 * Tracks history, metrics, context, and current status
 */
export class State {
  // Conversation & Execution
  history: Event[]  // Actions + Observations
  currentTask: string | null
  
  // Metrics
  iterations: number
  toolCalls: number
  retrievalCalls: number
  
  // Context
  sessionId: string
  workspaceInfo?: WorkspaceInfo
  
  // Status
  status: 'idle' | 'running' | 'waiting_user' | 'error' | 'finished'
  lastError?: Error
  
  /**
   * Get last N messages from history
   */
  getRecentHistory(n: number): Event[] {
    return this.history.slice(-n)
  }
  
  /**
   * Get last user message
   */
  getLastUserMessage(): MessageAction | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const event = this.history[i]
      if (event.type === 'action' && event.action === 'message' && event.source === 'user') {
        return event as MessageAction
      }
    }
    return null
  }
  
  /**
   * Add event to history
   */
  addEvent(event: Event): void {
    this.history.push(event)
  }
  
  /**
   * Convert state to LLM context
   */
  toLLMContext(): Message[] {
    // Convert history to message format for LLM
    const messages: Message[] = []
    
    for (const event of this.history) {
      if (event.type === 'action') {
        messages.push({
          role: event.source === 'user' ? 'user' : 'assistant',
          content: this.formatAction(event)
        })
      } else if (event.type === 'observation') {
        messages.push({
          role: 'user',
          content: this.formatObservation(event)
        })
      }
    }
    
    return messages
  }
}
```

### 3. **Actions** (Ações do Agente)

```typescript
/**
 * Base type for all actions
 */
export interface Action {
  type: 'action'
  action: string  // 'message' | 'tool_call' | 'finish' | 'think'
  timestamp: number
  source: 'user' | 'assistant'
}

/**
 * Message action (conversation)
 */
export interface MessageAction extends Action {
  action: 'message'
  content: string
}

/**
 * Tool call action
 */
export interface ToolCallAction extends Action {
  action: 'tool_call'
  toolName: string
  input: Record<string, unknown>
  callId: string
}

/**
 * Think action (internal reasoning)
 */
export interface ThinkAction extends Action {
  action: 'think'
  thought: string
}

/**
 * Finish action (end conversation)
 */
export interface FinishAction extends Action {
  action: 'finish'
  outputs?: Record<string, unknown>
}
```

### 4. **Observations** (Resultados de Ações)

```typescript
/**
 * Base type for all observations
 */
export interface Observation {
  type: 'observation'
  observation: string  // 'tool_result' | 'error' | 'success'
  timestamp: number
}

/**
 * Tool result observation
 */
export interface ToolResultObservation extends Observation {
  observation: 'tool_result'
  toolName: string
  callId: string
  result: string | Record<string, unknown>
  success: boolean
}

/**
 * Error observation
 */
export interface ErrorObservation extends Observation {
  observation: 'error'
  error: string
  details?: unknown
}
```

### 5. **Tools** (Ferramentas Disponíveis)

```typescript
/**
 * Base interface for tools
 */
export interface Tool {
  name: string
  description: string
  parameters: ToolParameter[]
  
  /**
   * Execute the tool
   */
  execute(input: Record<string, unknown>): Promise<ToolResult>
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: unknown
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean
  result?: unknown
  error?: string
}
```

### 6. **CappyAgent** (Agente Principal)

```typescript
/**
 * Main Cappy Agent implementing CodeAct pattern
 * Consolidates all agent capabilities into a single, powerful agent
 */
export class CappyAgent extends BaseAgent {
  private state: State
  private pendingActions: Action[] = []
  
  constructor(config: AgentConfig, llm: LanguageModel, tools: Tool[]) {
    super(config, llm)
    this.state = new State()
    this.tools = tools
  }
  
  /**
   * Execute one step of the agent loop
   */
  async step(state: State): Promise<Action> {
    this.state = state
    
    // 1. Check for pending actions
    if (this.pendingActions.length > 0) {
      return this.pendingActions.shift()!
    }
    
    // 2. Get recent history for context
    const recentHistory = state.getRecentHistory(10)
    
    // 3. Build messages for LLM
    const messages = this.buildMessages(recentHistory)
    
    // 4. Add system prompt with tools
    const systemPrompt = this.buildSystemPrompt()
    messages.unshift({
      role: 'system',
      content: systemPrompt
    })
    
    // 5. Call LLM with tools
    const response = await this.llm.completion({
      messages,
      tools: this.tools.map(t => this.toolToSchema(t)),
      temperature: 0.7
    })
    
    // 6. Parse response into actions
    const actions = this.responseToActions(response)
    
    // 7. Queue actions and return first
    this.pendingActions = actions.slice(1)
    return actions[0]
  }
  
  /**
   * Initialize tools for Cappy
   */
  protected initializeTools(): Tool[] {
    return [
      new RetrieveContextTool(),
      new CreateFileTool(),
      new CreateTaskTool(),
      new ThinkTool(),
      new FinishTool()
    ]
  }
  
  /**
   * Build system prompt with capabilities
   */
  private buildSystemPrompt(): string {
    return `You are Cappy, a helpful AI assistant integrated into VS Code.

You have access to the following capabilities:

TOOLS:
${this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Your workflow:
1. Use 'think' tool to reason about the task
2. Use 'retrieve_context' to gather information from codebase
3. Use 'create_task' or 'create_file' to complete user requests
4. Use 'finish' when task is complete

Always think step-by-step and explain your reasoning.`
  }
  
  /**
   * Convert LLM response to actions
   */
  private responseToActions(response: LLMResponse): Action[] {
    const actions: Action[] = []
    
    // Check for tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        actions.push({
          type: 'action',
          action: 'tool_call',
          toolName: toolCall.name,
          input: toolCall.arguments,
          callId: toolCall.id,
          timestamp: Date.now(),
          source: 'assistant'
        })
      }
    }
    
    // Check for text message
    if (response.content) {
      actions.push({
        type: 'action',
        action: 'message',
        content: response.content,
        timestamp: Date.now(),
        source: 'assistant'
      })
    }
    
    return actions
  }
  
  /**
   * Execute action and return observation
   */
  async executeAction(action: Action): Promise<Observation> {
    if (action.action === 'tool_call') {
      const toolCall = action as ToolCallAction
      const tool = this.tools.find(t => t.name === toolCall.toolName)
      
      if (!tool) {
        return {
          type: 'observation',
          observation: 'error',
          error: `Tool not found: ${toolCall.toolName}`,
          timestamp: Date.now()
        }
      }
      
      try {
        const result = await tool.execute(toolCall.input)
        
        return {
          type: 'observation',
          observation: 'tool_result',
          toolName: toolCall.toolName,
          callId: toolCall.callId,
          result: result.result,
          success: result.success,
          timestamp: Date.now()
        }
      } catch (error) {
        return {
          type: 'observation',
          observation: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        }
      }
    }
    
    // For other actions, return success
    return {
      type: 'observation',
      observation: 'success',
      timestamp: Date.now()
    }
  }
}
```

## 🔄 Fluxo de Execução

### 1. **Inicialização**

```typescript
// Create agent with config and LLM
const agent = new CappyAgent(config, llm, tools)
const state = new State()
```

### 2. **Loop Principal** (Controller)

```typescript
// Main agent loop (similar to OpenHands controller)
async function runAgentLoop(agent: CappyAgent, state: State, userMessage: string) {
  // Add user message to state
  state.addEvent({
    type: 'action',
    action: 'message',
    content: userMessage,
    source: 'user',
    timestamp: Date.now()
  })
  
  const maxIterations = 10
  
  for (let i = 0; i < maxIterations; i++) {
    // Agent takes one step
    const action = await agent.step(state)
    
    // Add action to state
    state.addEvent(action)
    
    // Check if finished
    if (action.action === 'finish') {
      break
    }
    
    // Execute action and get observation
    const observation = await agent.executeAction(action)
    
    // Add observation to state
    state.addEvent(observation)
    
    // Check for errors
    if (observation.observation === 'error') {
      console.error('Error:', observation.error)
      // Could continue or break depending on error handling strategy
    }
  }
  
  return state
}
```

### 3. **Streaming Response** (Chat Integration)

```typescript
/**
 * Adapter para integrar CappyAgent com ChatAgentPort (streaming)
 */
export class CappyAgentAdapter implements ChatAgentPort {
  private agent: CappyAgent
  
  async *processMessage(message: Message, context: ChatContext): AsyncIterable<string> {
    const state = new State()
    state.sessionId = context.sessionId
    
    // Add user message
    state.addEvent({
      type: 'action',
      action: 'message',
      content: message.content,
      source: 'user',
      timestamp: Date.now()
    })
    
    // Agent loop with streaming
    for (let i = 0; i < 10; i++) {
      const action = await this.agent.step(state)
      state.addEvent(action)
      
      // Stream action content if it's a message or think
      if (action.action === 'message') {
        yield (action as MessageAction).content
      } else if (action.action === 'think') {
        yield `__REASONING_START__\n${(action as ThinkAction).thought}\n__REASONING_END__\n`
      } else if (action.action === 'tool_call') {
        const toolCall = action as ToolCallAction
        yield `\n🔧 Using tool: ${toolCall.toolName}\n`
      }
      
      // Execute and observe
      const observation = await this.agent.executeAction(action)
      state.addEvent(observation)
      
      // Stream observation
      if (observation.observation === 'tool_result') {
        const result = observation as ToolResultObservation
        if (typeof result.result === 'string') {
          yield result.result
        }
      }
      
      // Finish?
      if (action.action === 'finish') {
        break
      }
    }
  }
}
```

## 🛠️ Implementação de Tools

### Exemplo: RetrieveContextTool

```typescript
export class RetrieveContextTool implements Tool {
  name = 'retrieve_context'
  description = 'Retrieve relevant context from the codebase database using semantic search'
  
  parameters: ToolParameter[] = [
    {
      name: 'query',
      type: 'string',
      description: 'Search query to find relevant code, docs, or rules',
      required: true
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      default: 5
    }
  ]
  
  constructor(private retrieveUseCase: RetrieveContextUseCase) {}
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    try {
      const query = input.query as string
      const maxResults = (input.maxResults as number) || 5
      
      const results = await this.retrieveUseCase.execute({
        query,
        sources: ['code', 'documentation', 'prevention'],
        maxResults
      })
      
      return {
        success: true,
        result: {
          contexts: results.contexts,
          count: results.contexts.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
```

## 📋 Plano de Migração

### Fase 1: Infraestrutura Base
1. ✅ Criar types para Actions e Observations
2. ✅ Criar classe State
3. ✅ Criar interface Tool e exemplos

### Fase 2: Agente Principal
4. ✅ Criar BaseAgent abstract class
5. ✅ Implementar CappyAgent com step()
6. ✅ Integrar com LLM do VS Code

### Fase 3: Tools
7. ✅ Migrar cappy_retrieve_context para Tool
8. ✅ Migrar cappy_create_file para Tool
9. ✅ Criar ThinkTool, FinishTool

### Fase 4: Integração
10. ✅ Criar CappyAgentAdapter (ChatAgentPort)
11. ✅ Atualizar OrchestratedChatEngine
12. ✅ Remover sub-agents antigos

### Fase 5: Testes e Ajustes
13. ✅ Testar fluxo completo
14. ✅ Ajustar prompts e comportamentos
15. ✅ Documentar nova arquitetura

## 🎯 Benefícios Esperados

1. **Simplicidade**: Um agente principal em vez de múltiplos sub-agentes
2. **Rastreabilidade**: Estado unificado com histórico completo
3. **Extensibilidade**: Adicionar tools é simples e padronizado
4. **Debugging**: Mais fácil debugar com estado explícito
5. **Manutenção**: Código mais limpo e organizado
6. **Performance**: Menos overhead de orquestração

## 📚 Referências

- [OpenHands CodeActAgent](https://github.com/All-Hands-AI/OpenHands/blob/main/openhands/agenthub/codeact_agent/codeact_agent.py)
- [OpenHands Agent Architecture](https://github.com/All-Hands-AI/OpenHands/blob/main/openhands/controller/agent.py)
- [OpenHands State Management](https://github.com/All-Hands-AI/OpenHands/blob/main/openhands/controller/state/state.py)
