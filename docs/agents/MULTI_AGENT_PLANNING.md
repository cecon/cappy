# Multi-Agent Planning System

## 🎯 Architecture Overview

The Cappy Planning Agent is a sophisticated multi-phase system that appears as a single intelligent agent to users but internally orchestrates multiple specialized agents to create comprehensive development plans.

**Implementation**: `src/nivel2/infrastructure/agents/langgraph/planning-agent.ts`

## 🏗️ Architecture

### Phase-Based State Machine

Unlike traditional multi-agent systems, Cappy uses a **phase-based approach** that:
- ✅ Appears as one agent to the user
- ✅ Internally cycles through specialized phases
- ✅ Persists plans to `.cappy/plans/` as JSON
- ✅ Tracks session state in memory
- ✅ Filters tools to prevent code generation during planning

### Internal Phases

```
User Request → Planning → Critic → Clarification → Completion
                  ↓         ↓            ↓             ↓
              Create     Review      Ask ONE       Finalize
               Plan       Plan       Question       & Save
```

## 🤖 Agent Phases

### 1. Planning Phase
**Responsibility**: Create initial comprehensive plan using extensive context gathering

**Tools Used** (Analysis Only):
- `cappy_retrieve_context` - Find similar patterns and documentation
- `read_file` - Analyze existing implementations
- `grep_search` - Search for code patterns
- `list_dir` - Explore workspace structure
- `semantic_search` - Find semantically related code
- `file_search` - Locate specific files

**Blocked Tools** (No Code Generation):
- ❌ `create_file`
- ❌ `replace_string_in_file`
- ❌ `run_in_terminal`
- ❌ `run_task`

**System Prompt Highlights**:
```
CRITICAL_WORKFLOW:
1. SELF-DISCOVERY FIRST - Use tools to answer your own questions
2. ASK ONE QUESTION AT A TIME - Only if tools cannot answer
3. GATHER CONTEXT AUTONOMOUSLY - Extensive use of retrieval tools
4. CONFIRM YOUR FINDINGS - Show evidence, don't ask open questions
```

**Output**: 
- `DevelopmentPlan` object saved to `.cappy/plans/plan-{id}.json`
- State transitions to **Critic Phase**

### 2. Critic Phase
**Responsibility**: Review plan and identify gaps, ambiguities, and missing information

**Analysis Checklist**:
- ✅ Steps well-defined with file paths?
- ✅ Sufficient context gathered?
- ✅ Dependencies clear?
- ✅ Validation criteria measurable?
- ❌ Missing information?
- ❌ Ambiguous requirements?

**Feedback Classification**:
- **CRITICAL**: Blocks implementation, requires clarification
- **WARNING**: Should be addressed but not blocking
- **INFO**: Nice to have, optional

**State Transitions**:
- Has CRITICAL issues → **Clarification Phase**
- No critical issues → **Completion Phase**

**Output**:
- `CriticFeedback[]` array
- Plan status updated to `'clarifying'` or `'ready'`
- Plan persisted to disk

### 3. Clarification Phase
**Responsibility**: Ask ONE specific, context-rich question to the user

**Process**:
1. Check if user provided answer to previous question
2. If yes: Record answer, update plan, transition to Critic
3. If no: Ask ONE question based on most critical feedback
4. Add clarification to plan with `answer: undefined`
5. Wait for user's next message

**Question Protocol**:
```
✅ GOOD Question:
"I found you have src/services/ and src/lib/ directories.
 For the JWT service, should I create it in:
 a) src/services/auth/jwt-service.ts (with other services)
 b) src/lib/auth.ts (as a utility)
 
 What's your preference?"

❌ BAD Question:
"Where should I put the JWT service?"
```

**Output**:
- ONE question to user
- `PlanClarification` added to plan
- State transitions back to **Critic Phase** after answer

### 4. Completion Phase
**Responsibility**: Finalize plan and present to user

**Actions**:
- Set plan status to `'ready'`
- Update `version` and `updatedAt`
- Persist final plan to disk
- Generate completion summary

**Output**:
```
✅ Development Plan Complete!

📄 Plan saved at: `.cappy/plans/plan-{id}.json`

The plan includes:
- 5 actionable steps
- 3 clarifications resolved
- 2 risks identified
- 4 success criteria

Would you like to:
1. Review the plan (I can open it in the editor)
2. Make adjustments
3. Send it to the development agent
```

## 📊 Data Structures

### DevelopmentPlan
```typescript
interface DevelopmentPlan {
  id: string                    // plan-{timestamp}-{random}
  title: string                 // Extracted from LLM response
  goal: string                  // Original user request
  context: PlanContext          // Files, patterns, dependencies
  steps: PlanStep[]             // Ordered implementation steps
  clarifications: PlanClarification[]  // Q&A with user
  risks: PlanRisk[]             // Identified risks & mitigations
  successCriteria: string[]     // How to validate completion
  createdAt: string             // ISO-8601 timestamp
  updatedAt: string             // ISO-8601 timestamp
  status: 'draft' | 'clarifying' | 'ready' | 'in-progress' | 'completed'
  version: number               // Increments on each update
}
```

### PlanStep
```typescript
interface PlanStep {
  id: string                    // step-1, step-2, etc.
  title: string                 // Short description
  description: string           // Detailed what/why/how
  file?: string                 // Target file path
  lineStart?: number            // Line range (optional)
  lineEnd?: number
  dependencies: string[]        // IDs of prerequisite steps
  validation: string            // How to verify completion
  rationale: string             // Why this approach
  status: 'pending' | 'clarifying' | 'ready' | 'completed'
}
```

### CriticFeedback
```typescript
interface CriticFeedback {
  stepId?: string               // Related step (optional)
  issue: string                 // What's wrong/missing
  severity: 'info' | 'warning' | 'critical'
  suggestion: string            // How to fix
  requiresClarification: boolean  // Need user input?
}
```

### PlanClarification
```typescript
interface PlanClarification {
  id: string                    // clarif-1, clarif-2, etc.
  question: string              // Question asked to user
  answer?: string               // User's response
  critical: boolean             // Blocks progress?
  relatedSteps: string[]        // Step IDs affected
}
```

## 🔄 Complete Flow Example

```
┌─────────────────────────────────────────────────────────────┐
│ Usuário: "Preciso adicionar autenticação JWT"              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Planning Agent:                                             │
│  [Tool] cappy_retrieve_context("autenticação")             │
│  [Tool] grep_search("jwt|auth|login")                       │
│  [Tool] read_file("package.json")                           │
│                                                              │
│  Cria: .cappy/plans/plan-abc123.json                       │
│  {                                                           │
│    "title": "Implementar JWT Authentication",               │
│    "steps": [                                                │
│      { "id": "1", "title": "Install dependencies", ...},    │
│      { "id": "2", "title": "Create JWT service", ...},      │
│      { "id": "3", "title": "Add middleware", ...}           │
│    ],                                                        │
│    "status": "draft"                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Critic Agent:                                               │
│  Analisa plan-abc123.json                                   │
│                                                              │
│  Feedback:                                                   │
│  ❌ Step 2: Não especifica onde criar JWT service           │
│  ❌ Step 3: Não define quais rotas proteger                 │
│  ⚠️  Falta definir estratégia de refresh tokens             │
│                                                              │
│  Atualiza plan-abc123.json:                                 │
│  {                                                           │
│    "clarifications": [                                       │
│      {                                                       │
│        "id": "c1",                                           │
│        "question": "Onde criar JWT service?",                │
│        "critical": true                                      │
│      }                                                       │
│    ]                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Clarification Agent:                                        │
│  Lê clarifications não respondidas                          │
│  Pega a mais crítica: "c1"                                  │
│                                                              │
│  Pergunta ao usuário (NO CHAT):                             │
│  "Analisando seu projeto, vejo que você tem:                │
│   - src/services/ (outros services)                         │
│   - src/lib/ (utilities)                                    │
│                                                              │
│   Onde devo criar o JWT service?"                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
                  User answers → Critic re-reviews → Done
```

## 💻 API Usage

### Via VS Code Commands

```typescript
// 1. Create New Plan (Command Palette)
// CMD+Shift+P → "Cappy: Create Development Plan"
// User is prompted for request, plan is created automatically

// 2. List All Plans
// CMD+Shift+P → "Cappy: List All Plans"
// Shows quick pick with all saved plans

// 3. Open Plan in Editor
// CMD+Shift+P → "Cappy: Open Plan"
// Opens selected plan JSON in editor

// 4. Delete Plan
// CMD+Shift+P → "Cappy: Delete Plan"
// Removes plan file from .cappy/plans/
```

### Programmatic API

```typescript
import { LangGraphPlanningAgent } from '../planning-agent'

// Initialize agent
const agent = new LangGraphPlanningAgent()
await agent.initialize()

// Run planning session
const response = await agent.runTurn({
  prompt: 'Add JWT authentication to the API',
  sessionId: 'session-123',
  token: cancellationToken,  // Optional
  onToken: (chunk) => {      // Optional streaming
    console.log(chunk)
  }
})

// Agent internally:
// 1. Creates plan with extensive tool usage
// 2. Critic reviews plan
// 3. Asks clarifying questions (one at a time)
// 4. Persists plan to disk
// 5. Returns final response
```

### Plan Persistence API

```typescript
import { PlanPersistence } from '../plan-persistence'

// Save plan
const planPath = await PlanPersistence.savePlan(plan)
// → /workspace/.cappy/plans/plan-abc123.json

// Load plan
const plan = await PlanPersistence.loadPlan('abc123')

// Update plan
const updated = await PlanPersistence.updatePlan('abc123', {
  status: 'in-progress',
  steps: [...newSteps]
})

// List all plans
const plans = await PlanPersistence.listPlans()
// → [DevelopmentPlan, DevelopmentPlan, ...]

// Delete plan
await PlanPersistence.deletePlan('abc123')

// Open in editor
await PlanPersistence.openPlanInEditor('abc123')
```

## 🎨 Session State Management

Each user conversation has its own session state:

```typescript
interface InternalAgentState {
  currentPlan: DevelopmentPlan | null
  criticFeedback: CriticFeedback[]
  planFilePath: string | null
  agentPhase: 'planning' | 'critic' | 'clarifying' | 'done'
}

// Stored in memory as:
// Map<sessionId, InternalAgentState>
```

**Session Lifecycle**:
1. User starts conversation → New session ID
2. Agent creates state entry in Map
3. Phase transitions tracked per session
4. Plan persisted to disk after each update
5. Session state cleared on completion (plan remains on disk)

## 🔍 Tool Filtering Strategy

Planning agent can ONLY use analysis tools:

```typescript
const planningTools = toolsArray.filter(tool => {
  const name = tool.name
  
  // ✅ Include analysis and context tools
  if (name.startsWith('cappy_')) return true
  if (['read_file', 'grep_search', 'list_dir', 'semantic_search', 'file_search'].includes(name)) 
    return true
  
  // ❌ Exclude code generation/editing tools
  if (['create_file', 'replace_string_in_file', 'run_in_terminal', 'run_task'].includes(name)) 
    return false
  
  return false
})
```

**Why?**
- Planning agent focuses on **analysis and design**
- Implementation is handled by separate **development agents**
- Prevents accidental code changes during planning phase
- Enforces separation of concerns

## 📂 File Structure

```
.cappy/
 └─ plans/
     ├─ plan-1731600000000-abc123.json
     ├─ plan-1731600123456-def456.json
     └─ plan-1731600234567-ghi789.json

src/nivel2/infrastructure/agents/
 ├─ langgraph/
 │   └─ planning-agent.ts          # LangGraphPlanningAgent (PRODUCTION)
 └─ planning/
     ├─ types.ts                    # Type definitions
     ├─ plan-persistence.ts         # Save/load/update utilities
     ├─ langgraph-skeleton.ts       # Alternative LangGraph implementation
     └─ README.md                   # Implementation comparison

docs/agents/
 └─ MULTI_AGENT_PLANNING.md        # This file

test/nivel2/
 ├─ planning-agent.test.ts         # Agent tests
 └─ plan-persistence.test.ts       # Persistence tests
```

## 🚀 Getting Started

### 1. Create a Plan

```bash
# Via Command Palette
CMD+Shift+P → "Cappy: Create Development Plan"

# Enter request
"Add user authentication with JWT tokens"

# Agent will:
# - Analyze workspace automatically
# - Ask clarifying questions (one at a time)
# - Generate comprehensive plan
# - Save to .cappy/plans/
```

### 2. Review the Plan

```bash
# Via Command Palette
CMD+Shift+P → "Cappy: List All Plans"

# Select plan → Opens in editor
# JSON structure with all details:
# - Steps with file paths
# - Context gathered
# - Risks identified
# - Success criteria
```

### 3. Implement the Plan

```bash
# Future: Send plan to development agent
# Development agent will:
# - Read plan from .cappy/plans/
# - Execute steps in order
# - Validate each step
# - Update plan status
```

## 🧪 Testing

```bash
# Run tests
npm test test/nivel2/planning-agent.test.ts
npm test test/nivel2/plan-persistence.test.ts

# Coverage includes:
# ✅ Plan parsing (markdown → JSON)
# ✅ Phase transitions
# ✅ Critic feedback parsing
# ✅ Clarification management
# ✅ Tool filtering
# ✅ Persistence operations
```

## 🔮 Future Enhancements

1. **LangGraph Integration**: Use LangGraph checkpointer for state persistence
2. **Plan Templates**: Pre-defined templates for common tasks
3. **Plan Diff**: Compare plan versions, track changes
4. **Execution Mode**: Direct integration with development agent
5. **Collaborative Planning**: Multiple users contribute to same plan
6. **Plan Analytics**: Metrics on planning effectiveness

## 📚 Related Documentation

- **Architecture**: `/docs/architecture/ARCHITECTURE_OVERVIEW.md`
- **Task Workflow**: `/docs/TASK_WORKFLOW.md`
- **Context Enrichment**: `/docs/features/CONTEXT_ENRICHMENT.md`
- **Implementation Comparison**: `/src/nivel2/infrastructure/agents/planning/README.md`

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Last Updated**: November 14, 2025                     │
│   - /api/users (user.ts)                                    │
│   - /api/posts (posts.ts)                                   │
│   - /api/auth (auth.ts)                                     │
│                                                              │
│   Quais rotas devem ser protegidas com JWT?"                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Usuário: "Todas exceto /api/auth"                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
         ... Loop continua até Critic aprovar ...
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Critic Agent (última rodada):                               │
│  Analisa plan-abc123.json                                   │
│                                                              │
│  Feedback:                                                   │
│  ✅ Todos steps bem definidos                               │
│  ✅ Contexto completo                                        │
│  ✅ Validações claras                                        │
│                                                              │
│  Status: APROVADO                                            │
│                                                              │
│  Atualiza plan-abc123.json:                                 │
│  {                                                           │
│    "status": "ready",                                        │
│    "version": 5                                              │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Sistema mostra ao usuário:                                  │
│  "✅ Plano completo! Salvo em .cappy/plans/plan-abc123.json"│
│  "📄 Abrir plano no editor?"                                │
│  "🚀 Enviar para agente de desenvolvimento?"                │
└─────────────────────────────────────────────────────────────┘
```

## 📄 Estrutura do JSON

```json
{
  "id": "abc123",
  "title": "Implementar JWT Authentication",
  "goal": "Adicionar sistema de autenticação JWT com refresh tokens...",
  "context": {
    "filesAnalyzed": [
      "package.json",
      "src/routes/user.ts",
      "src/services/user-service.ts"
    ],
    "patternsFound": [
      "Express middleware pattern",
      "Service layer architecture"
    ],
    "dependencies": [
      "express@4.18.2",
      "bcrypt@5.1.0"
    ],
    "assumptions": [
      "MongoDB como database",
      "Usar httpOnly cookies para tokens"
    ]
  },
  "steps": [
    {
      "id": "1",
      "title": "Install JWT dependencies",
      "description": "Adicionar jsonwebtoken e @types/jsonwebtoken",
      "file": "package.json",
      "dependencies": [],
      "validation": "npm list jsonwebtoken deve retornar versão instalada",
      "rationale": "Biblioteca padrão para JWT no Node.js",
      "status": "ready"
    },
    {
      "id": "2",
      "title": "Create JWT service",
      "description": "Implementar funções: generateAccessToken(), generateRefreshToken(), verifyToken()",
      "file": "src/services/auth/jwt-service.ts",
      "lineStart": null,
      "lineEnd": null,
      "dependencies": ["1"],
      "validation": "Testes unitários para cada função passando",
      "rationale": "Centralizar lógica de JWT em um service reutilizável",
      "status": "ready"
    }
  ],
  "clarifications": [
    {
      "id": "c1",
      "question": "Onde criar JWT service?",
      "answer": "Em src/services/auth/",
      "critical": true,
      "relatedSteps": ["2"]
    },
    {
      "id": "c2",
      "question": "Quais rotas proteger?",
      "answer": "Todas exceto /api/auth",
      "critical": true,
      "relatedSteps": ["5"]
    }
  ],
  "risks": [
    {
      "id": "r1",
      "description": "Secrets do JWT podem ser expostos se commitados",
      "severity": "high",
      "mitigation": "Usar .env e nunca commitá-lo. Adicionar ao .gitignore"
    }
  ],
  "successCriteria": [
    "Usuário consegue fazer login e receber tokens",
    "Rotas protegidas retornam 401 sem token",
    "Refresh token funciona corretamente"
  ],
  "createdAt": "2025-11-13T10:30:00Z",
  "updatedAt": "2025-11-13T10:45:00Z",
  "status": "ready",
  "version": 5
}
```

## 🔄 Interação com Usuário

### Usuário pode sugerir mudanças:

**Usuário**: "Acho que step 3 deveria vir antes do step 2"

**Sistema**:
1. Planning Agent interpreta a sugestão
2. Atualiza `plan-abc123.json` (reordena steps)
3. Critic Agent revisa novamente
4. Se criar novos gaps, Clarification Agent pergunta
5. Mostra versão atualizada

## 🎯 Benefícios

✅ **Iterativo**: Plano vai sendo refinado aos poucos  
✅ **Transparente**: JSON pode ser inspecionado/editado  
✅ **Versionado**: Cada mudança incrementa `version`  
✅ **Focado**: UMA pergunta por vez  
✅ **Contextual**: Agentes leem/escrevem no mesmo arquivo  
✅ **Colaborativo**: Usuário participa ativamente  

## 🚀 Próximos Passos

1. Implementar lógica dos 3 agentes
2. Criar system prompts específicos para cada agente
3. Integrar com o chat participant do VS Code
4. Adicionar comando para abrir plano JSON no editor
5. Criar visualização do plano no dashboard
