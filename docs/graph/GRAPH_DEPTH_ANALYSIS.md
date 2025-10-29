# Análise de Profundidade e Relacionamentos do Grafo

## Problema Identificado

O sistema está criando um grafo com **profundidade limitada** onde:
- Os nós (chunks) se ligam apenas ao arquivo pai
- Não há relacionamentos entre chunks (código ↔ código)
- Não há relacionamentos cross-file adequados (arquivo A → arquivo B)
- O grafo fica "raso" ao invés de rico e interconectado

### Exemplo do Problema

```
Arquivo A.ts
  ├─ Chunk 1 (função foo)
  ├─ Chunk 2 (classe Bar)
  └─ Chunk 3 (interface Baz)

Arquivo B.ts (importa Bar de A.ts)
  ├─ Chunk 4 (usa Bar)
  └─ Chunk 5 (função qux)
```

**Estado Atual (Limitado):**
```
A.ts --CONTAINS--> Chunk 1
A.ts --CONTAINS--> Chunk 2
A.ts --CONTAINS--> Chunk 3
B.ts --CONTAINS--> Chunk 4
B.ts --CONTAINS--> Chunk 5
```

**Estado Desejado (Rico):**
```
A.ts --CONTAINS--> Chunk 1
A.ts --CONTAINS--> Chunk 2 (Bar)
A.ts --CONTAINS--> Chunk 3
B.ts --CONTAINS--> Chunk 4
B.ts --CONTAINS--> Chunk 5
Chunk 4 --REFERENCES--> Chunk 2  (usa Bar!)
Chunk 4 --REFERENCES--> B.ts --IMPORTS--> A.ts
```

## Causas Raiz Identificadas

### 1. AST Relationship Extractor Incompleto

**Arquivo:** `src/services/ast-relationship-extractor.ts`

**Problemas:**

#### a) Relacionamentos intra-arquivo não estão sendo criados corretamente

```typescript
// Linhas 92-110: Lógica problemática
for (const call of calls) {
  const targetChunkId = symbolToChunkId.get(call);
  if (targetChunkId) {
    // ❌ PROBLEMA: Cria relacionamento de TODOS os chunks para o target
    for (const chunk of chunks) {
      if (chunk.metadata.chunkType === 'code' || chunk.metadata.chunkType === 'jsdoc') {
        relationships.push({
          from: chunk.id,
          to: targetChunkId,
          type: 'REFERENCES',
          // ...
        });
      }
    }
  }
}
```

**Problema**: A lógica atual cria relacionamentos de **todos** os chunks para um target, quando deveria:
1. Analisar **onde** a chamada de função ocorre (linha específica)
2. Mapear para o chunk específico que contém aquela linha
3. Criar relacionamento apenas desse chunk

#### b) Imports não criam relacionamentos chunk-to-file

```typescript
// Linhas 136-138: Apenas loga, não cria relacionamentos
if (imports.length > 0) {
  console.log(`  📥 Imports: ${imports.map(i => i.source).join(', ')}`);
}
```

**Problema**: Os imports são detectados mas não geram relacionamentos no grafo.

#### c) Falta contexto de linha/posição

O extrator não está mapeando:
- Em qual **linha** cada call/reference ocorre
- Qual **chunk** contém aquela linha
- Se a referência é local ou importada

### 2. IndexingService não Cria Relacionamentos Cross-File Adequados

**Arquivo:** `src/services/indexing-service.ts` (linhas 108-162)

```typescript
// Código existente tenta resolver imports, mas:
for (const im of analysis.imports) {
  // ❌ Cria relacionamento do chunk para o FILE, não para o SYMBOL específico
  rels.push({
    from: chunk.id,
    to: targetPath,  // ← Deveria ser o chunk do símbolo importado!
    type: 'REFERENCES',
    // ...
  });
}
```

**Problema**: 
- Relaciona chunk → file ao invés de chunk → chunk específico
- Não resolve qual símbolo foi importado
- Não busca o chunk que define aquele símbolo

### 3. Metadados Insuficientes nos Chunks

Os chunks precisam de mais metadados para relacionamentos precisos:
- `symbolName`: ✅ Existe
- `symbolKind`: ✅ Existe
- `importedFrom`: ❌ Falta
- `exportsSymbols`: ❌ Falta
- `referencedSymbols`: ❌ Falta
- `lineRange`: ✅ Existe (lineStart, lineEnd)

## Solução Proposta

### Fase 1: Comando de Diagnóstico (✅ IMPLEMENTADO)

Criado comando `cappy.diagnoseGraph` que:
- ✅ Analisa todos os arquivos indexados
- ✅ Conta chunks, relacionamentos por tipo
- ✅ Detecta arquivos sem chunks
- ✅ Detecta chunks órfãos (sem relacionamentos)
- ✅ Testa profundidade do grafo
- ✅ Verifica AST extraction para cada arquivo
- ✅ Gera relatório detalhado

**Como usar:**
1. `Cmd+Shift+P` → "Cappy: Diagnose Graph Structure"
2. Analise o output channel
3. Identifique os problemas específicos

### Fase 2: Melhorias no AST Extractor (🔧 NECESSÁRIO)

#### 2.1 Adicionar Mapeamento Linha → Chunk

```typescript
interface LineRangeMap {
  [chunkId: string]: { start: number; end: number; symbolName?: string };
}

// Criar mapa no início do extract()
const lineToChunk = new Map<number, string>();
for (const chunk of chunks) {
  for (let line = chunk.metadata.lineStart; line <= chunk.metadata.lineEnd; line++) {
    lineToChunk.set(line, chunk.id);
  }
}
```

#### 2.2 Extrair Posições das Chamadas

```typescript
private extractFunctionCalls(ast: any): Array<{ name: string; line: number }> {
  const calls: Array<{ name: string; line: number }> = [];
  
  const visit = (node: any) => {
    if (node.type === 'CallExpression' && node.loc) {
      const name = node.callee?.name || node.callee?.property?.name;
      if (name) {
        calls.push({ 
          name, 
          line: node.loc.start.line // ← ADICIONAR LINHA!
        });
      }
    }
    // ...
  };
  
  return calls;
}
```

#### 2.3 Criar Relacionamentos Precisos

```typescript
// Mapear calls para chunks específicos
for (const call of calls) {
  const sourceChunkId = lineToChunk.get(call.line);
  const targetChunkId = symbolToChunkId.get(call.name);
  
  if (sourceChunkId && targetChunkId && sourceChunkId !== targetChunkId) {
    relationships.push({
      from: sourceChunkId,  // ← Chunk específico que faz a chamada
      to: targetChunkId,    // ← Chunk específico que define a função
      type: 'REFERENCES',
      properties: {
        referenceType: 'function_call',
        symbolName: call.name,
        line: call.line
      }
    });
  }
}
```

### Fase 3: Relacionamentos Cross-File (🔧 NECESSÁRIO)

#### 3.1 Resolver Import → Exported Symbol

```typescript
// No indexingService, ao processar imports:
for (const im of analysis.imports) {
  const targetPath = resolveImportPath(filePath, im.source);
  if (!targetPath) continue;
  
  // Buscar exports do arquivo alvo
  const targetAnalysis = await extractor.analyze(targetPath);
  const targetChunks = await graphStore.getFileChunks(targetPath);
  
  // Para cada símbolo importado
  for (const importedSymbol of im.specifiers) {
    // Encontrar o chunk que exporta este símbolo
    const exportingChunk = targetChunks.find(c => 
      c.label === importedSymbol || 
      // ou verificar nos metadados
    );
    
    if (exportingChunk) {
      // Criar relacionamento: chunk importador → chunk exportador
      rels.push({
        from: chunks[0].id, // ou o chunk que faz o import
        to: exportingChunk.id,
        type: 'IMPORTS',
        properties: {
          symbolName: importedSymbol,
          sourceFile: im.source
        }
      });
    }
  }
}
```

### Fase 4: Enriquecer Metadados dos Chunks (🔧 NECESSÁRIO)

Adicionar ao `DocumentChunk.metadata`:

```typescript
interface ChunkMetadata {
  // Existentes
  filePath: string;
  lineStart: number;
  lineEnd: number;
  chunkType: ChunkType;
  symbolName?: string;
  symbolKind?: SymbolKind;
  
  // NOVOS
  importsFrom?: Array<{ source: string; symbols: string[] }>;
  exportsSymbols?: string[];
  callsSymbols?: Array<{ name: string; line: number }>;
  referencesTypes?: Array<{ name: string; line: number }>;
}
```

## Estratégia de Implementação

### Passo 1: Diagnóstico ✅
- [x] Criar comando de diagnóstico
- [x] Registrar comando no VS Code
- [x] Adicionar ao package.json

### Passo 2: Coletar Dados
1. Rodar `cappy.diagnoseGraph`
2. Identificar:
   - Quantos relacionamentos existem hoje?
   - Que tipos? (CONTAINS? REFERENCES?)
   - Há relacionamentos cross-file?
3. Compartilhar output comigo

### Passo 3: Corrigir AST Extractor
1. Adicionar mapeamento linha → chunk
2. Extrair posições de calls/references
3. Criar relacionamentos precisos intra-arquivo
4. Testar com um arquivo

### Passo 4: Implementar Cross-File
1. Resolver imports para símbolos específicos
2. Criar relacionamentos chunk → chunk entre arquivos
3. Testar com 2-3 arquivos relacionados

### Passo 5: Reindexar
1. Rodar `cappy.reanalyzeRelationships`
2. Rodar `cappy.diagnoseGraph` novamente
3. Verificar melhoria na profundidade

## Métricas de Sucesso

### Antes (Estado Atual)
```
Total files: 50
Total chunks: 300
Total relationships: 300 (apenas CONTAINS)
Depth 2: 50 nodes (apenas files)
Depth 5: 50 nodes (não aumenta)
```

### Depois (Estado Desejado)
```
Total files: 50
Total chunks: 300
Total relationships: 1200+
  - 300 CONTAINS (file → chunk)
  - 400 REFERENCES (chunk → chunk, intra-file)
  - 200 IMPORTS (chunk → chunk, cross-file)
  - 300 DOCUMENTS (jsdoc → code)
Depth 2: 150 nodes
Depth 5: 350 nodes
Deepest path: 8+ hops
```

## Comandos Disponíveis

1. **Diagnóstico**: `Cappy: Diagnose Graph Structure`
   - Analisa estado atual
   - Identifica problemas
   - Sugere correções

2. **Reindexar**: `Cappy: Reanalyze All Relationships`
   - Recria relacionamentos
   - Após correções no código

3. **Visualizar**: `Cappy: Open Graph`
   - Ver o grafo atual
   - Testar profundidade

## Próximos Passos Imediatos

1. ✅ **Rodar diagnóstico**: `Cmd+Shift+P` → "Cappy: Diagnose Graph Structure"
2. 📋 **Compartilhar output**: Cole o resultado aqui
3. 🔧 **Implementar correções**: Baseado no diagnóstico
4. 🧪 **Testar**: Validar melhorias
5. 🚀 **Reindexar**: Aplicar em todo o workspace

## Arquivos Modificados

- ✅ `src/commands/diagnose-graph.ts` - Novo comando de diagnóstico
- ✅ `src/domains/dashboard/ports/indexing-port.ts` - Adicionados métodos getStats e getSubgraph
- ✅ `src/extension.ts` - Registrado comando
- ✅ `package.json` - Adicionado comando ao VS Code

## Data

19 de outubro de 2025
