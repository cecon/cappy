# Detecção e Prevenção de Nós Duplicados no Graph

## Problema Relatado

Foram identificados 3 nós repetidos aparecendo na visualização do grafo, quando teoricamente não deveria haver duplicatas devido à constraint `PRIMARY KEY` no campo `id` da tabela `nodes`.

## Possíveis Causas

1. **Duplicatas na query SQL**: Embora improvável devido à PRIMARY KEY, pode haver um bug no sql.js ou na forma como os dados são exportados/importados
2. **Duplicatas na transmissão**: Os dados podem estar sendo duplicados ao serem enviados do backend para o frontend
3. **Duplicatas no frontend**: O componente React pode estar renderizando os mesmos nós múltiplas vezes
4. **Problema com reloadFromDisk**: Múltiplas chamadas podem estar causando dados duplicados

## Solução Implementada

### 1. Detecção de Duplicatas no Backend (`sqlite-adapter.ts`)

Adicionado sistema de detecção e deduplicação no método `getSubgraph`:

```typescript
// Usar Set para detectar IDs duplicados
const seenIds = new Set<string>();
let duplicateCount = 0;

for (const row of result[0].values) {
  const nodeId = row[0] as string;
  
  // Detectar duplicatas
  if (seenIds.has(nodeId)) {
    duplicateCount++;
    console.warn(`⚠️ SQLite: Duplicate node ID detected: ${nodeId}`);
    continue; // Pular duplicatas
  }
  
  seenIds.add(nodeId);
  nodes.push({
    id: nodeId,
    type: row[1] as "file" | "chunk" | "workspace",
    label: row[2] as string,
  });
}
```

**Benefícios:**
- ✅ Remove duplicatas antes de enviar para o frontend
- ✅ Log de warning quando duplicatas são detectadas
- ✅ Contador de quantas duplicatas foram encontradas

### 2. Diagnóstico no getStats

Adicionado diagnóstico automático no método `getStats()`:

```typescript
// Verificar duplicatas (não deveria haver, mas vamos checar)
const dupResult = this.db.exec(`
  SELECT COUNT(*) as dup_count 
  FROM (
    SELECT id, COUNT(*) as count 
    FROM nodes 
    GROUP BY id 
    HAVING count > 1
  )
`);

const duplicates = dupResult[0]?.values[0]?.[0] as number || 0;

if (duplicates > 0) {
  console.warn(`⚠️ SQLite: Database contains ${duplicates} duplicate IDs!`);
  // Log quais são os IDs duplicados
  const dupIds = this.db.exec(`
    SELECT id, COUNT(*) as count 
    FROM nodes 
    GROUP BY id 
    HAVING count > 1
  `);
  console.warn('⚠️ Duplicate IDs:', dupIds[0]?.values);
}
```

**Benefícios:**
- ✅ Detecta duplicatas no banco de dados
- ✅ Identifica quais IDs estão duplicados
- ✅ Adiciona contador de duplicatas ao retorno de getStats

### 3. Detecção no Frontend (`GraphPage.tsx`)

Adicionado sistema de detecção antes de renderizar:

```typescript
// Detectar nós duplicados antes de setar
const nodeIds = message.nodes.map(n => n.id);
const uniqueNodeIds = new Set(nodeIds);
if (nodeIds.length !== uniqueNodeIds.size) {
  const duplicates = nodeIds.length - uniqueNodeIds.size;
  console.warn(`⚠️ [GraphPage] Received ${duplicates} duplicate nodes from backend!`);
  // Log os IDs duplicados
  const seen = new Set<string>();
  const dups: string[] = [];
  nodeIds.forEach(id => {
    if (seen.has(id)) {
      dups.push(id);
    }
    seen.add(id);
  });
  console.warn('⚠️ [GraphPage] Duplicate node IDs:', dups);
}
```

**Benefícios:**
- ✅ Detecta se o backend enviou nós duplicados
- ✅ Lista os IDs duplicados no console
- ✅ Não bloqueia a renderização

## Como Usar

### 1. Verificar Logs no Console

Após recarregar a extensão, observe o console do Developer Tools:

**No backend (Extension Host):**
```
⚠️ SQLite: Duplicate node ID detected: workspace:cappy
⚠️ SQLite: Found 2 duplicate nodes in query result
✅ SQLite: Loaded 5 unique nodes (deduplicated), 10 edges
```

**No frontend (Webview):**
```
⚠️ [GraphPage] Received 2 duplicate nodes from backend!
⚠️ [GraphPage] Duplicate node IDs: ['workspace:cappy', 'workspace:cappy']
```

### 2. Verificar Stats

Use o método `getStats()` para verificar se há duplicatas no banco:

```typescript
const stats = graphStore.getStats();
console.log(stats);
// { fileNodes: 10, chunkNodes: 50, relationships: 30, duplicates: 3 }
```

## Próximos Passos

Se duplicatas forem detectadas:

1. **Investigar a causa raiz**: 
   - Verificar onde os nós estão sendo inseridos
   - Checar se há múltiplas chamadas a `createFileNode` ou `ensureWorkspaceNode`
   - Analisar se o problema está no `reloadFromDisk`

2. **Limpar o banco**:
   ```typescript
   // Adicionar método para remover duplicatas
   async removeDuplicates() {
     // Implementar lógica de limpeza
   }
   ```

3. **Prevenir futuras duplicatas**:
   - Adicionar verificações antes de inserir
   - Usar transações para garantir atomicidade
   - Implementar locks se necessário

## Schema do Banco

O schema atual já previne duplicatas com PRIMARY KEY:

```sql
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,  -- ← PRIMARY KEY previne duplicatas
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  properties TEXT
)
```

**Nota**: Se ainda assim houver duplicatas, pode ser um bug no sql.js ou na forma como os dados são persistidos/carregados.

## Arquivos Modificados

1. ✅ `src/adapters/secondary/graph/sqlite-adapter.ts`
   - Adicionada deduplicação em `getSubgraph()`
   - Adicionado diagnóstico em `getStats()`

2. ✅ `src/components/pages/GraphPage.tsx`
   - Adicionada detecção de duplicatas no frontend

## Data

19 de outubro de 2025
