# Multi-Agent Planning System

## 🎯 Arquitetura

Sistema de planejamento colaborativo com múltiplos agentes especializados que trabalham sobre um arquivo JSON compartilhado.

## 🤖 Agentes

### 1. Planning Agent
**Responsabilidade**: Criar plano inicial com base no contexto coletado

**Tools usadas**:
- `cappy_retrieve_context` - Buscar padrões similares
- `grep_search` - Encontrar código relacionado  
- `read_file` - Analisar implementações
- `list_dir` - Explorar estrutura

**Output**: `plan-{id}.json` com estrutura inicial

### 2. Critic Agent
**Responsabilidade**: Revisar plano e identificar gaps/ambiguidades

**Analisa**:
- ✅ Steps bem definidos?
- ✅ Contexto suficiente?
- ✅ Dependências claras?
- ✅ Validação mensurável?
- ❌ Informações faltantes?
- ❌ Ambiguidades?

**Output**: Lista de `CriticFeedback`

### 3. Clarification Agent  
**Responsabilidade**: Fazer UMA pergunta específica ao usuário

**Processo**:
1. Pega feedback mais crítico do Critic
2. Formula UMA pergunta clara
3. Aguarda resposta do usuário
4. Atualiza `plan-{id}.json` com a resposta
5. Volta para Critic revisar novamente

**Output**: `plan-{id}.json` atualizado + próxima pergunta

## 🔄 Fluxo Completo

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
┌─────────────────────────────────────────────────────────────┐
│ Usuário responde: "Em src/services/auth/"                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Clarification Agent:                                        │
│  Atualiza plan-abc123.json:                                 │
│  {                                                           │
│    "clarifications": [                                       │
│      {                                                       │
│        "id": "c1",                                           │
│        "question": "Onde criar JWT service?",                │
│        "answer": "Em src/services/auth/",                    │
│        "critical": true                                      │
│      }                                                       │
│    ],                                                        │
│    "steps": [                                                │
│      {                                                       │
│        "id": "2",                                            │
│        "title": "Create JWT service",                        │
│        "file": "src/services/auth/jwt-service.ts",  ← ATUALIZADO
│        ...                                                   │
│      }                                                       │
│    ]                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
                  Volta para Critic
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Critic Agent (2ª rodada):                                   │
│  Analisa plan-abc123.json novamente                         │
│                                                              │
│  Feedback:                                                   │
│  ✅ Step 2: Agora tem caminho definido                      │
│  ❌ Step 3: Ainda não define quais rotas proteger           │
│                                                              │
│  Nova clarification:                                         │
│  {                                                           │
│    "id": "c2",                                               │
│    "question": "Quais rotas proteger?"                       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Clarification Agent (2ª rodada):                            │
│  Pergunta ao usuário:                                        │
│  "Encontrei estas rotas em src/routes/:                     │
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
