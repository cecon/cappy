# Análise Comparativa: Cappy vs Concorrentes

> Revisão técnica honesta — Abril 2026  
> Codebase analisado: `extension/src/` (~11.2K LOC) + `webview/` (~6.3K LOC)

---

## 1. Tabela Comparativa

### RAG & Indexação

| Feature | Cappy | Kilo Code | Continue.dev | Copilot Chat | Cline |
|---|---|---|---|---|---|
| Vector embeddings | ✅ OpenRouter | ✅ OpenAI / Gemini / Ollama | ✅ 10+ providers | ✅ Proprietário | ❌ |
| Vector store | ✅ In-memory + JSON | ✅ Qdrant (externo) | ✅ LanceDB (binário) | ✅ Proprietário | ❌ |
| Chunking AST | ✅ Via VS Code LSP | ✅ Tree-sitter (binário) | ✅ Tree-sitter (binário) | ⚠️ Desconhecido | ❌ |
| Chunking fallback (regex) | ✅ RegexChunker | ⚠️ Parcial | ⚠️ Parcial | ⚠️ Desconhecido | ❌ |
| Indexação incremental (SHA-256) | ✅ Por arquivo | ⚠️ Por branch | ⚠️ Por mudança | ⚠️ Desconhecido | ❌ |
| Git-diff exato (O(diff) não O(workspace)) | ✅ | ⚠️ Branch-level only | ❌ | ❌ | ❌ |
| Grafo de dependências (imports/extends) | ✅ 1-hop expansion | ❌ | ❌ | ❌ | ❌ |
| Busca full-text paralela (BM25/SQLite) | ❌ | ⚠️ ripgrep fallback | ✅ SQLite FTS5 | ⚠️ Desconhecido | ❌ |
| Embeddings locais / offline | ❌ | ✅ Ollama | ✅ Transformers.js | ❌ | ❌ |
| Dependências binárias externas | ✅ Zero | ❌ Qdrant + Tree-sitter | ❌ LanceDB + Tree-sitter | N/A | ✅ Zero |

### Arquitetura & Integração

| Feature | Cappy | Kilo Code | Continue.dev | Copilot Chat | Cline |
|---|---|---|---|---|---|
| Multi-LLM provider | ✅ Via OpenRouter | ✅ Nativo | ✅ Nativo | ❌ GitHub/Azure only | ✅ Nativo |
| MCP (SSE + stdio) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-agent / Orchestrador | ⚠️ ExploreSubagent serial | ✅ Orchestrator paralelo | ❌ | ❌ | ❌ |
| IDE: VS Code | ✅ | ✅ | ✅ | ✅ | ✅ |
| IDE: JetBrains / outros | ❌ | ❌ | ✅ | ✅ (Neovim, etc.) | ❌ |
| Inline autocomplete | ❌ | ✅ | ✅ | ✅ (best-in-class) | ❌ |
| Arquitetura hexagonal (domain/ports) | ✅ | ❌ | ❌ | N/A | ❌ |
| Open source | ✅ | ✅ | ✅ | ❌ | ✅ |

### UX & Controles do Agente

| Feature | Cappy | Kilo Code | Continue.dev | Copilot Chat | Cline |
|---|---|---|---|---|---|
| Modos de chat (plain/ask/agent) | ✅ 3 modos | ⚠️ 2 modos | ⚠️ 2 modos | ❌ 1 modo | ⚠️ 2 modos |
| Plan mode (bloqueia tools destrutivas) | ✅ | ⚠️ Parcial | ✅ | ❌ | ✅ Plan/Act |
| HITL granular (deny/session/persist) | ✅ 3 níveis | ✅ | ⚠️ Básico | ⚠️ Mínimo | ✅ |
| Skills / custom instructions workspace | ✅ `.cappy/skills/` | ✅ + marketplace | ❌ | ✅ `.github/skills/` | ❌ |
| Skills marketplace comunitário | ❌ | ✅ | ❌ | ⚠️ GitHub Marketplace | ❌ |
| @-mention de arquivos/símbolos | ❌ | ✅ | ✅ | ✅ | ⚠️ Parcial |
| Context budgeting visual em tempo real | ✅ Ring indicator | ⚠️ | ⚠️ | ❌ | ✅ |
| Auto-compactação de histórico | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| Tool argument recovery via LLM | ✅ | ❌ | ❌ | ❌ | ❌ |
| Shell output em tempo real na UI | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| Diff visual de edições na UI | ✅ | ✅ | ⚠️ | ✅ | ✅ |

### Ferramentas Built-in

| Feature | Cappy | Kilo Code | Continue.dev | Copilot Chat | Cline |
|---|---|---|---|---|---|
| Read / Write / Edit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bash / Terminal | ✅ | ✅ | ✅ | ⚠️ Limitado | ✅ |
| Glob / Grep / searchCode | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| WebFetch / WebSearch | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| ragSearch (semântico) | ✅ | ✅ | ✅ | ✅ | ❌ |
| ExploreAgent (subagente read-only) | ✅ | ✅ | ❌ | ❌ | ❌ |
| TodoWrite (checklist de sessão) | ✅ | ❌ | ❌ | ❌ | ❌ |
| ListSkills / ReadSkill / CreateSkill | ✅ | ⚠️ | ❌ | ⚠️ | ❌ |
| Total de tools built-in | **22** | ~18 | ~15 | ~12 | ~16 |

---

## 2. Vantagens do Cappy

### 2.1 Zero dependências binárias externas — diferencial arquitetural real

Cappy é o **único assistente com RAG funcional que não requer Qdrant, LanceDB, Tree-sitter ou qualquer binário nativo**. A indexação AST usa `vscode.executeDocumentSymbolProvider` — ou seja, aproveita o Language Server que já está instalado para a linguagem do projeto. Isso significa:

- Funciona em qualquer linguagem com Language Server (TypeScript, Python, Rust, Go, C#, Java…) sem configuração adicional
- Zero problemas de compatibilidade de binários entre plataformas (arm64 vs x86, Windows vs Linux)
- Sem processo de daemon externo (Qdrant requer Docker ou servidor dedicado)
- Instalação da extensão: simples, sem pós-instalação

Kilo Code e Continue.dev precisam compilar ou baixar binários Tree-sitter por plataforma e manter Qdrant/LanceDB rodando. Em ambientes corporativos com restrições de rede ou CI/CD, isso é bloqueador real.

### 2.2 Git-diff exato: O(diff) não O(workspace)

A re-indexação após `git checkout`, `merge` ou `pull` no Cappy é cirúrgica:

```
1. Lê .git/HEAD → resolve SHA via packed-refs
2. git diff --name-only <oldSHA> HEAD
3. Re-embeds APENAS os arquivos retornados
```

Kilo Code re-indexa ao trocar de branch (re-processa toda a branch). Continue.dev não tem lógica git-aware equivalente documentada. Em workspaces grandes (>10K arquivos), a diferença entre O(diff) e O(workspace) é de segundos vs minutos.

### 2.3 Expansão 1-hop no grafo de dependências

Após o top-K por cosine similarity, o `ragSearchTool` expande automaticamente com chunks dos arquivos que importam ou são importados pelos resultados. O grafo é construído por regex sobre `import/require/extends/implements` — zero custo de LSP, funciona em qualquer arquivo já indexado.

Nenhum concorrente tem essa expansão automática implementada. O efeito prático: quando você busca por uma função utilitária, os arquivos que a usam também aparecem no contexto, sem precisar de query manual.

### 2.4 Tool argument recovery via LLM

Quando o modelo retorna JSON malformado num tool call (fechamento de chave ausente, trailing comma, etc.), o `RecoverToolArgsUseCase` faz uma segunda chamada LLM para corrigir os argumentos antes de falhar. Nenhum outro assistente documentou este mecanismo. Reduz falhas silenciosas em modelos menores/mais baratos via OpenRouter.

### 2.5 HITL com 3 níveis de persistência e classificação automática de MCP

A política de HITL vai além do simples "confirmar ou não":

- **deny**: rejeita esta invocação
- **approve-session**: aprova para toda a `AgentLoop` atual (sem regravar)
- **approve-persist**: salva `allow_all` em `.cappy/agent-preferences.json` (workspace-level)

MCP tools são classificadas automaticamente como destrutivas por heurística de palavras-chave (`write`, `delete`, `execute`, `deploy`, `migrate`, etc.), não precisam de anotação manual.

### 2.6 Modos de chat com leitura pura (ask mode)

O `ask` mode tem ferramentas estritamente read-only (Read, Glob, Grep, ragSearch, WebSearch, ExploreAgent) sem nenhuma tool destrutiva disponível — nem sequer no catálogo. Isso é útil para onboarding de código de terceiros, code review e exploração segura. Continue.dev e Copilot não têm equivalente formal.

### 2.7 Arquitetura hexagonal com cobertura de testes no domínio

O design domain/ports/adapters permite:
- Trocar `OpenRouterAdapter` por outro provider sem tocar na lógica do agente
- Testar o domínio sem VS Code API (mocks de ports)
- Testes unitários existentes cobrem: context budgeting, token trimming, HITL policy, tool arg recovery, chat mode filtering

Nenhum concorrente open-source tem arquitetura equivalente documentada.

### 2.8 Context budgeting visual com detalhamento de compactação

O ring indicator em tempo real mostra `usedTokens / limitTokens`, indica quando houve `trimming` e quantas mensagens foram descartadas. O payload `ContextUsagePayload` inclui `effectiveInputBudgetTokens`, `didTrimForApi`, `droppedMessageCount`. Cline tem algo similar, mas sem o detalhe de budget efetivo vs janela declarada.

---

## 3. Gaps do Cappy

Ordenados por impacto para o usuário final.

### 3.1 🔴 Sem inline autocomplete — o maior gap competitivo

**Impacto: CRÍTICO**

Continue.dev, Kilo Code e GitHub Copilot oferecem sugestões inline ao digitar (ghost text, tab-complete). Este é o caso de uso mais frequente de AI coding — acontece dezenas de vezes por hora durante codificação ativa. O chat é um fluxo secundário; o autocomplete é o fluxo primário.

Cappy é exclusivamente chat/agent. Um usuário que vai do Continue.dev para o Cappy sente a ausência imediatamente. Nota: implementar autocomplete é um paradigma arquitetural diferente (`InlineCompletionItemProvider` do VS Code), não uma extensão do chat existente.

### 3.2 🔴 Embeddings locais / offline inexistentes

**Impacto: ALTO**

Toda indexação RAG passa pela API do OpenRouter (`text-embedding-3-small`). Consequências:

- Custo contínuo de API proporcional ao tamanho do workspace (cada arquivo indexado = chamada de embedding)
- Latência de rede em cada re-indexação
- Dados de código enviados a servidor externo — bloqueador em ambientes com dados sensíveis ou regulatórios
- Sem funcionalidade RAG offline ou em air-gapped environments

Continue.dev tem `Transformers.js` que roda localmente no Node.js sem GPU. Kilo Code tem suporte a Ollama. A interface `EmbeddingService.ts` já está abstraída no Cappy — adicionar Ollama seria de baixo esforço.

### 3.3 🟠 Busca full-text paralela ausente

**Impacto: ALTO**

A busca vetorial é eficaz para queries semânticas ("encontrar funções que calculam desconto"), mas falha em:
- Identificadores exatos: `calculateDiscount`, `DISCOUNT_RATE`, nomes de variáveis específicos
- Strings literais, mensagens de erro, valores de configuração
- Queries curtas de 1-2 tokens onde cosine similarity é instável

Continue.dev executa FTS (SQLite FTS5) em paralelo com vector search e faz merge dos resultados (RRF — Reciprocal Rank Fusion). O Cappy tem `grepTool` separado, mas ele não é integrado ao pipeline de RAG — o agente precisa decidir explicitamente quando usá-lo vs `ragSearch`.

### 3.4 🟠 Sem @-mention de contexto manual

**Impacto: ALTO**

Continue.dev, Kilo Code e Copilot permitem `@file`, `@symbol`, `@git`, `@docs` diretamente no input do chat para injetar contexto preciso sem depender do RAG. Isso dá ao usuário controle granular sobre o que o modelo vê — essencial quando o RAG não indexou algo ou quando se quer comparar dois arquivos específicos.

No Cappy, o usuário precisa dizer "leia o arquivo X" e o agente usa a tool `Read`. Funciona, mas é menos ergonômico e consome tokens em tool calls extras.

### 3.5 🟠 Multi-agent sem paralelismo

**Impacto: MÉDIO-ALTO**

O `ExploreSubagent` é funcional mas limitado:
- Read-only (não pode escrever ou executar)
- Serial — o agente pai espera o subagente terminar antes de continuar
- Máximo 32 rounds internos

Kilo Code tem modo Orchestrator que dispara múltiplos agentes especializados em paralelo (ex: coder + reviewer + test-writer coordenados). Para refatorações grandes ou geração de código com revisão automática, isso é significativo.

O config do Cappy tem `activeAgent: "coder" | "planner" | "reviewer"` mas **nenhuma lógica de switching está implementada** — é esqueleto aspiracional.

### 3.6 🟡 Skills sem marketplace

**Impacto: MÉDIO**

Skills workspace são úteis mas requerem criação manual. Kilo Code tem marketplace comunitário — usuários compartilham skills para frameworks comuns (Next.js, FastAPI, etc.), reduzindo o tempo de setup em novos projetos.

Sem um hub centralizado, cada usuário do Cappy recria skills equivalentes de forma isolada.

### 3.7 🟡 Execução de tools serial (sem paralelismo)

**Impacto: MÉDIO**

O loop de execução do Cappy processa tool calls sequencialmente. Em tasks que envolvem múltiplos `Read` ou `Grep` independentes (ex: ler 5 arquivos relacionados), cada tool call espera o anterior terminar.

Claude 4, GPT-4o e outros modelos retornam múltiplas tool calls num único response. O Cappy executa uma por vez. Kilo Code e alguns outros frameworks executam tool calls independentes em paralelo.

### 3.8 🟡 Single-IDE, sem JetBrains

**Impacto: MÉDIO**

VS Code-only bloqueia adoção em times Java (IntelliJ), Kotlin/Android (Android Studio), PHP (PhpStorm), .NET (Rider). Continue.dev e Copilot cobrem este mercado. Para Cappy, o VS Code API usage é profundo o suficiente que um port para JetBrains seria reescrita significativa.

### 3.9 🟢 Multi-provider via intermediário (OpenRouter)

**Impacto: BAIXO-MÉDIO**

Passar tudo via OpenRouter é elegante (um adapter, todos os modelos), mas:
- Extended thinking do Claude (beta features) pode não estar disponível via OpenRouter em tempo real
- Grounding do Gemini, tools nativas do GPT-4o Realtime — features model-específicas ficam atrás do timing de suporte do OpenRouter
- Latência extra do proxy em cada request
- Single point of failure / dependency no serviço OpenRouter

Kilo Code, Continue.dev e Cline conectam diretamente nos providers.

---

## 4. Próximas Features: Top 5 por ROI

ROI = Impacto para o usuário / Esforço de implementação

---

### #1 — Embeddings locais via Ollama

**Impacto: Alto | Esforço: Baixo | ROI: ★★★★★**

**Por que é o #1:** A interface `EmbeddingService.ts` já está abstraída. Adicionar Ollama é implementar um segundo adapter de embedding — sem mudança no `RagIndexer`, `VectorStore` ou nas tools. O ganho é imediato: zero custo de API na indexação, privacidade de código garantida, funcionalidade offline.

**Implementação técnica:**
```typescript
// EmbeddingService.ts — adicionar provider condicional
if (config.embeddingProvider === 'ollama') {
  // POST http://localhost:11434/api/embeddings
  // body: { model: config.ollamaModel, prompt: text }
  // response: { embedding: number[] }
}
```

Não requer dependências externas — Ollama expõe HTTP puro. Dimensão configurável (nomic-embed-text usa 768D, mxbai-embed-large usa 1024D). O `VectorStore` já suporta dimensão dinâmica.

**Estimativa:** 2-3 dias de implementação + testes.

---

### #2 — Hybrid Search: BM25 + Vector (RRF merge)

**Impacto: Alto | Esforço: Médio | ROI: ★★★★☆**

**Por que é o #2:** Resolve o gap mais frequente e invisível do RAG puro — quando o usuário busca por um identificador exato e o vector search retorna resultados semanticamente próximos mas não o arquivo correto. Isso degrada a confiança do usuário no RAG sem que ele saiba o motivo.

**Implementação técnica:**

SQLite com FTS5 já está disponível via `better-sqlite3` (pacote leve, sem binários exóticos):

```typescript
// RagIndexer.ts — ao indexar, também insere no FTS
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(
  path, chunk_text, chunk_id
)`);

// ragSearchTool.ts — executa FTS + vector em paralelo, merge com RRF
const [vectorResults, ftsResults] = await Promise.all([
  vectorStore.search(queryEmbedding, topK),
  ftsIndex.search(queryText, topK)
]);
return reciprocalRankFusion(vectorResults, ftsResults);
```

RRF score: `1 / (k + rank_vector) + 1 / (k + rank_fts)` onde `k=60` é o padrão da literatura.

**Estimativa:** 5-7 dias incluindo testes e migração do índice existente.

---

### #3 — @-mention de contexto no input

**Impacto: Alto | Esforço: Médio | ROI: ★★★★☆**

**Por que é o #3:** Dá ao usuário controle explícito sobre o contexto sem depender do RAG e sem consumir tokens em tool calls intermediárias. É a feature mais visível de UX em todos os assistentes de coding modernos.

**Implementação técnica:**

No lado da webview (chat input):
- Detectar `@` no input → abrir autocomplete com arquivos/símbolos do workspace
- Resolver `@path/to/file.ts` → injetar conteúdo como user message attachment antes do envio

No lado da extension:
- `@file` → `Read` automático, conteúdo injetado como `<file>` tag no prompt
- `@symbol:functionName` → `ragSearch` por símbolo + `Read` do arquivo encontrado
- `@git:diff` → `git diff HEAD` injetado como contexto

Não requer mudança no agent loop — o contexto é pré-injetado na mensagem do usuário.

**Estimativa:** 7-10 dias (UI de autocomplete é a parte mais trabalhosa).

---

### #4 — Execução paralela de tool calls independentes

**Impacto: Médio | Esforço: Médio | ROI: ★★★☆☆**

**Por que é o #4:** Quando o modelo retorna múltiplas tool calls num único response (comportamento padrão em Claude 3.5+, GPT-4o), o Cappy executa sequencialmente. Para tasks comuns como "leia esses 5 arquivos e compare", isso multiplica o tempo de espera pelo número de arquivos.

**Implementação técnica:**

No `loop.ts`, ao processar `toolCalls` do response:

```typescript
// Atual (serial)
for (const call of toolCalls) {
  result = await executeTool(call);
}

// Proposto (paralelo para tools read-only, serial para destrutivas)
const [readOnly, destructive] = partition(toolCalls, isReadOnlyTool);
const readResults = await Promise.all(readOnly.map(executeTool));
// destrutivas continuam seriais (HITL precisa de sequência)
for (const call of destructive) {
  result = await executeTool(call); // confirma uma por vez
}
```

Tools read-only (Read, Grep, Glob, ragSearch, WebFetch) são seguras para paralelizar. Tools destrutivas (Write, Edit, Bash) permanecem seriais por necessidade do HITL.

**Estimativa:** 4-6 dias incluindo testes de concorrência.

---

### #5 — Re-ranking com cross-encoder leve

**Impacto: Médio | Esforço: Baixo | ROI: ★★★☆☆**

**Por que é o #5:** O pipeline atual retorna top-K por cosine similarity, que mede similaridade de embeddings mas não relevância contextual exata. Um cross-encoder re-ranker (modelo menor que re-pontua pares query-chunk) melhora precisão significativamente com baixo custo adicional.

**Implementação técnica:**

Opção A — Via OpenRouter (zero dependências novas):
```typescript
// Após vector search, re-rank os top-20 via LLM
// Prompt: "Rate relevance 0-10 for each chunk given query: {query}\n{chunks}"
// Custo: 1 extra LLM call por ragSearch, modelo barato (llama-3-8b)
```

Opção B — Via Ollama (se #1 implementado):
```
ollama pull bge-reranker-v2-m3
POST /api/rerank { query, documents }
```

Opção B é zero custo de API, latência ~100ms local. Integra naturalmente com a adição do Ollama do item #1.

**Estimativa:** 2-3 dias (aproveitando infrastructure do #1 se implementado primeiro).

---

## Resumo Executivo

```
Cappy hoje:   RAG sólido, zero deps externas, HITL granular, arquitetura limpa
Cappy não tem: autocomplete inline, embeddings locais, busca híbrida, @-mention

Gap crítico para adoção em massa: inline autocomplete (esforço muito alto, paradigma diferente)
Quick wins com alto ROI:          Ollama embeddings (#1) + BM25 hybrid search (#2)
```

O Cappy tem vantagens técnicas reais e não triviais no RAG (git-diff exato, grafo 1-hop, zero deps). Mas para um desenvolvedor escolher Cappy sobre Continue.dev ou Kilo Code como ferramenta principal, precisa de pelo menos embeddings locais e busca híbrida — ambos alcançáveis em 2-3 semanas de desenvolvimento focado.
