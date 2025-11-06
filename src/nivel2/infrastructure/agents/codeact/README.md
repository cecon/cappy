# CodeAct Agent - Documentação de Uso

## 📚 Visão Geral

O **CodeAct Agent** é uma reimplementação do sistema de agentes do Cappy inspirada no [OpenHands CodeActAgent](https://github.com/All-Hands-AI/OpenHands). Ele consolida todas as capacidades do agente em uma única classe poderosa, seguindo princípios de design limpo e arquitetura escalável.

## 🏗️ Arquitetura

### Componentes Principais

```
codeact/
├── core/
│   ├── actions.ts          # Tipos de ações (Message, ToolCall, Think, Finish)
│   ├── observations.ts     # Tipos de observações (ToolResult, Error, Success)
│   ├── events.ts           # Union de Actions + Observations
│   ├── state.ts            # Gerenciamento de estado unificado
│   ├── tool.ts             # Sistema de ferramentas
│   └── base-agent.ts       # Classe base para agentes
├── tools/
│   ├── think-tool.ts       # Ferramenta de raciocínio
│   ├── finish-tool.ts      # Ferramenta de finalização
│   └── retrieve-context-tool.ts  # Busca semântica no código
├── cappy-agent.ts          # Agente principal (CodeAct pattern)
├── cappy-agent-adapter.ts  # Adapter para ChatAgentPort (streaming)
└── index.ts                # Exports principais
```

### Fluxo de Execução

```
┌─────────────┐
│ User Message│
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  State.addEvent │  ← Adiciona mensagem ao histórico
│  (MessageAction)│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Agent.step()    │  ← Processa estado e decide próxima ação
│ - Build messages│
│ - Call LLM      │
│ - Parse response│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Action          │  ← Pode ser: Message, ToolCall, Think, Finish
│ (from LLM)      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│executeAction()  │  ← Executa a ação (tools, etc)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Observation     │  ← Resultado da ação
│ (ToolResult)    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ State.addEvent  │  ← Adiciona observação ao histórico
│ (loop até finish)│
└─────────────────┘
```

## 🚀 Uso Básico

### 1. Criar e Inicializar o Agente

```typescript
import { CappyAgent } from './nivel2/infrastructure/agents/codeact'
import type { RetrieveContextUseCase } from './domains/retrieval/use-cases/retrieve-context-use-case'

// Criar agente com configuração opcional
const agent = new CappyAgent(
  {
    maxIterations: 10,
    temperature: 0.7,
    enableThinking: true
  },
  retrieveUseCase // opcional - para busca semântica
)

// Inicializar (conecta ao LLM)
await agent.initialize()
```

### 2. Executar o Loop do Agente (Manual)

```typescript
import { State, createMessageAction } from './nivel2/infrastructure/agents/codeact'

// Criar estado
const state = new State('session-123')

// Adicionar mensagem do usuário
state.addEvent(createMessageAction('Explain the authentication flow', 'user'))

// Loop principal
const maxIterations = 10
for (let i = 0; i < maxIterations; i++) {
  state.startIteration()
  
  // Agente decide próxima ação
  const action = await agent.step(state)
  state.addEvent(action)
  
  // Verifica se terminou
  if (action.action === 'finish') {
    break
  }
  
  // Executa ação e obtém observação
  const observation = await agent.executeAction(action)
  state.addEvent(observation)
  
  // Trata erros
  if (observation.observation === 'error') {
    console.error('Error:', observation.error)
    break
  }
}

console.log('Final state:', state.toSummary())
```

### 3. Usar com Streaming (Chat Integration)

```typescript
import { CappyAgentAdapter } from './nivel2/infrastructure/agents/codeact'

// Criar adapter
const adapter = new CappyAgentAdapter(
  { maxIterations: 10 },
  retrieveUseCase
)

await adapter.initialize()

// Processar mensagem com streaming
const message = {
  id: '1',
  author: 'user',
  content: 'Create a task to add authentication',
  timestamp: Date.now()
}

const context = {
  sessionId: 'session-123',
  history: []
}

// Stream response
for await (const chunk of adapter.processMessage(message, context)) {
  process.stdout.write(chunk) // ou enviar para UI
}
```

### 4. Integrar com Sistema de Chat Existente

```typescript
// Em extension.ts ou onde o chat engine é criado

import { CappyAgentAdapter } from './nivel2/infrastructure/agents/codeact'
import { createChatService } from './domains/chat/services/chat-service'

// Criar adapter como agente
const cappyAgent = new CappyAgentAdapter(
  {
    maxIterations: 10,
    temperature: 0.7,
    enableThinking: true
  },
  retrieveContextUseCase
)

await cappyAgent.initialize()

// Criar serviço de chat com o adapter
const chatService = createChatService(cappyAgent)

// Usar normalmente
const session = await chatService.startSession('New Chat')
const stream = await chatService.sendMessage(
  session,
  'Help me understand this code',
  []
)

for await (const chunk of stream) {
  console.log(chunk)
}
```

## 🛠️ Criando Novas Ferramentas (Tools)

### Exemplo: CreateFileTool

```typescript
import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'
import * as vscode from 'vscode'
import * as path from 'node:path'

export class CreateFileTool extends BaseTool {
  name = 'create_file'
  description = 'Create a new file with specified content at the given path'
  
  parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description: 'Relative path where the file should be created',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write to the file',
      required: true
    }
  ]
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    // Validar entrada
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    try {
      const filePath = input.path as string
      const content = input.content as string
      
      // Obter workspace root
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        return this.error('No workspace folder open')
      }
      
      // Criar caminho absoluto
      const absolutePath = path.join(workspaceFolder.uri.fsPath, filePath)
      const uri = vscode.Uri.file(absolutePath)
      
      // Escrever arquivo
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'))
      
      // Abrir arquivo
      const doc = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(doc)
      
      return this.success({
        path: filePath,
        absolutePath,
        message: `File created successfully: ${filePath}`
      })
      
    } catch (error) {
      return this.error(
        error instanceof Error ? error.message : 'Unknown error creating file'
      )
    }
  }
}
```

### Registrar a Tool

```typescript
// Em cappy-agent.ts

protected initializeTools(): Tool[] {
  const tools: Tool[] = []
  
  if (this.config.enableThinking) {
    tools.push(new ThinkTool())
  }
  
  tools.push(new RetrieveContextTool(this.retrieveUseCase))
  tools.push(new CreateFileTool())  // ← Adicionar aqui
  tools.push(new FinishTool())
  
  return tools
}
```

## 📊 Monitoramento e Debugging

### Acessar Métricas

```typescript
// Durante ou após execução
const summary = state.toSummary()

console.log('Session ID:', summary.sessionId)
console.log('Status:', summary.status)
console.log('Iterations:', summary.iterations)
console.log('Tool calls:', summary.toolCalls)
console.log('Retrieval calls:', summary.retrievalCalls)
console.log('Duration (ms):', summary.duration)
console.log('History length:', summary.historyLength)
```

### Ver Histórico de Eventos

```typescript
// Iterar sobre eventos
for (const event of state.history) {
  if (event.type === 'action') {
    console.log(`Action: ${event.action}`, event)
  } else {
    console.log(`Observation: ${event.observation}`, event)
  }
}

// Pegar últimos N eventos
const recentEvents = state.getRecentHistory(10)
```

### Logs de Debug

O agente já tem logs detalhados. Para ver:

```typescript
// No VS Code: View > Output > Select "Cappy" ou "Extension Host"
// Você verá logs como:
[CappyAgent] step() called - iteration 1
[CappyAgent] Sending 3 messages to LLM
[CappyAgent] Action: tool_call
[CappyAgent] Executing tool: retrieve_context
```

## 🔧 Configuração Avançada

### Customizar System Prompt

```typescript
// Em cappy-agent.ts, modifique a constante SYSTEM_PROMPT

const SYSTEM_PROMPT = `You are Cappy, a specialized code assistant...

<CUSTOM_INSTRUCTIONS>
- Always prioritize code quality
- Follow project conventions
- etc...
</CUSTOM_INSTRUCTIONS>
`.trim()
```

### Ajustar Temperatura e Parâmetros

```typescript
const agent = new CappyAgent({
  maxIterations: 15,        // Mais iterações para tarefas complexas
  temperature: 0.3,         // Mais determinístico
  enableThinking: true,     // Permite raciocínio interno
  enableTools: true         // Habilita tools
})
```

## 🎯 Diferenças vs Arquitetura Antiga

| Aspecto | Antiga (Sub-agents) | Nova (CodeAct) |
|---------|---------------------|----------------|
| **Agentes** | 5+ sub-agentes separados | 1 agente principal |
| **Orquestração** | OrchestratorAgent complexo | Loop simples (step) |
| **Estado** | Fragmentado entre agentes | State unificado |
| **Tools** | Chamadas diretas VS Code API | Sistema de Tools padronizado |
| **Debugging** | Difícil rastrear fluxo | Histórico completo de events |
| **Extensibilidade** | Criar novo sub-agent | Adicionar nova Tool |
| **Performance** | Overhead de orquestração | Loop direto e eficiente |

## 📖 Referências

- [OpenHands CodeActAgent](https://github.com/All-Hands-AI/OpenHands/blob/main/openhands/agenthub/codeact_agent/codeact_agent.py)
- [Documento de Design](../../../docs/architecture/CODEACT_AGENT_REFACTORING.md)
- [OpenHands Agent Architecture](https://github.com/All-Hands-AI/OpenHands/blob/main/openhands/controller/agent.py)
