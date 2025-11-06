# 🧪 Guia Rápido de Teste - CappyAgent (CodeAct)

## ✅ Status: PRONTO PARA TESTAR!

Todos os arquivos foram implementados sem erros de compilação.

---

## 🚀 Como Testar (3 Opções)

### Opção 1: Teste Standalone (Mais Simples)

```bash
# Executar o arquivo de teste
npx tsx test-codeact-agent.ts
```

Este teste:
- ✅ Cria o CappyAgentAdapter
- ✅ Inicializa o LLM (Copilot)
- ✅ Envia uma mensagem de teste
- ✅ Mostra o streaming da resposta

---

### Opção 2: Integrar no Chat Atual

Abra `src/extension.ts` e substitua o engine atual:

```typescript
// ANTES (linha ~500-550)
// const chatEngine = new OrchestratedChatEngine(retrieveContextUseCase)

// DEPOIS
import { CappyAgentAdapter } from './nivel2/infrastructure/agents/codeact'

const cappyAgent = new CappyAgentAdapter(
  {
    maxIterations: 10,
    temperature: 0.7,
    enableThinking: true
  },
  retrieveContextUseCase
)

await cappyAgent.initialize()
const chatService = createChatService(cappyAgent)
```

Depois compile e teste:
```bash
npm run compile
# Pressione F5 para debug
```

---

### Opção 3: Teste Programático (Controle Total)

```typescript
import { CappyAgent, State, createMessageAction } from './src/nivel2/infrastructure/agents/codeact'

const agent = new CappyAgent({}, retrieveUseCase)
await agent.initialize()

const state = new State('session-123')
state.addEvent(createMessageAction('Help me', 'user'))

// Execute uma iteração
const action = await agent.step(state)
console.log('Action:', action)

const observation = await agent.executeAction(action)
console.log('Observation:', observation)

// Ver estado
console.log('State:', state.toSummary())
```

---

## 📋 Checklist de Teste

### ✅ Funcionalidades Básicas

- [ ] **LLM Initialization**: Agent se conecta ao Copilot
- [ ] **Message Processing**: Processa mensagens do usuário
- [ ] **Streaming**: Resposta vem em chunks (streaming)
- [ ] **Think Tool**: Agent mostra raciocínio interno
- [ ] **Finish Tool**: Agent finaliza corretamente com summary

### ✅ Funcionalidades Avançadas (se retrieveUseCase disponível)

- [ ] **RetrieveContext Tool**: Busca no código funciona
- [ ] **Context Formatting**: Resultados são formatados corretamente
- [ ] **State Management**: Histórico é mantido
- [ ] **Metrics**: Iterations, toolCalls são contados

### ✅ Casos de Erro

- [ ] **Sem LLM**: Mostra erro claro se Copilot não disponível
- [ ] **Tool Error**: Errors de tools são capturados
- [ ] **Max Iterations**: Para após N iterações

---

## 🐛 Troubleshooting

### Erro: "No LLM model available"
**Causa**: GitHub Copilot não está instalado ou ativo
**Solução**: 
1. Instale GitHub Copilot extension
2. Faça login no GitHub
3. Verifique se subscription está ativa

### Erro: "RetrieveContextUseCase not available"
**Causa**: Sistema de indexação não está pronto
**Solução**: 
- É esperado se índices não foram criados ainda
- Agent funcionará sem retrieval, apenas com LLM

### Erro: Compilation errors
**Causa**: Algum import está incorreto
**Solução**:
```bash
npm run compile
# Verificar output para ver erros específicos
```

---

## 📊 O Que Esperar

### Exemplo de Output Esperado:

```
🚀 Testing CappyAgent (CodeAct pattern)...

1️⃣ Creating CappyAgentAdapter...
2️⃣ Initializing (connecting to LLM)...
[CappyAgent] Initialized with model: copilot-gpt-4o
✅ Agent initialized

3️⃣ Sending message: Hello! Can you help me understand how the CodeAct pattern works?
────────────────────────────────────────────────────────────────────────────────

__REASONING_START__
🧠 The user is asking about the CodeAct pattern. I should explain what it is...
__REASONING_END__

The CodeAct pattern is an agent architecture where:

1. **Actions** represent what the agent wants to do (messages, tool calls, etc)
2. **Observations** represent the results of those actions
3. **State** maintains the complete history and context
4. The agent operates in a **step-based loop**, deciding one action at a time

This pattern comes from the OpenHands project and provides clear separation
between decision-making and execution.

────────────────────────────────────────────────────────────────────────────────
✅ Test completed successfully!
```

---

## 🎯 Próximos Passos Após Teste

1. **Se funcionar bem**: 
   - Integrar no extension.ts
   - Adicionar mais tools (CreateFile, CreateTask, etc)
   - Remover código antigo de sub-agents

2. **Se encontrar problemas**:
   - Verificar logs no console
   - Checar State.toSummary() para debugging
   - Ajustar system prompt se necessário

---

## 📁 Arquivos Criados (Resumo)

```
✅ 11 arquivos de código (src/nivel2/infrastructure/agents/codeact/)
✅ 4 arquivos de documentação (docs/architecture/)
✅ 1 arquivo de teste (test-codeact-agent.ts)
✅ 0 erros de compilação
```

**TUDO PRONTO PARA TESTAR!** 🚀
