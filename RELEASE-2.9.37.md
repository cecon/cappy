# Release 2.9.37 - Query & Retrieval Testing Interface

## ✨ Nova Funcionalidade

### 🔍 Aba "Query & Retrieval" Completa

Implementada interface completa para **testar queries** no knowledge graph com **dual-level retrieval** (LightRAG pattern).

## 📋 Recursos Implementados

### 1. Interface de Query
- ✅ **Textarea grande** para entrada de queries
- ✅ **Botão "Execute Query"** com ícone de busca
- ✅ **Botão "Clear"** para limpar query e resultados
- ✅ **Placeholder explicativo** com exemplos de uso

### 2. Modos de Retrieval (Dual-Level)
Seletor de modo com 3 opções:

- 🔀 **Hybrid (Low + High Level)** [default]
  - Combina busca por entidades específicas + conceitos abstratos
  - Melhor para queries gerais

- 🎯 **Low-Level (Entities)**
  - Busca específica por entidades nomeadas
  - Melhor para "Quem é X?", "O que é Y?"

- 🌐 **High-Level (Concepts)**
  - Busca abstrata por conceitos e temas
  - Melhor para "Quais são os principais conceitos?", "Como X se relaciona com Y?"

### 3. Exibição de Resultados

#### Query Results (Card superior)
- ✅ Ícone de sucesso (checkmark verde)
- ✅ Estatísticas da query:
  - Número de entidades encontradas
  - Número de relacionamentos
  - Tempo de processamento (ms)

#### Answer (Card do meio)
- ✅ Ícone de mensagem (azul)
- ✅ Resposta gerada pela LLM
- ✅ Formatação com line-breaks preservados
- ✅ Estilo legível (font-size 14px, line-height 1.6)

#### Retrieved Context (Card inferior)
- ✅ Ícone de documento (laranja)
- ✅ Lista de contextos recuperados:
  - 🎯 **Entity** (entidades específicas)
  - 🌐 **Concept** (conceitos abstratos)
- ✅ Para cada item:
  - Nome da entidade/conceito
  - Conteúdo/descrição
  - Score de relevância (%)
- ✅ Background alternado para cada item

### 4. Estados da Interface

#### Empty State
- 🔍 Ícone de busca grande (64px)
- Título: "No Query Yet"
- Mensagem: "Enter a query above to test the knowledge graph retrieval"

#### Loading State
- ⏳ "Processing query..." no campo de resposta
- "Loading context..." no campo de contexto
- "Processing..." nas estatísticas

#### Error State
- ❌ Card vermelho com mensagem de erro
- Toast notification de erro
- Logs no console para debug

### 5. Integração com Backend

**Mensagem enviada ao backend:**
```javascript
{
    command: 'executeQuery',
    data: {
        query: string,      // Query do usuário
        mode: 'hybrid' | 'low' | 'high'
    }
}
```

**Resposta esperada:**
```javascript
{
    command: 'queryResults',
    data: {
        answer: string,          // Resposta gerada
        context: Array<{         // Contextos recuperados
            type: 'entity' | 'concept',
            name: string,
            content: string,
            score: number        // 0-1
        }>,
        entities: number,        // Count de entidades
        relationships: number,   // Count de relacionamentos
        processingTime: number,  // Tempo em ms
        error?: string          // Mensagem de erro
    }
}
```

## 🎨 Design

### Cores e Ícones
- 🔍 **Query Input**: Ícone de busca + botão verde primário
- ✅ **Success**: Verde (#10b981) + checkmark
- 💬 **Answer**: Azul (#3b82f6) + ícone de mensagem
- 📋 **Context**: Laranja (#f59e0b) + ícone de documento
- ❌ **Error**: Vermelho (#dc2626) + X

### Layout
- Cards com padding 20px
- Border radius 8px
- Border: 1px solid var(--border)
- Gap de 16px entre cards
- Font sizes: 14px (content), 16px (títulos)

## 📝 Funções JavaScript Adicionadas

```javascript
// dashboard.js
window.updateRetrievalMode()  // Atualiza modo selecionado
window.executeQuery()          // Executa query
window.clearQuery()            // Limpa query e resultados
displayQueryResults(data)      // Renderiza resultados
```

## 🔧 Message Handler

Adicionado case no message handler:
```javascript
case 'queryResults':
    displayQueryResults(message.data);
    break;
```

## 🚀 Como Usar

1. Abra o LightRAG Dashboard
2. Clique na aba **"Query & Retrieval"**
3. Digite uma query (ex: "What are the main concepts?")
4. Selecione o modo de retrieval (Hybrid, Low-Level ou High-Level)
5. Clique em **"Execute Query"**
6. Veja os resultados:
   - Resposta gerada
   - Contextos recuperados
   - Estatísticas da busca

## 📦 Arquivos Modificados

- `src/commands/lightrag/templates/htmlTemplate.ts`
  - Adicionado botão da aba Retrieval no header
  - Adicionada seção completa da aba com query input, modos e resultados

- `src/commands/lightrag/templates/dashboard.js`
  - Funções: `updateRetrievalMode()`, `executeQuery()`, `clearQuery()`
  - Função: `displayQueryResults(data)` - renderiza todos os resultados
  - Handler: `case 'queryResults'` no message listener

## ⚠️ Backend TODO

O backend precisa implementar o handler `executeQuery`:

```typescript
case 'executeQuery': {
    const { query, mode } = message.data;
    
    // 1. Processar query no LightRAG
    // 2. Executar retrieval conforme mode
    // 3. Gerar resposta com LLM
    // 4. Enviar resultados de volta
    
    panel.webview.postMessage({
        command: 'queryResults',
        data: {
            answer: '...',
            context: [...],
            entities: 5,
            relationships: 8,
            processingTime: 234
        }
    });
    break;
}
```

## 🎉 Status

✅ **Interface Completa**
- Aba de Retrieval visível e funcional
- Query input com modos de busca
- Exibição de resultados formatada
- Estados (empty, loading, error) implementados
- Integração com backend preparada

⏳ **Backend Pendente**
- Implementar handler `executeQuery` no documentUpload.ts
- Integrar com sistema LightRAG existente
- Implementar dual-level retrieval
- Gerar respostas com LLM

## 📸 Preview

```
┌─────────────────────────────────────────────┐
│ Documents │ Knowledge Graph │ Query & Retrieval │
└─────────────────────────────────────────────┘

┌─ Query & Retrieval Testing ─────────────────┐
│  Test knowledge graph queries with dual-    │
│  level retrieval (specific + abstract)      │
└──────────────────────────────────────────────┘

┌─ Enter your query ──────────────────────────┐
│ [Textarea com placeholder]                   │
│                                              │
│ [ 🔍 Execute Query ]  [ ✕ Clear ]           │
│                                              │
│ Retrieval Mode:                              │
│ ◉ Hybrid  ○ Low-Level  ○ High-Level         │
└──────────────────────────────────────────────┘

┌─ ✓ Query Results ───────────────────────────┐
│ 5 entities • 8 relationships • 234ms         │
└──────────────────────────────────────────────┘

┌─ 💬 Answer ─────────────────────────────────┐
│ [Resposta gerada pela LLM]                   │
└──────────────────────────────────────────────┘

┌─ 📋 Retrieved Context ──────────────────────┐
│ 🎯 Entity: Product X                         │
│    Description of Product X...               │
│    Relevance: 95.3%                          │
│                                              │
│ 🌐 Concept: Innovation                       │
│    Description of innovation theme...        │
│    Relevance: 87.6%                          │
└──────────────────────────────────────────────┘
```
