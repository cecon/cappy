# CodeAct Agent - Exemplo de Uso Prático

## Cenário Real: Debugging um Bug

Vamos simular como o CodeAct Agent trabalha em um cenário real de debugging.

### Contexto
O usuário reporta: "Estou tendo um erro ao executar os testes. Eles dizem que `State` não está definido."

### Execução Passo a Passo

#### Iteração 1: Compreender o Problema

**User Message**:
```
@cappy Estou tendo um erro ao executar os testes. Eles dizem que `State` não está definido.
```

**Agent Internal Actions**:
```typescript
// Action 1: Think
{
  action: 'think',
  thought: 'O usuário está reportando um erro de compilação sobre State não definido. Preciso:
    1. Ver os testes para entender o erro
    2. Verificar o import do State
    3. Encontrar onde State está definido
    4. Propor uma correção'
}

// Action 2: Retrieve Context
{
  action: 'tool_call',
  toolName: 'retrieve_context',
  input: {
    query: 'State class definition tests',
    maxResults: 5
  }
}

// Observation: Results found
{
  observation: 'tool_result',
  result: [
    {
      path: 'test-codeact-agent.ts',
      content: '// Tests for State\nconst state = new State()',
      score: 0.89
    },
    {
      path: 'src/nivel2/infrastructure/agents/codeact/core/state.ts',
      content: 'export class State { ... }',
      score: 0.85
    }
  ]
}
```

**Agent Response to User**:
```
Encontrei o problema! Vou verificar o arquivo de testes para confirmar.
```

---

#### Iteração 2: Ler o Arquivo de Testes

**Agent Internal Actions**:
```typescript
// Action 3: Read test file
{
  action: 'tool_call',
  toolName: 'file_read',
  input: {
    path: 'test-codeact-agent.ts',
    startLine: 1,
    endLine: 30
  }
}

// Observation: File content
{
  observation: 'tool_result',
  result: `import { CappyAgent } from './src/nivel2/infrastructure/agents/codeact/cappy-agent'
import { RetrieveContextUseCase } from './src/nivel2/application/usecases/retrieve-context-usecase'

// Missing import:
// import { State } from './src/nivel2/infrastructure/agents/codeact/core/state'

describe('CappyAgent', () => {
  it('should initialize state', () => {
    const state = new State() // Error: State is not defined
  })
})`
}

// Action 4: Think
{
  action: 'think',
  thought: 'Encontrei! O arquivo de testes não está importando a classe State. 
    Preciso adicionar o import correto na linha 3.'
}
```

**Agent Response to User**:
```
Identifiquei o problema! O arquivo `test-codeact-agent.ts` está tentando usar `State` 
mas não está importando a classe. Vou corrigir isso agora.
```

---

#### Iteração 3: Corrigir o Import

**Agent Internal Actions**:
```typescript
// Action 5: Edit file
{
  action: 'tool_call',
  toolName: 'edit_file',
  input: {
    path: 'test-codeact-agent.ts',
    old_str: `import { CappyAgent } from './src/nivel2/infrastructure/agents/codeact/cappy-agent'
import { RetrieveContextUseCase } from './src/nivel2/application/usecases/retrieve-context-usecase'`,
    new_str: `import { CappyAgent } from './src/nivel2/infrastructure/agents/codeact/cappy-agent'
import { State } from './src/nivel2/infrastructure/agents/codeact/core/state'
import { RetrieveContextUseCase } from './src/nivel2/application/usecases/retrieve-context-usecase'`
  }
}

// Observation: Edit successful
{
  observation: 'tool_result',
  result: 'Successfully edited test-codeact-agent.ts. Added import for State at line 2.'
}
```

**Agent Response to User**:
```
✅ Import adicionado com sucesso! Agora vou executar os testes para confirmar que o erro foi resolvido.
```

---

#### Iteração 4: Verificar a Correção

**Agent Internal Actions**:
```typescript
// Action 6: Run tests
{
  action: 'tool_call',
  toolName: 'bash',
  input: {
    command: 'npm test -- test-codeact-agent.ts',
    background: false
  }
}

// Observation: Test output
{
  observation: 'tool_result',
  result: `> cappy@1.0.0 test
> vitest test-codeact-agent.ts

✓ test-codeact-agent.ts (1)
  ✓ CappyAgent (1)
    ✓ should initialize state (5ms)

Tests passed: 1
Duration: 234ms`
}

// Action 7: Finish
{
  action: 'finish',
  response: `Problema resolvido! 🎉

**O que estava errado:**
O arquivo \`test-codeact-agent.ts\` estava tentando usar a classe \`State\` sem importá-la.

**O que foi corrigido:**
Adicionei o import na linha 2:
\`\`\`typescript
import { State } from './src/nivel2/infrastructure/agents/codeact/core/state'
\`\`\`

**Verificação:**
Os testes agora passam com sucesso ✅

Se tiver mais algum problema, é só me chamar!`
}
```

**Final Response to User**:
```
Problema resolvido! 🎉

**O que estava errado:**
O arquivo `test-codeact-agent.ts` estava tentando usar a classe `State` sem importá-la.

**O que foi corrigido:**
Adicionei o import na linha 2:
```typescript
import { State } from './src/nivel2/infrastructure/agents/codeact/core/state'
```

**Verificação:**
Os testes agora passam com sucesso ✅

Se tiver mais algum problema, é só me chamar!
```

---

## Análise do Fluxo

### Estado Completo Após Execução

```typescript
{
  history: [
    // Iteration 1
    { type: 'action', action: 'message', source: 'user', content: '...' },
    { type: 'action', action: 'think', thought: '...' },
    { type: 'action', action: 'tool_call', toolName: 'retrieve_context', ... },
    { type: 'observation', observation: 'tool_result', ... },
    
    // Iteration 2
    { type: 'action', action: 'tool_call', toolName: 'file_read', ... },
    { type: 'observation', observation: 'tool_result', ... },
    { type: 'action', action: 'think', thought: '...' },
    
    // Iteration 3
    { type: 'action', action: 'tool_call', toolName: 'edit_file', ... },
    { type: 'observation', observation: 'tool_result', ... },
    
    // Iteration 4
    { type: 'action', action: 'tool_call', toolName: 'bash', ... },
    { type: 'observation', observation: 'tool_result', ... },
    { type: 'action', action: 'finish', response: '...' }
  ],
  
  metrics: {
    iterations: 4,
    toolCalls: 4, // retrieve_context, file_read, edit_file, bash
    errors: 0,
    startTime: 1234567890,
    lastActionTime: 1234567995
  },
  
  status: 'finished'
}
```

### Ferramentas Utilizadas

1. **think** (2x): Planejamento e análise
2. **retrieve_context** (1x): Busca semântica inicial
3. **file_read** (1x): Leitura do arquivo de testes
4. **edit_file** (1x): Correção do import
5. **bash** (1x): Execução dos testes
6. **finish** (1x): Conclusão da tarefa

### Tempo de Resposta

- **Iteração 1**: ~2s (retrieve_context + think)
- **Iteração 2**: ~1s (file_read + think)
- **Iteração 3**: ~0.5s (edit_file)
- **Iteração 4**: ~3s (npm test)
- **Total**: ~6.5s

---

## Exemplo 2: Implementar Nova Feature

### User Request
```
@cappy Preciso adicionar logging em todas as chamadas de API. 
Pode criar um interceptor axios com logging de request/response?
```

### Agent Workflow

```typescript
// Step 1: Think + Retrieve Context
think("Preciso entender como o axios está configurado atualmente")
retrieve_context({ query: "axios configuration API calls" })

// Step 2: Read existing code
file_read({ path: "src/shared/http/axios-client.ts" })

// Step 3: Think about approach
think("Vou criar um interceptor que loga request/response. 
  Preciso usar console.log ou algum logger existente?")

// Step 4: Check if logger exists
retrieve_context({ query: "logger logging utility" })

// Step 5: Create the interceptor file
file_write({
  path: "src/shared/http/axios-interceptor.ts",
  content: `import axios from 'axios'

export function setupLoggingInterceptor() {
  axios.interceptors.request.use(
    config => {
      console.log('[API Request]', {
        method: config.method,
        url: config.url,
        data: config.data
      })
      return config
    },
    error => {
      console.error('[API Request Error]', error)
      return Promise.reject(error)
    }
  )
  
  axios.interceptors.response.use(
    response => {
      console.log('[API Response]', {
        status: response.status,
        url: response.config.url,
        data: response.data
      })
      return response
    },
    error => {
      console.error('[API Response Error]', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.message
      })
      return Promise.reject(error)
    }
  )
}`
})

// Step 6: Update axios-client to use interceptor
edit_file({
  path: "src/shared/http/axios-client.ts",
  old_str: `import axios from 'axios'

const axiosClient = axios.create({`,
  new_str: `import axios from 'axios'
import { setupLoggingInterceptor } from './axios-interceptor'

setupLoggingInterceptor()

const axiosClient = axios.create({`
})

// Step 7: Test it
bash({ command: "npm run typecheck" })

// Step 8: Finish
finish({
  response: `✅ Interceptor de logging criado!

**Arquivos criados:**
- \`src/shared/http/axios-interceptor.ts\` - Interceptor com logging

**Arquivos modificados:**
- \`src/shared/http/axios-client.ts\` - Importa e configura o interceptor

**O que faz:**
- Loga todas as requisições (método, URL, dados)
- Loga todas as respostas (status, URL, dados)
- Loga erros com detalhes completos

**Próximos passos:**
1. Execute a aplicação e veja os logs no console
2. Se quiser, posso adicionar níveis de log (debug/info/error)
3. Se quiser, posso integrar com um logger mais robusto como winston`
})
```

---

## Benefícios Observados

### 1. **Raciocínio Explícito**
O agente pensa antes de agir, tornando o processo transparente.

### 2. **Ferramentas Compostas**
Combina múltiplas ferramentas para resolver problemas complexos.

### 3. **Validação Contínua**
Testa as mudanças antes de finalizar.

### 4. **Contexto Completo**
Mantém histórico completo de todas as ações e observações.

### 5. **Streaming Natural**
Usuário vê progresso em tempo real.

---

## Comparação com Agente Antigo

### Agente Antigo (Orquestrado)
```
User: "Conserta esse bug"
  ↓
Greeting Agent: "Olá! Vou te ajudar"
  ↓
Clarification Agent: "Qual bug exatamente?"
  ↓
Planning Agent: "Vou criar um plano..."
  ↓
Analysis Agent: "Analisando o código..."
  ↓
Context Organizer: "Organizando informações..."
  ↓
User: "???" (perdido no fluxo)
```

### CodeAct Agent (Novo)
```
User: "Conserta esse bug"
  ↓
Agent:
  1. [think] Vou explorar o código para entender o bug
  2. [retrieve_context] Busca por padrões similares
  3. [file_read] Lê o arquivo problemático
  4. [think] Identifiquei a causa: import faltando
  5. [edit_file] Adiciona o import
  6. [bash] Testa a correção
  7. [finish] "Bug corrigido! ✅"
  
User: "Perfeito! Obrigado!" (experiência clara e objetiva)
```

---

## Debugging e Monitoramento

### Ver Estado do Agente

```typescript
// No adapter
for await (const chunk of adapter.processMessage(message, stream)) {
  // Log state after each iteration
  const state = adapter['agent']['state']
  console.log('Current state:', state.toSummary())
  console.log('Metrics:', state.metrics)
  console.log('Last action:', state.history[state.history.length - 1])
}
```

### Métricas Importantes

```typescript
{
  iterations: 4,        // Quantos loops foram necessários
  toolCalls: 5,        // Quantas ferramentas foram usadas
  errors: 0,           // Quantos erros ocorreram
  startTime: Date,     // Quando começou
  lastActionTime: Date // Última ação
}
```

### Alertas de Performance

```typescript
if (state.metrics.iterations > 10) {
  console.warn('⚠️ Agent taking too many iterations, may be stuck in a loop')
}

if (state.metrics.toolCalls > 15) {
  console.warn('⚠️ Too many tool calls, consider refactoring the task')
}

const duration = state.metrics.lastActionTime - state.metrics.startTime
if (duration > 30000) { // 30 seconds
  console.warn('⚠️ Task taking too long, consider timeout')
}
```

---

## Conclusão

O CodeAct Agent demonstra uma arquitetura limpa e eficiente que:
- ✅ Resolve problemas reais de forma sistemática
- ✅ Mantém o usuário informado do progresso
- ✅ Valida mudanças antes de finalizar
- ✅ É fácil de debugar e monitorar
- ✅ Escala naturalmente com novas ferramentas

Pronto para produção! 🚀
