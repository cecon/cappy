# 🔗 Integração LangChain + cappy_retrieve_context

## Visão Geral

O Cappy integra o **LangChain** (via VS Code Language Model API) com o **HybridRetriever** através da ferramenta `cappy_retrieve_context`. Isso permite que o GitHub Copilot acesse automaticamente:

- 📊 **Grafo de Código** (funções, classes, relacionamentos)
- 📚 **Documentação** (arquivos em `docs/`)
- 🛡️ **Regras de Prevenção** (categorizadas por domínio)
- ✅ **Tarefas** (ativas e completadas)

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         VS Code UI                          │
│                     (Chat Interface)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              LangGraphChatEngine                            │
│      (src/nivel2/infrastructure/agents/                     │
│       langgraph-chat-engine.ts)                             │
│                                                             │
│  • Gerencia conversação com GitHub Copilot                  │
│  • Detecta tool calls                                       │
│  • Executa ferramentas                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           VS Code Language Model API                        │
│              (vscode.lm.tools)                              │
│                                                             │
│  Ferramentas Registradas:                                   │
│  • cappy_create_file                                        │
│  • cappy_fetch_web                                          │
│  • cappy_retrieve_context ⭐                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            ContextRetrievalTool                             │
│      (src/domains/chat/tools/native/                        │
│       context-retrieval.ts)                                 │
│                                                             │
│  • Valida parâmetros                                        │
│  • Delega para HybridRetriever                              │
│  • Formata resultados para o LLM                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              HybridRetriever                                │
│      (src/nivel2/infrastructure/services/                   │
│       hybrid-retriever.ts)                                  │
│                                                             │
│  • Busca em múltiplas fontes                                │
│  • Combina resultados com scores                            │
│  • Aplica filtros e ranking                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐  ┌──────────┐  ┌──────────┐
    │  Graph  │  │   Docs   │  │  Rules   │
    │   DB    │  │  Folder  │  │  System  │
    └─────────┘  └──────────┘  └──────────┘
```

---

## Localização dos Arquivos

### 1. LangChain Engine
```
src/nivel2/infrastructure/agents/langgraph-chat-engine.ts
```

**Responsabilidades:**
- Gerencia conversação com GitHub Copilot
- Detecta quando o LLM quer chamar `cappy_retrieve_context`
- Executa a ferramenta e retorna resultados
- Mantém histórico de contexto

### 2. Registro de Ferramentas
```
src/nivel1/adapters/vscode/bootstrap/LanguageModelToolsBootstrap.ts
```

**Responsabilidades:**
- Registra todas as ferramentas LM no VS Code
- Inicializa `ContextRetrievalTool`
- Valida se as ferramentas foram registradas corretamente

### 3. Context Retrieval Tool
```
src/domains/chat/tools/native/context-retrieval.ts
```

**Responsabilidades:**
- Implementa interface `vscode.LanguageModelTool`
- Valida parâmetros de entrada
- Chama `HybridRetriever.retrieve()`
- Formata resultados em markdown para o LLM

### 4. Hybrid Retriever
```
src/nivel2/infrastructure/services/hybrid-retriever.ts
```

**Responsabilidades:**
- Busca em código (graph)
- Busca em documentação (files)
- Busca em regras de prevenção (categorized)
- Combina e rankeia resultados

### 5. Manifesto (package.json)
```
package.json > contributes > languageModelTools
```

**Define:**
- Metadata da ferramenta para o VS Code
- Schema de entrada (query, sources, filters)
- Descrição para o LLM entender quando usar

---

## Como o LLM Usa a Ferramenta

### System Prompt Atualizado

O `SYSTEM_PROMPT` em `langgraph-chat-engine.ts` agora instrui explicitamente o LLM sobre:

1. **Quando usar**: Antes de criar tasks, responder perguntas sobre código
2. **Como usar**: Exemplos de queries e parâmetros
3. **O que esperar**: Tipos de resultados (com line numbers!)

### Exemplo de Uso pelo LLM

**Usuário pergunta:**
> "Como implementar autenticação JWT neste projeto?"

**LLM pensa:**
1. Preciso entender o padrão atual do projeto
2. Vou usar `cappy_retrieve_context`

**LLM chama a ferramenta:**
```json
{
  "name": "cappy_retrieve_context",
  "input": {
    "query": "JWT authentication implementation",
    "sources": ["code", "prevention", "documentation"],
    "maxResults": 10,
    "minScore": 0.6
  }
}
```

**Retriever retorna:**
```markdown
## Code Results (2 results)

### 1. UserAuthService.authenticate (score: 0.85)
**File:** `src/services/auth/UserAuthService.ts` (lines 45-78)
**Type:** function
**Context:**
- Calls: `jwt.sign()`, `bcrypt.compare()`
- Referenced by: `LoginController`

**Code:**
\`\`\`typescript
async authenticate(email: string, password: string) {
  // ... implementation
}
\`\`\`

### 2. JWT_SECRET configuration (score: 0.78)
**File:** `src/config/auth.ts` (lines 12-15)
...

## Prevention Rules (1 result)

### Authentication Security (category: auth)
- Never store JWT secret in code, use environment variables
- Set short expiration times for tokens (15min access, 7d refresh)
- Always validate token signature and expiration
```

**LLM usa o contexto para responder:**
> "Baseado no código existente, veja como implementar JWT:
>
> 1. O projeto já tem `UserAuthService` (linhas 45-78 em `src/services/auth/UserAuthService.ts`)
> 2. Siga as regras de prevenção:
>    - Use variáveis de ambiente para JWT_SECRET
>    - Tokens de acesso: 15min
>    - Tokens de refresh: 7 dias
> 3. ..."

---

## Configuração e Inicialização

### 1. Bootstrap da Extensão

```typescript
// src/nivel1/adapters/vscode/bootstrap/ExtensionBootstrap.ts

export async function activate(context: vscode.ExtensionContext) {
  // 1. Registra ferramentas LM (incluindo cappy_retrieve_context)
  const lmToolsBootstrap = new LanguageModelToolsBootstrap();
  const contextTool = lmToolsBootstrap.register(context);
  
  // 2. Inicializa HybridRetriever
  const graphService = new GraphService(dbPath);
  const graphData = await graphService.loadGraph();
  const retriever = new HybridRetriever(graphData.data);
  
  // 3. Conecta retriever com a ferramenta
  contextTool.setRetriever(retriever);
  contextTool.setGraphService(graphService);
}
```

### 2. Late Initialization

A ferramenta `cappy_retrieve_context` suporta inicialização tardia:

```typescript
export class ContextRetrievalTool {
  private retriever: HybridRetriever | null = null;
  
  // Permite injetar o retriever depois
  setRetriever(retriever: HybridRetriever): void {
    this.retriever = retriever;
  }
  
  // Inicializa automaticamente se necessário
  async invoke(...) {
    if (!this.retriever) {
      await this.initialize();
    }
    // ...
  }
}
```

---

## Testando a Integração

### 1. Via Chat do Cappy

```
1. Abra o Cappy Chat (Ctrl/Cmd + Shift + P > "Cappy: Open Chat")
2. Pergunte algo sobre o código:
   > "Como funciona a autenticação neste projeto?"
3. Observe o LLM chamando cappy_retrieve_context automaticamente
```

### 2. Via GitHub Copilot Chat

```
1. Abra o GitHub Copilot Chat (@workspace)
2. Use: @workspace use cappy_retrieve_context para "authentication patterns"
3. O Copilot vai usar a ferramenta e mostrar os resultados
```

### 3. Via Script de Teste

```bash
# Testar a ferramenta diretamente
npm run test:retriever

# Ou via tsx
npx tsx test-retriever-tool.ts
```

### 4. Logs de Debug

Ative os logs no console do VS Code:

```typescript
// Veja em: Developer: Toggle Developer Tools > Console

[ContextRetrievalTool] ═══════════════════════════════════════════════
[ContextRetrievalTool] INVOKE CALLED
[ContextRetrievalTool] Query: "authentication patterns"
[ContextRetrievalTool] Options: { maxResults: 10, sources: ['code'] }
[ContextRetrievalTool] Retriever initialized: true
[HybridRetriever] Retrieving for query: "authentication patterns"
[HybridRetriever] Sources: code
[HybridRetriever] Total results: 5
```

---

## Parâmetros do cappy_retrieve_context

### Básico

```typescript
{
  query: string          // OBRIGATÓRIO: O que procurar
}
```

### Avançado

```typescript
{
  query: string,
  maxResults?: number,           // Padrão: 10
  minScore?: number,             // Padrão: 0.5 (0-1)
  sources?: string[],            // Padrão: ['code', 'documentation', 'prevention']
  category?: string,             // Filtro por categoria (auth, database, api, etc.)
  includeRelated?: boolean       // Padrão: true (inclui contexto relacionado)
}
```

### Exemplos de Queries

```typescript
// 1. Buscar implementação específica
{
  query: "UserService.createUser method",
  sources: ["code"],
  maxResults: 5
}

// 2. Entender padrão de arquitetura
{
  query: "hexagonal architecture ports and adapters",
  sources: ["documentation"],
  includeRelated: true
}

// 3. Verificar regras antes de implementar
{
  query: "database connection pooling",
  sources: ["prevention", "documentation"],
  category: "database"
}

// 4. Ver tasks similares completadas
{
  query: "user authentication feature",
  sources: ["task"],
  maxResults: 3
}

// 5. Busca ampla multi-fonte
{
  query: "error handling strategy",
  sources: ["code", "documentation", "prevention"],
  maxResults: 15,
  minScore: 0.6
}
```

---

## Melhorando o System Prompt

O prompt do LangChain foi atualizado para enfatizar o uso do retriever:

### Antes ❌
```
Use the context retrieval tool (cappy_retrieve_context) to understand 
the codebase before asking questions
```

### Depois ✅
```
<CONTEXT_RETRIEVAL_TOOL>
You have access to cappy_retrieve_context, a powerful hybrid retrieval 
system that searches across:

**Sources:**
1. **code**: Functions, classes, variables from knowledge graph (with line numbers!)
2. **documentation**: Project docs, guides, architecture in docs/ folder
3. **prevention**: Categorized rules for avoiding errors
4. **task**: Active and completed tasks

**How to Use:**
[Exemplos detalhados de uso]

**Best Practices:**
* ALWAYS call cappy_retrieve_context BEFORE creating tasks
* Use multiple searches with different queries
* Request line numbers are automatically included
* Search prevention rules for the category
* Check completed tasks for similar implementations
</CONTEXT_RETRIEVAL_TOOL>
```

---

## Formato de Retorno

O retriever formata os resultados em Markdown otimizado para LLMs:

```markdown
# Context Retrieval Results

Query: "authentication patterns"
Sources: code, documentation
Total Results: 5

---

## Code Results (3 results)

### 1. UserAuthService.authenticate (score: 0.85)
**File:** `src/services/auth/UserAuthService.ts` (lines 45-78)
**Type:** function
**Description:** Authenticates user with email and password

**Dependencies:**
- Imports: jwt, bcrypt
- Calls: validatePassword, generateTokens

**Code Preview:**
\`\`\`typescript
async authenticate(email: string, password: string): Promise<AuthResult> {
  const user = await this.userRepo.findByEmail(email);
  if (!user) throw new AuthError('Invalid credentials');
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new AuthError('Invalid credentials');
  
  return this.generateTokens(user);
}
\`\`\`

### 2. JWT_SECRET configuration (score: 0.78)
...

---

## Documentation Results (1 result)

### Authentication Guide (score: 0.72)
**File:** `docs/guides/AUTHENTICATION.md`
**Summary:** Complete guide for implementing JWT authentication with refresh tokens
...

---

## Prevention Rules (1 result)

### Authentication Security Rules (category: auth)
**Score:** 0.80

**Rules:**
1. Never store JWT secret in code, use environment variables
2. Set short expiration times (15min access, 7d refresh)
3. Always validate token signature and expiration
4. Implement token refresh mechanism
5. Use secure random strings for secrets (min 256 bits)
...
```

---

## Troubleshooting

### Ferramenta não aparece para o LLM

1. **Verificar registro:**
```typescript
// Console do VS Code
const allTools = vscode.lm.tools;
const cappyTools = allTools.filter(t => t.name.startsWith('cappy_'));
console.log('Cappy tools:', cappyTools.map(t => t.name));
```

2. **Resultado esperado:**
```
Cappy tools: ['cappy_create_file', 'cappy_fetch_web', 'cappy_retrieve_context']
```

### Retriever retorna vazio

1. **Verificar database:**
```bash
# Verifica se o database existe
ls -la .cappy/graph.db

# Verifica se tem dados
sqlite3 .cappy/graph.db "SELECT COUNT(*) FROM nodes;"
```

2. **Reindexar:**
```
Ctrl/Cmd + Shift + P > "Cappy: Scan Workspace"
```

### LLM não usa a ferramenta

1. **Verificar system prompt** - Deve mencionar explicitamente quando usar
2. **Ajustar modelo** - Alguns modelos precisam de instruções mais diretas
3. **Testar manualmente** - Use `@workspace use cappy_retrieve_context`

---

## Próximos Passos

### Melhorias Planejadas

1. **Cache de resultados** - Evitar buscas duplicadas na mesma sessão
2. **Ranking adaptativo** - Aprender com feedback do usuário
3. **Contexto incremental** - Expandir busca automaticamente se poucos resultados
4. **Preview de código** - Mostrar snippets maiores quando relevante
5. **Sugestões de busca** - Sugerir queries relacionadas

### Extensões Possíveis

1. **Integração com outros LLMs** - Suporte para Anthropic, OpenAI direto
2. **Tool calling avançado** - Chamadas em paralelo, composição de ferramentas
3. **Agentes especializados** - Agentes para diferentes tipos de tarefa
4. **Memória de longo prazo** - Lembrar contexto entre sessões

---

## Recursos

- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [Hybrid Retriever README](./HYBRID_RETRIEVER_README.md)
- [Context Enrichment Guide](./features/CONTEXT_ENRICHMENT.md)

