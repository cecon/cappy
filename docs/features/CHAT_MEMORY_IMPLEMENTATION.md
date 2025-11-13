# Implementação de Memória no Chat Participant

## Problema Identificado

O chat participant original manipulava o histórico manualmente via `AgentController` e estruturas auxiliares (`chatControllers`, normalização de turnos, etc.). Sempre que a sessão era perdida ou um erro acontecia, o contexto voltava ao ponto zero.

## Nova Arquitetura

### LangGraph + MemorySaver

| Componente | Responsabilidade |
|------------|------------------|
| `LangGraphChatAgent` | Orquestra a conversa usando LangGraph |
| `MemorySaver` | Persistência em memória dos estados por sessão |
| `StateGraph` + `Annotation` | Define o estado (`messages`) com reducer que agrega turnos |

```mermaid
flowchart TD
  U[Usuário envia prompt] -->|invoke| G[StateGraph (LangGraph)]
  G -->|Atualiza state.messages| C[MemorySaver]
  G -->|Histórico completo| L[Copilot Model]
  L -->|Streaming| A[LangGraphChatAgent]
  A -->|Atualiza state| G
  A -->|stream.markdown| VSCode[Chat UI]
```

### Código Chave

```typescript
const ChatStateDefinition = Annotation.Root({
  messages: Annotation<ChatMemoryMessage[]>({
    reducer: (left, right) => {
      const updates = Array.isArray(right) ? right : [right]
      return left.concat(updates)
    },
    default: () => []
  })
})

const graph = new StateGraph(ChatStateDefinition)
  .addNode('noop', async () => ({}))
  .addEdge(START, 'noop')
  .addEdge('noop', END)
  .compile({ checkpointer: new MemorySaver() })
```

```typescript
const updatedState = await this.graph.invoke(
  { messages: [{ role: 'user', content: prompt }] },
  config
)

const response = await this.model.sendRequest(messages, ...)

await this.graph.invoke(
  { messages: [{ role: 'assistant', content: assistantResponse }] },
  config
)
```

### Fluxo de Cada Turno

1. Adiciona usuário → `graph.invoke({ messages: user })`
2. Recupera histórico completo → `MemorySaver`
3. Gera resposta via `LanguageModelChat`
4. Armazena resposta → `graph.invoke({ messages: assistant })`
5. Devolve texto ao VS Code chat (`stream.markdown`)

## Por que LangGraph?

- ✅ Estado conversacional formalizado (`Annotation` + reducer)
- ✅ Persistência automática por `sessionId`
- ✅ Cancelamento fácil (AbortController + `RunnableConfig.signal`)
- ✅ Preparado para ampliar com nós extras (ferramentas, branching, etc.)

## Testes Recomendados

- "Olá, meu nome é João" → "Qual é o meu nome?" (mantém memória)
- Sequência longa de perguntas para validar que o histórico cresce sem duplicações
- Cancelar requisição no meio para confirmar que nada é salvo indevidamente

## Próximos Passos

- [ ] Checkpoint persistente (SQLite / disco)
- [ ] Limitar tokens do histórico com resumo automático
- [ ] Adicionar tool nodes (ex.: recuperar contexto) ao grafo
- [ ] Cobertura de testes automatizados para o LangGraphChatAgent

## Referências

- [@langchain/langgraph](https://github.com/langchain-ai/langgraph)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
