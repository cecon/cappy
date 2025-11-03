# Refatoração do LangGraphChatEngine - Analista com Fases

## 📋 Resumo Executivo

Refatoração completa do `LangGraphChatEngine` para implementar um fluxo de análise estruturado em **5 fases sequenciais**, com RAG híbrido, perguntas inteligentes one-by-one, e geração de múltiplas opções de design antes da especificação final.

**Data**: 3 de novembro de 2025  
**Arquivos modificados**: 
- `src/nivel2/infrastructure/agents/langgraph-chat-engine.ts` (refatorado)
- `src/nivel2/infrastructure/agents/types.ts` (novo)

---

## 🎯 Objetivos Alcançados

### ✅ Problemas Resolvidos

| Problema Anterior | Solução Implementada |
|-------------------|----------------------|
| ❌ Loop único sem estrutura | ✅ **5 fases estruturadas**: Intent → Context → Questions → Options → Spec |
| ❌ RAG mal usado (só chama tool) | ✅ **RAG híbrido inteligente**: múltiplas buscas automáticas + análise de gaps |
| ❌ Perguntas em batch | ✅ **Perguntas one-by-one**: controle explícito de estado + HITL |
| ❌ Sem análise de gaps | ✅ **identifyGaps()**: detecta contexto faltante automaticamente |
| ❌ Vai direto pra spec | ✅ **Design Options**: 3 abordagens validadas antes da spec |
| ❌ Prompt genérico | ✅ **Prompts por fase**: contexto específico em cada etapa |
| ❌ Sem rastreamento de estado | ✅ **AnalystState**: rastreamento completo de progresso |

---

## 🏗️ Arquitetura Implementada

### Fluxo de Fases

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INPUT (vaga/incompleta)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: INTENT EXTRACTION                                       │
│ • Parse objetivo real                                           │
│ • Identifica termos técnicos                                    │
│ • Calcula clarity score                                         │
│ • Detecta ambiguidades                                          │
│ Output: { objective, technicalTerms, category, clarityScore }  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: CONTEXT GATHERING (RAG Híbrido)                        │
│ • cappy_retrieve_context × 3+ (mínimo)                         │
│   1. CODE: implementations existentes                           │
│   2. PREVENTION: regras da categoria                            │
│   3. DOCUMENTATION: patterns e arquitetura                      │
│   4. TASK: trabalhos similares completados                      │
│ • Acumula resultados por fonte                                  │
│ • identifyGaps(): analisa o que falta                           │
│ Output: { code[], docs[], prevention[], tasks[], gaps[] }      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE 3: QUESTIONS (ONE-BY-ONE)                                  │
│ • Gera perguntas baseado em gaps                                │
│ • Mostra o que encontrou (transparência)                        │
│ • Explica WHY está perguntando                                  │
│ • Apresenta 1 pergunta → aguarda resposta → próxima             │
│ • Se gaps.length === 0: pula fase                              │
│ Output: { questions[], answers[] }                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE 4: DESIGN OPTIONS                                          │
│ • Gera 3 abordagens de implementação                            │
│ • Cada opção:                                                   │
│   - Referências REAIS (file.ts:45-67)                          │
│   - Integração com código existente                             │
│   - Lista de modificações necessárias                           │
│   - Riscos identificados                                        │
│   - Estimativa de esforço                                       │
│   - Prós/contras                                                │
│   - Exemplos de código do retrieval                             │
│ • Usuário escolhe 1 opção                                       │
│ Output: { options[], chosenOption }                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE 5: SPECIFICATION GENERATION                                │
│ • Gera task ULTRA-DETALHADA baseada na opção escolhida         │
│ • Estrutura:                                                    │
│   - Context: arquivos relevantes com linhas                     │
│   - Existing Patterns: código real para seguir                  │
│   - Prevention Rules: todas as regras da categoria              │
│   - Step-by-Step: instruções precisas + validação              │
│   - Code Examples: snippets do retrieval                        │
│ • Salva em .cappy/tasks/TASK_YYYY-MM-DD-HH-MM-SS_slug.md      │
│ Output: task.md persistida                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Implementados

### 1. **types.ts** (Novo Arquivo)

Interfaces TypeScript para suporte ao fluxo:

```typescript
export interface AnalystState {
  userInput: string
  intent?: { objective, technicalTerms, clarityScore, category, ambiguities }
  context?: { code[], documentation[], prevention[], tasks[], gaps[] }
  questions: Question[]
  answers: Answer[]
  options: DesignOption[]
  chosenOption?: DesignOption
  specification?: string
  currentPhase: 'intent' | 'context' | 'questions' | 'options' | 'spec' | 'done'
  sessionId: string
  createdAt: Date
}
```

### 2. **ANALYST_SYSTEM_PROMPT**

Prompt gigante (200+ linhas) com instruções detalhadas para cada fase:

- **PHASE 1**: Como extrair intent (JSON format)
- **PHASE 2**: Como usar RAG híbrido (múltiplas queries)
- **PHASE 3**: Como gerar perguntas inteligentes (one-by-one)
- **PHASE 4**: Como propor design options (3 abordagens)
- **PHASE 5**: Como gerar specs ultra-detalhadas

### 3. **Métodos Privados**

| Método | Responsabilidade |
|--------|------------------|
| `getPhasePrompt(state)` | Retorna prompt específico da fase atual |
| `processPhase(state, text, toolCalls, messages, token)` | Processa resposta do LLM e faz transição de fase |
| `identifyGaps(intent, context)` | Analisa o que está faltando no contexto coletado |
| `parseRetrievalResult(toolResult)` | Parse inteligente dos resultados do RAG |
| `formatOptionsUI(state)` | Gera UI para escolha de opções |
| `executeTool(toolCall, messages, token)` | Executa tool e adiciona resultado à conversa |
| `buildMessages(context, systemPrompt)` | Constrói array de mensagens com histórico |

### 4. **Gerenciamento de Estado**

```typescript
private readonly stateMap = new Map<string, AnalystState>()

// Inicialização
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
const state: AnalystState = {
  userInput: message.content,
  questions: [],
  answers: [],
  options: [],
  currentPhase: 'intent',
  sessionId,
  createdAt: new Date()
}
this.stateMap.set(sessionId, state)
```

### 5. **Loop Agentico Refatorado**

```typescript
for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
  // 1. Adiciona prompt da fase atual
  const phasePrompt = this.getPhasePrompt(state)
  messages.push(vscode.LanguageModelChatMessage.User(phasePrompt))
  
  // 2. Envia para o LLM
  const response = await model.sendRequest(messages, options, token)
  
  // 3. Coleta resposta + tool calls
  const { textAccumulator, toolCalls } = await collectResponse(response)
  
  // 4. Processa fase
  const phaseResult = await this.processPhase(state, textAccumulator, toolCalls, messages, token)
  
  // 5. Trata resultado
  if (phaseResult.type === 'wait_user') {
    // Aguarda resposta do usuário (perguntas ou escolha de opção)
    const userResponse = await this.waitForUserResponse(phaseResult.messageId)
    // Adiciona resposta ao estado e continua
  }
  
  if (phaseResult.type === 'done') {
    // Salva task e finaliza
    await this.persistPlanFromText(state.specification!)
    return
  }
}
```

---

## 📊 Transições de Fase

### Triggers de Transição

| De | Para | Trigger |
|----|------|---------|
| `intent` | `context` | Detecta JSON com `"objective"` no texto |
| `context` | `questions` | Coletou ≥3 retrievals OU sem tool calls |
| `questions` | `questions` | Ainda tem perguntas não respondidas |
| `questions` | `options` | `questions.length === 0` OU todas respondidas |
| `options` | `spec` | Usuário escolheu uma opção |
| `spec` | `done` | Detecta `<!-- agent:done -->` |

### Detecção de JSON por Fase

```typescript
// FASE 1: Intent
if (text.includes('"objective"')) {
  const jsonMatch = text.match(/\{[\s\S]*?"objective"[\s\S]*?\}/)?.[0]
  state.intent = JSON.parse(jsonMatch)
}

// FASE 3: Questions
if (text.includes('"questions"')) {
  const jsonMatch = text.match(/\{[\s\S]*?"questions"[\s\S]*?\}/)?.[0]
  state.questions = JSON.parse(jsonMatch).questions || []
}

// FASE 4: Options
if (text.includes('"options"')) {
  const jsonMatch = text.match(/\{[\s\S]*?"options"[\s\S]*?\}/)?.[0]
  state.options = JSON.parse(jsonMatch).options || []
}
```

---

## 🔍 RAG Híbrido Inteligente

### Buscas Automáticas por Fase

**PHASE 2: Context Gathering** dispara automaticamente:

```typescript
// 1. Código existente
cappy_retrieve_context({
  query: "${intent.objective} implementation",
  sources: ["code"],
  includeRelated: true
})

// 2. Regras de prevenção da categoria
cappy_retrieve_context({
  query: "${intent.category} best practices rules",
  sources: ["prevention"],
  category: intent.category
})

// 3. Documentação e padrões
cappy_retrieve_context({
  query: "${intent.objective} architecture patterns",
  sources: ["documentation"]
})

// 4. Tasks similares completadas
cappy_retrieve_context({
  query: "${intent.objective}",
  sources: ["task"]
})
```

### Análise de Gaps

```typescript
private identifyGaps(intent, context): string[] {
  const gaps: string[] = []
  
  // Sem exemplos de código
  if (context.code.length === 0) {
    gaps.push('no_code_examples')
  }
  
  // Sem regras de prevenção
  if (context.prevention.length === 0 && intent.category) {
    gaps.push(`no_prevention_rules_for_${intent.category}`)
  }
  
  // Termos técnicos sem implementação
  for (const term of intent.technicalTerms) {
    if (!context.code.some(c => c.content.includes(term))) {
      gaps.push(`no_implementation_of_${term}`)
    }
  }
  
  // Clarity score baixo
  if (intent.clarityScore < 0.6) {
    gaps.push('low_clarity_score')
  }
  
  return gaps
}
```

---

## 💡 Human-in-the-Loop (HITL)

### 2 Pontos de Pausa

#### 1. **FASE 3: Questions** (One-by-one)

```typescript
// Apresenta 1 pergunta por vez
const nextQuestion = state.questions[state.answers.length]

return {
  type: 'wait_user',
  messageId: nextQuestion.id,
  question: nextQuestion
}

// Usuário responde → adiciona à state.answers → próxima pergunta
```

**Formato da pergunta**:

```json
{
  "id": "q1",
  "question": "Você quer autenticação JWT ou OAuth2?",
  "type": "technical",
  "context": "Encontrei JWT em auth.service.ts:45-67",
  "why": "Preciso saber qual padrão seguir para integrar corretamente",
  "options": ["JWT", "OAuth2"]
}
```

#### 2. **FASE 4: Design Options**

```typescript
// Apresenta 3 opções + aguarda escolha
yield* formatOptionsUI(state) // Renderiza opções com prós/contras

return {
  type: 'wait_user',
  messageId: `opt_${Date.now()}`,
  options: state.options
}

// Usuário escolhe → state.chosenOption → FASE 5
```

**Formato de opção**:

```typescript
{
  id: "opt1",
  name: "Autenticação JWT com Refresh Token",
  summary: "Implementa JWT stateless com refresh token em Redis",
  integration: "Integra com AuthMiddleware existente em auth.middleware.ts:23-89",
  modifications: [
    "src/auth/jwt.service.ts (novo)",
    "src/auth/auth.middleware.ts (modificar lines 45-67)"
  ],
  risks: [
    "Necessita Redis configurado",
    "Breaking change em rotas protegidas"
  ],
  effort: "4-6 horas",
  pros: [
    "Stateless, escalável",
    "Segurança com refresh token"
  ],
  cons: [
    "Complexidade adicional do Redis",
    "Migração de tokens existentes"
  ],
  codeExamples: [
    {
      file: "src/auth/session.service.ts",
      lines: "78-102",
      description: "Pattern de token validation similar"
    }
  ]
}
```

---

## 🎨 Formato da Especificação Final

Estrutura gerada na **FASE 5**:

```markdown
# Task: [Título derivado do objective]

## Context

### Relevant Files (from retrieval)
- `auth.service.ts:45-67`: JWT token generation logic
- `auth.middleware.ts:23-89`: Auth middleware que valida tokens

### Existing Patterns (from retrieval)
Pattern: Token Validation
- Used in: session.service.ts:78
- Example:
  ```typescript
  const decoded = jwt.verify(token, secret)
  ```

### Prevention Rules (from retrieval)
- [AUTH-001] Never store tokens in localStorage
- [AUTH-002] Always use HTTPS for token transmission
- [AUTH-003] Implement token refresh mechanism

## Objective
[Statement claro do que será alcançado, baseado na opção escolhida]

## Implementation Approach
[Detalhes completos da opção escolhida]

## Step-by-Step Execution

### Step 1: Create JWT Service
**Objective:** Implement JWT generation and validation

**Files to modify:**
- `src/auth/jwt.service.ts` (create new file)
- Based on pattern from: `src/auth/session.service.ts:78-102`

**Instructions:**
1. Create JwtService class with methods:
   - `generateToken(payload)` → string
   - `verifyToken(token)` → payload | null
   - `refreshToken(refreshToken)` → newToken
2. Follow pattern from session.service.ts lines 78-102
3. Use environment variable JWT_SECRET

**Pattern to follow:**
```typescript
// From session.service.ts:78-102
const decoded = jwt.verify(token, secret)
if (decoded.exp < Date.now()) throw new Error('expired')
```

**Prevention rules to apply:**
- [AUTH-001] Store refresh token in httpOnly cookie
- [AUTH-003] Generate refresh token with 7d expiry

**Validation:**
- [ ] Unit tests pass for generateToken()
- [ ] Unit tests pass for verifyToken()
- [ ] Invalid token throws correct error

**If errors occur:**
- `JsonWebTokenError`: Check JWT_SECRET is set
- `TokenExpiredError`: Implement refresh flow

**Estimated time:** 45min

[Repeat for each step...]

## Completion Checklist
- [ ] All steps completed
- [ ] Tests passing
- [ ] Prevention rules applied
- [ ] Move task to .cappy/history/YYYY-MM/
- [ ] Add completion summary
- [ ] Run workspace scanner
```

---

## 📈 Melhorias de UX

### Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Clareza** | Loop genérico | 5 fases explícitas com nomes |
| **Transparência** | Caixa preta | Mostra o que encontrou, explica porquê pergunta |
| **Controle** | Zero | Usuário escolhe opção de design |
| **Perguntas** | Batch confuso | One-by-one estruturado |
| **Contexto** | RAG superficial | RAG profundo + análise de gaps |
| **Especificação** | Genérica | Ultra-detalhada com file:line |

### Logs Estruturados

```
[Analyst] Session session_1730678400_abc123 started
[Analyst] Initial phase: intent
[Analyst] Phase: intent, Step: 1/15
[Analyst] Added phase prompt for intent
[Analyst] Phase transition: intent → context
[Analyst] Processing retrieval call...
[Analyst] Retrieved 5 results for code
[Analyst] Retrieved 3 results for prevention
[Analyst] Phase transition: context → questions
[Analyst] Gaps identified: no_implementation_of_OAuth2
[Analyst] Asking question 1/2
[Analyst] Received answer 1/2
[Analyst] Phase transition: questions → options (all answered)
[Analyst] Generated 3 design options
[Analyst] User chose option: JWT with Refresh Token
[Analyst] Phase transition: options → spec
[Analyst] Specification complete, persisting task...
```

---

## 🚀 Próximos Passos

### Pendente: Fase 8 - Testes

**Casos de teste necessários**:

1. **Fluxo completo sem perguntas** (clarity alto + contexto completo)
2. **Fluxo com 3 perguntas sequenciais** (gaps múltiplos)
3. **Fluxo com usuário cancelando escolha de opção**
4. **Erro no RAG** (cappy_retrieve_context falha)
5. **Parse de JSON inválido** em cada fase
6. **Limite de steps atingido** (MAX_AGENT_STEPS)
7. **Múltiplas sessões simultâneas** (stateMap)

### Melhorias Futuras

1. **Cache de retrieval**: evitar buscas duplicadas
2. **Priorização de perguntas**: scoring de importância
3. **Validação automática de specs**: linter nas specs geradas
4. **Feedback loop**: capturar se a spec funcionou
5. **Aprendizado**: ajustar prompts baseado em feedbacks

---

## 📚 Referências

- **Original request**: [descrição do usuário sobre problemas atuais]
- **Design pattern**: Phase-based workflow com state machine
- **RAG strategy**: Hybrid retrieval com multiple sources
- **HITL approach**: Two-point interaction (questions + options)

---

## ✅ Checklist de Implementação

- [x] Criar types.ts com interfaces
- [x] Implementar ANALYST_SYSTEM_PROMPT
- [x] Adicionar stateMap para gerenciar sessões
- [x] Implementar getPhasePrompt()
- [x] Implementar processPhase() com todas as transições
- [x] Implementar identifyGaps()
- [x] Implementar parseRetrievalResult()
- [x] Implementar formatOptionsUI()
- [x] Implementar executeTool()
- [x] Implementar buildMessages()
- [x] Refatorar loop principal do processMessage()
- [ ] Testes end-to-end de todas as fases

---

**Refatoração concluída em**: 3 de novembro de 2025  
**Autor**: GitHub Copilot + Eduardo Mendonça  
**Revisão**: Pendente
