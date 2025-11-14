# 🧠 Cappy Planning Agent

## Visão Geral

O **Planning Agent** é um agente de IA especializado em **criar planos de desenvolvimento detalhados** através de análise de contexto e perguntas de clarificação. 

**Ele NÃO gera código** - seu valor está em:
- 📊 Análise profunda do workspace
- 🔍 Coleta de contexto relevante
- ❓ Perguntas de clarificação inteligentes
- 📝 Criação de planos passo a passo

---

## 🎯 Propósito

### O que o agente FAZ:
✅ Faz perguntas para entender o requisito  
✅ Usa tools para analisar o código existente  
✅ Busca padrões e implementações similares  
✅ Cria planos detalhados com referências reais  
✅ Identifica riscos e edge cases  
✅ Sugere critérios de validação  

### O que o agente NÃO FAZ:
❌ Não gera código  
❌ Não edita arquivos  
❌ Não executa comandos  
❌ Não cria/deleta arquivos  

---

## 🛠️ Tools Disponíveis

O agente tem acesso **apenas** a ferramentas de análise:

### Tools do Cappy:
- `cappy_retrieve_context` - Busca contexto semântico (código, docs, regras)
- `cappy_fetch_web` - Busca informações externas (opcional)

### Tools do Copilot (read-only):
- `read_file` - Lê arquivos específicos
- `grep_search` - Busca padrões no código
- `list_dir` - Explora estrutura de pastas
- `semantic_search` - Busca semântica no workspace
- `file_search` - Busca arquivos por padrão

### Tools BLOQUEADAS:
- ❌ `create_file` - Bloqueada
- ❌ `replace_string_in_file` - Bloqueada
- ❌ `run_in_terminal` - Bloqueada
- ❌ `run_task` - Bloqueada

---

## 🔄 Fluxo de Conversa

```
┌─────────────────────────────────────┐
│ 1. Usuário: "Preciso implementar X" │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 2. Agente: Perguntas de clarificação│
│    - Qual o objetivo?                │
│    - Quais arquivos envolvidos?      │
│    - Há restrições?                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 3. Usuário: Responde perguntas       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 4. Agente: Coleta de contexto        │
│    [Tool] cappy_retrieve_context     │
│    [Tool] read_file                  │
│    [Tool] grep_search                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 5. Agente: Cria plano estruturado    │
│    - Objetivo                        │
│    - Contexto analisado              │
│    - Steps detalhados                │
│    - Riscos                          │
│    - Critérios de sucesso            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 6. Usuário: Feedback/refinamento     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 7. Agente: Ajusta plano              │
└─────────────────────────────────────┘
```

---

## 💬 Exemplos de Uso

### Exemplo 1: Feature Nova

**Usuário:**
```
Preciso adicionar autenticação JWT no projeto
```

**Agente:**
```
Vou te ajudar a criar um plano para implementar JWT. Primeiro, preciso entender melhor:

1. Já existe algum sistema de autenticação no projeto?
2. Qual biblioteca de JWT você prefere? (jsonwebtoken, jose, etc)
3. Onde devem ser armazenados os tokens? (localStorage, cookies, memory)
4. Precisa de refresh tokens?
5. Quais rotas precisam ser protegidas?

Enquanto isso, vou analisar o projeto...

[Tool: cappy_retrieve_context] Buscando padrões de autenticação...
[Tool: grep_search] Procurando por 'auth', 'login', 'user'...
[Tool: read_file] Lendo package.json para ver dependências...
```

**Após respostas e análise:**
```markdown
## 📋 Development Plan: Implementação de JWT Authentication

### 🎯 Goal
Implementar sistema de autenticação JWT com refresh tokens, protegendo rotas específicas da API.

### 📦 Context Gathered
- Files analyzed:
  - `src/server.ts` (Express server setup)
  - `src/routes/user.ts` (rotas de usuário existentes)
  - `package.json` (dependências atuais)
- Patterns found:
  - Express middleware pattern já em uso
  - Validação com Zod já configurada
  - MongoDB como database
- Dependencies:
  - Express 4.18.2 já instalado
  - Bcrypt já disponível para passwords

### 📝 Step-by-Step Plan

1. **Instalar dependências** (`package.json`)
   - Adicionar `jsonwebtoken`, `@types/jsonwebtoken`
   - Adicionar `cookie-parser`
   - **Por quê**: Bibliotecas necessárias para JWT
   - **Validação**: `npm list jsonwebtoken` deve retornar a versão instalada

2. **Criar serviço de JWT** (`src/services/jwt-service.ts`)
   - Funções: `generateAccessToken()`, `generateRefreshToken()`, `verifyToken()`
   - Usar secrets do `.env`
   - **Por quê**: Centralizar lógica de JWT
   - **Validação**: Testes unitários para cada função

3. **Criar middleware de autenticação** (`src/middleware/auth.ts`)
   - Verificar token no header `Authorization: Bearer <token>`
   - Anexar `req.user` com dados decodificados
   - **Por quê**: Reutilizar lógica em múltiplas rotas
   - **Validação**: Teste com token válido/inválido/expirado

4. **Criar rotas de auth** (`src/routes/auth.ts`)
   - POST `/auth/login` - gera tokens
   - POST `/auth/refresh` - renova access token
   - POST `/auth/logout` - invalida refresh token
   - **Por quê**: Endpoints para gerenciar autenticação
   - **Validação**: Testes de integração para cada endpoint

5. **Proteger rotas existentes** (`src/routes/user.ts`, etc)
   - Aplicar middleware `authenticate` nas rotas privadas
   - **Por quê**: Garantir acesso apenas autenticado
   - **Validação**: Requisição sem token deve retornar 401

6. **Criar store de refresh tokens** (`src/models/refresh-token.ts`)
   - Schema MongoDB para armazenar tokens
   - TTL index para expiração automática
   - **Por quê**: Invalidar tokens em logout/comprometimento
   - **Validação**: Token revogado não deve permitir refresh

### ⚠️ Risks & Considerations

- **Segurança dos secrets**: Garantir que JWT_SECRET nunca seja commitado
- **Token expiration**: Access token curto (15min), refresh longo (7 dias)
- **Rate limiting**: Considerar adicionar rate limit em `/auth/login`
- **HTTPS**: Em produção, SEMPRE usar HTTPS para transmitir tokens
- **XSS**: Se usar localStorage, tokens podem ser roubados via XSS

### ✅ Success Criteria

- ✅ Usuário consegue fazer login e receber tokens
- ✅ Rotas protegidas retornam 401 sem token válido
- ✅ Refresh token funciona corretamente
- ✅ Logout invalida tokens
- ✅ Tokens expirados não são aceitos
- ✅ Cobertura de testes > 80%

---

**Próximos passos**: Confirme se este plano atende suas necessidades ou se precisa de ajustes!
```

---

## 🏗️ Arquitetura

### Componentes:

```typescript
LangGraphPlanningAgent
  ├── MemorySaver (persistência de histórico por sessão)
  ├── LangGraph StateGraph (gerenciamento de estado)
  ├── GPT-4o Model (Copilot)
  └── Tool Execution Loop
      ├── Detecta tool calls
      ├── Executa tools (apenas read-only)
      └── Envia resultados de volta ao modelo
```

### Tool Filtering:

```typescript
const planningTools = allTools.filter(tool => {
  // ✅ Include context/analysis tools
  if (tool.name.startsWith('cappy_')) return true
  if (['read_file', 'grep_search', 'list_dir', 'semantic_search'].includes(tool.name)) {
    return true
  }
  
  // ❌ Exclude code generation/editing
  if (['create_file', 'replace_string_in_file', 'run_in_terminal'].includes(tool.name)) {
    return false
  }
  
  return false
})
```

---

## 🔧 Configuração

### System Prompt

O agente usa um **system prompt detalhado** que define:
- Papel (planejador, não codificador)
- Workflow (perguntar → coletar → planejar → refinar)
- Formato de saída estruturado
- Proatividade no uso de tools

### Limites

- **Max iterations**: 10 (previne loops infinitos)
- **Tools**: Apenas análise/leitura
- **Persistência**: Por sessão (via `thread_id`)

---

## 📊 Logs e Debugging

### Logs principais:

```
[PlanningAgent] Planning Agent initialized with model: copilot/gpt-4o
[PlanningAgent] Planning tools available: 8
[PlanningAgent] Tools: cappy_retrieve_context, read_file, grep_search, ...
[PlanningAgent] Planning iteration 1
[PlanningAgent] Tool call detected: cappy_retrieve_context
[PlanningAgent] Executing tool: cappy_retrieve_context
[PlanningAgent] Tool result (1234 chars): ...
[PlanningAgent] Gathering context: 2 tool call(s)
[PlanningAgent] No more context needed, plan complete
```

---

## 🚀 Como Usar

### No Chat do VS Code:

```
@cappy Preciso implementar cache no sistema
```

O agente vai:
1. ✅ Fazer perguntas de clarificação
2. ✅ Analisar código existente automaticamente
3. ✅ Criar plano estruturado
4. ✅ Iterar baseado em feedback

---

## 🎓 Boas Práticas

### Para o Usuário:

1. **Seja específico**: "Adicionar cache Redis" > "Melhorar performance"
2. **Responda perguntas**: O agente precisa de contexto para planejar bem
3. **Revise o plano**: Peça ajustes se algo não fizer sentido
4. **Aproveite as referências**: O agente cita arquivos/linhas reais

### Para o Agente (prompt engineering):

1. **Sempre use tools**: Não assuma, verifique com tools
2. **Pergunte antes de planejar**: Contexto > Suposições
3. **Seja específico**: Cite arquivos, linhas, funções reais
4. **Pense em riscos**: Todo plano tem trade-offs

---

## 🔮 Evolução Futura

### Possíveis melhorias:

- [ ] Integração com sistema de tasks do Cappy
- [ ] Exportar plano como `.md` ou task XML
- [ ] Estimativas de tempo/complexidade
- [ ] Sugestões de breaking changes
- [ ] Análise de impacto em dependentes
- [ ] Validação automática de plano (checklist)

---

## 📚 Referências

- `src/nivel2/infrastructure/agents/langgraph/planning-agent.ts` - Implementação
- `src/nivel1/adapters/vscode/bootstrap/ExtensionBootstrap.ts` - Integração
- `docs/LANGCHAIN_CONTEXT_INTEGRATION.md` - Contexto LangChain
