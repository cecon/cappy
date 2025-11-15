# Planning Agent Implementations

This directory contains implementations of the multi-agent planning system.

## 📁 Files Overview

### ✅ **Primary Implementation** (Production-Ready)
**`../langgraph/planning-agent.ts`** - `LangGraphPlanningAgent`
- **Status**: ✅ Complete and production-ready
- **Architecture**: Phase-based state machine with internal orchestration
- **Features**:
  - Multi-phase workflow (Planning → Critic → Clarification → Completion)
  - Session-based state tracking (`Map<sessionId, InternalAgentState>`)
  - Tool filtering (analysis-only, no code editing during planning)
  - Plan persistence (save/load/update via `PlanPersistence`)
  - Extensive system prompts with self-discovery protocol
  - Automatic context gathering with LLM tool execution loop
- **User Experience**: Appears as a single intelligent agent
- **Use When**: You need a working planning agent for production

### 🔬 **Experimental Implementation** (LangGraph Skeleton)
**`langgraph-skeleton.ts`** - `MultiAgentPlanningSystem`
- **Status**: ⚠️ Complete but experimental
- **Architecture**: Full LangGraph state machine with explicit nodes
- **Features**:
  - Explicit node definitions (planning, critic, clarification, router)
  - LangGraph checkpointer for persistence
  - Formal state transitions
  - Graph-based workflow
- **User Experience**: More explicit multi-agent interaction
- **Use When**: You want to explore LangGraph's full capabilities or need explicit state persistence

---

## 🎯 **Which One Should I Use?**

| Aspect | LangGraphPlanningAgent | MultiAgentPlanningSystem |
|--------|------------------------|--------------------------|
| **Complexity** | Simpler phase-based approach | Full LangGraph state machine |
| **Maturity** | ✅ Production-ready | ⚠️ Experimental |
| **Persistence** | ✅ Integrated | ✅ Via LangGraph checkpointer |
| **Tool Integration** | ✅ Comprehensive | ⚠️ Basic |
| **User Experience** | Seamless single-agent | Explicit multi-agent |
| **Recommended For** | Most use cases | Research/experimentation |

**Recommendation**: Use `LangGraphPlanningAgent` unless you have specific needs for LangGraph's state machine features.

---

## 🚀 Usage

### Using LangGraphPlanningAgent (Recommended)

```typescript
import { LangGraphPlanningAgent } from '../langgraph/planning-agent'

const agent = new LangGraphPlanningAgent()
await agent.initialize()

const response = await agent.runTurn({
  prompt: 'Create a plan to add JWT authentication',
  sessionId: 'user-session-123',
  onToken: (chunk) => console.log(chunk)
})
```

### Using MultiAgentPlanningSystem

```typescript
import { MultiAgentPlanningSystem } from './langgraph-skeleton'

const system = new MultiAgentPlanningSystem()
await system.initialize()

const graph = system.createGraph()
// Use LangGraph API to execute workflow
```

---

## 📋 Shared Components

Both implementations share:

- **`types.ts`** - Type definitions (DevelopmentPlan, CriticFeedback, etc.)
- **`plan-persistence.ts`** - Plan save/load/update utilities

---

## 🔮 Future Considerations

1. **Merge Best of Both**: Consider integrating LangGraph's checkpointer into the phase-based approach
2. **Hybrid Mode**: Allow switching between implementations based on use case
3. **Deprecation**: Once LangGraphPlanningAgent is proven in production, consider deprecating the skeleton

---

## 📚 Documentation

- **Architecture**: `/docs/agents/MULTI_AGENT_PLANNING.md`
- **Workflow Examples**: See doc examples for clarification flows
- **Type Definitions**: `types.ts` has complete JSDoc comments
