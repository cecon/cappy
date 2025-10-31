# Context Retrieval Tool - Language Model Integration

## 📖 Visão Geral

O **Context Retrieval Tool** (`cappy_retrieve_context`) é uma Language Model Tool que integra o **HybridRetriever** com o GitHub Copilot, permitindo que o LLM busque contexto relevante do projeto antes de responder perguntas ou gerar código.

## ✅ Status: IMPLEMENTADO

- ✅ Tool criada e registrada
- ✅ Integração com HybridRetriever
- ✅ Suporte a múltiplas fontes (code, docs, rules, tasks)
- ✅ Filtros por categoria e relevância
- ✅ Formatação otimizada para LLM
- ✅ Registrada no package.json
- ✅ Auto-inicialização com graph data
- ✅ **Context Enrichment** - Enriquece contextos com pouca informação
  - Detecta automaticamente snippets minimais (< 150 chars ou < 5 linhas)
  - Lê +5 linhas antes e depois do código
  - Fornece contexto completo ao LLM

## 🎯 Como Funciona

### 1. Usuário pergunta ao Copilot

```
User: "Como implementar autenticação JWT neste projeto?"
```

### 2. Copilot decide usar a tool

```
Copilot: "Vou buscar contexto relevante sobre JWT no projeto..."
```

### 3. Tool executa busca

```typescript
{
  query: "JWT authentication",
  sources: ["code", "documentation", "prevention"],
  maxResults: 10,
  minScore: 0.6
}
```

### 4. Retorna contexto formatado

```
📊 Found 8 relevant contexts (245ms)

📁 Sources: code: 3, documentation: 3, prevention: 2

---

💻 **authenticateUser** (87% relevant)
📂 Category: auth
📄 File: `/src/auth/authenticate.ts`
🏷️ Keywords: jwt, token, authentication

**Content:**
```
function authenticateUser(token: string): Promise<User> {
  // Validates JWT and returns user
  ...
}
```

---

🛡️ **JWT Validation Rules** (82% relevant)
...
```

### 5. Copilot usa contexto para responder

```
Copilot: "Baseado no código existente do projeto, você pode implementar 
autenticação JWT assim... Note que já existe a função authenticateUser() 
em /src/auth/authenticate.ts. Seguindo as prevention rules do projeto..."
```

## 🚀 Uso Manual (para testes)

### Via Chat Panel

```
Usuário: "busque contexto sobre database migration"
```

O Copilot irá detectar e usar automaticamente a tool.

### Via Código (para integração)

```typescript
import { ContextRetrievalTool } from './domains/chat/tools/native';
import { HybridRetriever } from './services/hybrid-retriever';

// Criar retriever com graph data
const retriever = new HybridRetriever(graphData);

// Criar tool
const tool = new ContextRetrievalTool(retriever);
await tool.initialize();

// Usar programaticamente
const result = await tool.invoke({
  input: {
    query: 'authentication patterns',
    maxResults: 10,
    sources: ['code', 'documentation']
  }
}, cancellationToken);
```

## 📊 Input Schema

```typescript
{
  query: string;                    // REQUIRED: busca
  maxResults?: number;              // Limite (default: 10)
  minScore?: number;                // Score mínimo 0-1 (default: 0.5)
  sources?: string[];               // ['code', 'documentation', 'prevention', 'task']
  category?: string;                // Filtro por categoria
  includeRelated?: boolean;         // Incluir relacionados (default: true)
}
```

## 📤 Output Format

### Success Response

```typescript
{
  parts: [
    LanguageModelTextPart(`
      📊 Found 5 relevant contexts (150ms)
      📁 Sources: code: 2, documentation: 2, prevention: 1
      
      ---
      
      💻 **FunctionName** (95% relevant)
      📂 Category: auth
      📄 File: /src/auth.ts
      🏷️ Keywords: jwt, token
      
      **Content:**
      ```
      function authenticate() { ... }
      ```
      
      ---
      ...
    `)
  ]
}
```

### Error Response

```typescript
{
  parts: [
    LanguageModelTextPart('❌ Error retrieving context: ...')
  ]
}
```

### No Results

```typescript
{
  parts: [
    LanguageModelTextPart('ℹ️ No relevant context found for: "query"')
  ]
}
```

## 🎯 Casos de Uso

### 1. Responder Perguntas sobre Código Existente

```
User: "Como o sistema de autenticação funciona?"
Copilot: [usa tool para buscar código de auth]
Copilot: "O sistema usa JWT com as seguintes funções..."
```

### 2. Gerar Código Consistente com o Projeto

```
User: "Crie uma função para validar email"
Copilot: [busca padrões de validação existentes]
Copilot: "Baseado nos padrões do projeto, aqui está..."
```

### 3. Sugerir Best Practices do Projeto

```
User: "Como devo lidar com erros de database?"
Copilot: [busca prevention rules de database]
Copilot: "Seguindo as prevention rules: ..."
```

### 4. Encontrar Implementações Similares

```
User: "Preciso criar um novo service"
Copilot: [busca services existentes]
Copilot: "Seguindo o padrão dos services existentes..."
```

### 5. Verificar Tasks Relacionadas

```
User: "Alguém já trabalhou em feature X?"
Copilot: [busca tasks]
Copilot: "Sim, há uma task completada sobre isso..."
```

## ⚙️ Configuração

### package.json

```json
{
  "name": "cappy_retrieve_context",
  "displayName": "Retrieve Context",
  "modelDescription": "Searches for relevant context across code, documentation, prevention rules, and tasks...",
  "inputSchema": { ... }
}
```

### Registro no Extension

```typescript
// src/domains/chat/tools/setup.ts
const contextRetrievalTool = new ContextRetrievalTool();
await contextRetrievalTool.initialize();

const disposable = toolRegistry.register(
  ContextRetrievalTool.metadata,
  contextRetrievalTool
);
```

## 🔧 Manutenção

### Atualizar Graph Data

```typescript
// Quando o graph for reindexado
const newGraphData = await graphService.loadGraph();
contextRetrievalTool.setGraphData(newGraphData.data);
```

### Monitorar Performance

```typescript
// Tool retorna tempo de execução
// Metadata: { retrievalTimeMs: 150 }
```

## 🎓 Exemplos de Queries

### Boas Queries

```typescript
"JWT authentication implementation"
"database migration patterns"  
"error handling in API controllers"
"user service validation rules"
"React component patterns"
```

### Queries Ruins (muito genéricas)

```typescript
"code"           // Muito genérico
"function"       // Sem contexto
"how to"         // Sem tema específico
```

## 📈 Performance

- **Tempo médio**: 150-300ms
- **Cache**: Não implementado ainda (TODO)
- **Parallel execution**: Sim, busca em múltiplas fontes
- **Re-ranking**: Sim, para melhor relevância

## 🐛 Troubleshooting

### Tool não aparece no Copilot

1. Verificar `package.json` - tool registrada?
2. Verificar console - erros de inicialização?
3. Reload VS Code

### Resultados irrelevantes

- Aumentar `minScore`: 0.6 ou 0.7
- Especificar `category`
- Limitar `sources`

### Performance lenta

- Reduzir `maxResults`
- Desabilitar `includeRelated`
- Verificar tamanho dos indexes

### Sem resultados

- Diminuir `minScore`: 0.3 ou 0.4
- Aumentar `maxResults`: 20 ou 30
- Verificar se indexes existem

## 🚀 Próximos Passos

1. ✅ **DONE**: Tool implementada e registrada
2. ⏳ **TODO**: Integrar com comandos Cappy
3. ⏳ **TODO**: Cache layer para queries frequentes
4. ⏳ **TODO**: Metrics e analytics
5. ⏳ **TODO**: Feedback loop para melhorar relevância

## � Context Enrichment

### O que é?

Quando o retrieval encontra **contextos com pouca informação** (arquivos simples, linhas únicas, snippets pequenos), o sistema automaticamente **enriquece** o contexto lendo mais linhas do código ao redor.

### Como funciona?

1. **Detecção Automática**
   - Conteúdo < 150 caracteres, OU
   - Conteúdo < 5 linhas

2. **Expansão de Contexto**
   - Lê +5 linhas antes do snippet
   - Lê +5 linhas depois do snippet
   - Total: até 10 linhas adicionais de contexto

3. **Resultado**
   - LLM recebe contexto completo
   - Melhor compreensão do código
   - Informações sobre imports, variáveis, estrutura

### Exemplo

**Antes (Contexto Original):**
```typescript
const result = graphService.loadGraph();
```

**Depois (Contexto Enriquecido):**
```typescript
async initialize(): Promise<void> {
  try {
    // Load graph data if available
    if (this.graphService) {
      const result = await this.graphService.loadGraph();
      if (result.data) {
        this.retriever = new HybridRetriever(result.data);
      }
    }
```

### Quando é usado?

- ✅ Referências simples de código
- ✅ Imports de módulos
- ✅ Declarações de variáveis
- ✅ Linhas únicas de código
- ❌ Documentação completa (não precisa)
- ❌ Classes/funções completas (já tem contexto)

### Logs

Quando um contexto é enriquecido:
```
[ContextRetrievalTool] Enriched context for src/file.ts:42 from 28 to 345 chars
```

**📚 Mais detalhes**: Ver [CONTEXT_ENRICHMENT.md](./CONTEXT_ENRICHMENT.md)

---

## �📝 Changelog

### v1.1.0 (2025-10-30)
- ✅ **Context Enrichment** - Enriquece automaticamente contextos com pouca informação
  - Detecta snippets minimais (< 150 chars ou < 5 linhas)
  - Expande contexto com +5 linhas antes e depois
  - Melhora significativa na qualidade do contexto para o LLM

### v1.0.0 (2025-10-20)
- ✅ Implementação inicial
- ✅ Integração com HybridRetriever
- ✅ Suporte a 4 fontes (code, docs, prevention, tasks)
- ✅ Filtros por categoria e score
- ✅ Auto-inicialização com graph data
- ✅ Formatação otimizada para LLM

---

**Status**: ✅ PRODUCTION READY  
**Tested**: Manual testing OK  
**Next**: Integration tests
